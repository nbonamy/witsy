
import { loadPyodide, PyodideInterface } from 'pyodide'
import { app } from 'electron'
import fs from 'fs'
import path from 'path'

/**
 * Pyodide Manager - Provides sandboxed Python execution using WebAssembly
 *
 * Security model:
 * - Runs Python in WASM sandbox with no access to filesystem or network
 * - Isolated from host system
 * - Same security model as Pyodide in browsers
 *
 * Features:
 * - Lazy loading: Only initializes on first use
 * - Memory TTL: Disposes after 15 minutes of inactivity to free ~50-100MB
 * - File caching: Downloads once, caches to disk for offline use
 * - CDN fallback: Uses CDN if cache fails or corrupted
 *
 * Usage:
 * - Call runPythonCode() to execute Python scripts
 * - First call may download ~12MB (cached for subsequent app launches)
 * - Subsequent calls are instant (reuses in-memory instance)
 */

// Configuration
const PYODIDE_CONFIG = {
  version: '0.29.0',
  memoryTTL: 15 * 60 * 1000,  // 15 minutes of inactivity
  cacheDir: 'pyodide-cache',
  cdnURL: 'https://cdn.jsdelivr.net/pyodide/v0.29.0/full/',  // Only used for downloads
}

const FILES_TO_CACHE = [
  'pyodide.asm.wasm',
  'python_stdlib.zip',
  'pyodide.asm.js',
  'pyodide-lock.json',
  'pyodide.js',
  'pyodide.mjs',
]

// Runtime state
let pyodideInstance: PyodideInterface | null = null
let initializationPromise: Promise<PyodideInterface> | null = null
let disposalTimer: NodeJS.Timeout | null = null
let lastUsedTime: number = 0

/**
 * Get cache directory path
 */
function getCacheDirectory(): string {
  return path.join(
    app.getPath('userData'),
    PYODIDE_CONFIG.cacheDir,
    PYODIDE_CONFIG.version
  )
}

/**
 * Check if all required files exist in cache
 */
function isCacheComplete(): boolean {
  const cacheDir = getCacheDirectory()

  try {
    return FILES_TO_CACHE.every(file => {
      const filePath = path.join(cacheDir, file)
      return fs.existsSync(filePath) && fs.statSync(filePath).size > 0
    })
  } catch {
    return false
  }
}

/**
 * Clear the entire Pyodide cache
 */
export function clearPyodideCache(): boolean {
  const cacheDir = getCacheDirectory()

  try {
    if (fs.existsSync(cacheDir)) {
      fs.rmSync(cacheDir, { recursive: true, force: true })
      console.log('[Pyodide] Cache cleared at', cacheDir)
    }
    return true
  } catch (error) {
    console.warn('[Pyodide] Failed to clear cache:', error)
    return false
  }
}


/**
 * Download a single file from CDN to cache
 */
async function downloadFile(filename: string, cacheDir: string): Promise<void> {
  const url = `${PYODIDE_CONFIG.cdnURL}${filename}`
  const destPath = path.join(cacheDir, filename)

  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Failed to download ${filename}: ${response.statusText}`)
  }

  const buffer = Buffer.from(await response.arrayBuffer())
  await fs.promises.writeFile(destPath, buffer)

  console.log(`[Pyodide] Cached ${filename} (${(buffer.length / 1024 / 1024).toFixed(1)}MB)`)
}

/**
 * Download and cache all Pyodide files
 */
async function downloadAndCacheFiles(): Promise<void> {
  const cacheDir = getCacheDirectory()

  console.log('[Pyodide] Downloading runtime files...')

  // Create cache directory
  await fs.promises.mkdir(cacheDir, { recursive: true })

  // Download all files
  for (const file of FILES_TO_CACHE) {
    await downloadFile(file, cacheDir)
  }

  console.log('[Pyodide] All files cached successfully')
}

/**
 * Ensure cache exists, download if needed
 */
async function ensureCacheExists(): Promise<string> {
  const cacheDir = getCacheDirectory()

  if (isCacheComplete()) {
    console.log('[Pyodide] Using cached files from', cacheDir)
    return cacheDir
  }

  console.log('[Pyodide] Cache incomplete, downloading...')
  await downloadAndCacheFiles()

  return cacheDir
}

/**
 * Schedule disposal of Pyodide instance after TTL
 */
function scheduleDisposal(): void {
  // Clear existing timer
  if (disposalTimer) {
    clearTimeout(disposalTimer)
  }

  // Schedule disposal
  disposalTimer = setTimeout(() => {
    const idleTime = Date.now() - lastUsedTime

    if (idleTime >= PYODIDE_CONFIG.memoryTTL) {
      console.log('[Pyodide] Disposing due to inactivity (freed ~50-100MB)')
      pyodideInstance = null
      initializationPromise = null
      disposalTimer = null
    }
  }, PYODIDE_CONFIG.memoryTTL)
}

/**
 * Initialize Pyodide (lazy loading)
 * Uses singleton pattern to reuse instance across calls
 */
async function initializePyodide(): Promise<PyodideInterface> {
  // If already initialized, return existing instance
  if (pyodideInstance) {
    return pyodideInstance
  }

  // If initialization in progress, wait for it
  if (initializationPromise) {
    return initializationPromise
  }

  // Try to use cached files first
  try {
    const cacheDir = await ensureCacheExists()

    // Note: In Node.js, use directory path directly (not file:// URL)
    // Pyodide's loadPyodide expects a filesystem path in Node.js context
    console.log('[Pyodide] Initializing from cache:', cacheDir)

    initializationPromise = loadPyodide({ indexURL: cacheDir })
    pyodideInstance = await initializationPromise

    console.log('[Pyodide] Initialized successfully from cache')
    return pyodideInstance

  } catch (cacheError) {
    console.warn('[Pyodide] Cache failed, falling back to CDN:', cacheError.message)

    // Fallback to CDN - use default indexURL (Pyodide handles CDN loading in Node.js)
    // Note: Don't specify indexURL with URLs in Node.js, it tries to parse them as paths
    initializationPromise = loadPyodide()

    try {
      pyodideInstance = await initializationPromise
      console.log('[Pyodide] Initialized successfully from default CDN')
      return pyodideInstance
    } catch (cdnError) {
      initializationPromise = null
      throw new Error(`Failed to initialize Pyodide: ${cdnError.message}`)
    }
  }
}

/**
 * Execute Python code in sandboxed environment
 *
 * @param script - Python code to execute
 * @returns Object with either result or error
 */
export async function runPythonCode(script: string): Promise<{ result?: string; error?: string }> {
  try {
    // Update last used time
    lastUsedTime = Date.now()

    // Initialize Pyodide if needed
    const pyodide = await initializePyodide()

    // Execute the script
    const result = await pyodide.runPythonAsync(script)

    // Schedule disposal after TTL
    scheduleDisposal()

    // Convert result to string
    let resultStr: string
    if (result === undefined || result === null) {
      resultStr = String(result)
    } else if (typeof result === 'object') {
      // Try to convert to JSON, fallback to string representation
      try {
        resultStr = JSON.stringify(result, null, 2)
      } catch {
        resultStr = String(result)
      }
    } else {
      resultStr = String(result)
    }

    return { result: resultStr }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    return { error: errorMessage }
  }
}

/**
 * Get initialization status
 * Useful for UI to show loading state
 */
export function isPyodideInitialized(): boolean {
  return pyodideInstance !== null
}

/**
 * Preemptively download and cache Pyodide files
 * Useful for settings UI to download in advance
 */
export async function downloadPyodideRuntime(): Promise<void> {
  await ensureCacheExists()
}

/**
 * Check if Pyodide is already cached locally
 */
export function isPyodideCached(): boolean {
  return isCacheComplete()
}

/**
 * Reset Pyodide instance (for testing)
 */
export function resetPyodide(): void {
  if (disposalTimer) {
    clearTimeout(disposalTimer)
    disposalTimer = null
  }
  pyodideInstance = null
  initializationPromise = null
  lastUsedTime = 0
}
