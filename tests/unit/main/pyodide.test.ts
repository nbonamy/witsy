
import { vi, beforeEach, afterEach, expect, test, describe } from 'vitest'
import { runPythonCode, isPyodideInitialized, resetPyodide } from '@main/pyodide'
import fs from 'fs'

// Mock electron
vi.mock('electron', () => ({
  app: {
    getPath: vi.fn(() => '/tmp/test-userdata')
  }
}))

// Mock fs
vi.mock('fs', () => ({
  default: {
    existsSync: vi.fn(),
    statSync: vi.fn(),
    promises: {
      mkdir: vi.fn(),
      writeFile: vi.fn()
    }
  }
}))

// Mock path (use real implementation)
vi.mock('path', async () => {
  const actual = await vi.importActual<typeof import('path')>('path')
  return { default: actual }
})

// Mock fetch
global.fetch = vi.fn()

// Mock pyodide module
vi.mock('pyodide', () => ({
  loadPyodide: vi.fn(),
}))

describe('Pyodide Manager', () => {
  let mockPyodide: any
  let mockLoadPyodide: any

  beforeEach(async () => {
    // Reset state
    vi.clearAllMocks()
    vi.clearAllTimers()
    resetPyodide()

    // Setup default fs mocks (cache exists)
    vi.mocked(fs.existsSync).mockReturnValue(true)
    vi.mocked(fs.statSync).mockReturnValue({ size: 1000 } as any)
    vi.mocked(fs.promises.mkdir).mockResolvedValue(undefined)
    vi.mocked(fs.promises.writeFile).mockResolvedValue(undefined)

    // Mock fetch
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(100))
    } as any)

    // Get the mocked loadPyodide
    const pyodideModule = await import('pyodide')
    mockLoadPyodide = vi.mocked(pyodideModule.loadPyodide)

    // Create mock Pyodide instance
    mockPyodide = {
      runPythonAsync: vi.fn(),
      setStdout: vi.fn(),
    }

    // Mock loadPyodide to return our mock
    mockLoadPyodide.mockResolvedValue(mockPyodide)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  test('should initialize Pyodide on first call', async () => {
    expect(isPyodideInitialized()).toBe(false)

    mockPyodide.runPythonAsync.mockResolvedValue(42)

    const result = await runPythonCode('2 + 2')

    expect(isPyodideInitialized()).toBe(true)
    expect(result).toEqual({ result: '42' })
  })

  test('should reuse Pyodide instance', async () => {
    // First call initializes
    mockPyodide.runPythonAsync.mockResolvedValue(10)
    await runPythonCode('5 + 5')

    const callCountAfterFirst = mockLoadPyodide.mock.calls.length

    // Second call should reuse
    mockPyodide.runPythonAsync.mockResolvedValue(20)
    await runPythonCode('10 + 10')

    // loadPyodide should not be called again
    expect(mockLoadPyodide.mock.calls.length).toBe(callCountAfterFirst)
  })

  test('should execute simple Python code', async () => {
    mockPyodide.runPythonAsync.mockResolvedValue(100)

    const result = await runPythonCode('50 * 2')

    expect(mockPyodide.runPythonAsync).toHaveBeenCalledWith('50 * 2')
    expect(result).toEqual({ result: '100' })
  })

  test('should handle string results', async () => {
    mockPyodide.runPythonAsync.mockResolvedValue('hello world')

    const result = await runPythonCode('"hello" + " world"')

    expect(result).toEqual({ result: 'hello world' })
  })

  test('should handle object results as JSON', async () => {
    mockPyodide.runPythonAsync.mockResolvedValue({ foo: 'bar', num: 123 })

    const result = await runPythonCode('{"foo": "bar", "num": 123}')

    expect(result.result).toContain('"foo"')
    expect(result.result).toContain('"bar"')
    expect(result.result).toContain('123')
  })

  test('should handle None/undefined results', async () => {
    mockPyodide.runPythonAsync.mockResolvedValue(undefined)

    const result = await runPythonCode('None')

    expect(result).toEqual({ result: 'undefined' })
  })

  test('should handle null results', async () => {
    mockPyodide.runPythonAsync.mockResolvedValue(null)

    const result = await runPythonCode('None')

    expect(result).toEqual({ result: 'null' })
  })

  test('should capture stdout from print statements', async () => {
    // Mock stdout capture
    let stdoutCallback: ((msg: string) => void) | null = null
    mockPyodide.setStdout.mockImplementation((opts: any) => {
      stdoutCallback = opts.batched
    })
    mockPyodide.runPythonAsync.mockImplementation(async () => {
      // Simulate print output
      if (stdoutCallback) {
        stdoutCallback('Hello from Python')
      }
      return undefined
    })

    const result = await runPythonCode('print("Hello from Python")')

    expect(mockPyodide.setStdout).toHaveBeenCalled()
    expect(result).toEqual({ result: 'Hello from Python' })
  })

  test('should use return value and ignore stdout when both present', async () => {
    let stdoutCallback: ((msg: string) => void) | null = null
    mockPyodide.setStdout.mockImplementation((opts: any) => {
      stdoutCallback = opts.batched
    })
    mockPyodide.runPythonAsync.mockImplementation(async () => {
      if (stdoutCallback) {
        stdoutCallback('Debug output')
      }
      return 42
    })

    const result = await runPythonCode('print("Debug output"); 21 * 2')

    // Should only return the result, not stdout
    expect(result).toEqual({ result: '42' })
  })

  test('should handle Python errors', async () => {
    mockPyodide.runPythonAsync.mockRejectedValue(new Error('NameError: name "undefined_var" is not defined'))

    const result = await runPythonCode('print(undefined_var)')

    expect(result.error).toContain('NameError')
  })

  test('should handle initialization errors', async () => {
    mockLoadPyodide.mockRejectedValue(new Error('Failed to load WASM'))

    resetPyodide()

    const result = await runPythonCode('1 + 1')

    expect(result.error).toContain('Failed to initialize Pyodide')
  })

  test('should handle non-Error exceptions', async () => {
    mockPyodide.runPythonAsync.mockRejectedValue('String error')

    const result = await runPythonCode('bad code')

    expect(result.error).toBe('String error')
  })

  test('should use cached files when available', async () => {
    mockPyodide.runPythonAsync.mockResolvedValue(42)

    await runPythonCode('1+1')

    // Should use filesystem path for cached files (not file:// URL in Node.js)
    expect(mockLoadPyodide).toHaveBeenCalledWith({
      indexURL: expect.stringContaining('pyodide-cache'),
      packages: ['numpy', 'pandas', 'scipy', 'scikit-learn', 'statsmodels', 'matplotlib']
    })
  })

  test('should download files if cache incomplete', async () => {
    // Simulate cache not existing
    vi.mocked(fs.existsSync).mockReturnValue(false)

    mockPyodide.runPythonAsync.mockResolvedValue(42)

    await runPythonCode('1+1')

    // Should have created directory
    expect(fs.promises.mkdir).toHaveBeenCalled()

    // Should have downloaded files
    expect(global.fetch).toHaveBeenCalled()
    expect(fs.promises.writeFile).toHaveBeenCalled()
  })

  test('should fallback to CDN if cache initialization fails', async () => {
    // Make cache initialization fail by failing loadPyodide on first call
    mockLoadPyodide
      .mockRejectedValueOnce(new Error('Cache initialization failed'))
      .mockResolvedValueOnce(mockPyodide)

    mockPyodide.runPythonAsync.mockResolvedValue(42)

    const result = await runPythonCode('1+1')

    expect(result).toEqual({ result: '42' })

    // Should have been called twice (cache fail, then CDN)
    expect(mockLoadPyodide).toHaveBeenCalledTimes(2)

    // Second call should include packages but no indexURL
    expect(mockLoadPyodide.mock.calls[1][0]).toEqual({
      packages: ['numpy', 'pandas', 'scipy', 'scikit-learn', 'statsmodels', 'matplotlib']
    })
  })

  test('should dispose Pyodide after TTL expires', async () => {
    vi.useFakeTimers()

    mockPyodide.runPythonAsync.mockResolvedValue(42)

    await runPythonCode('1+1')
    expect(isPyodideInitialized()).toBe(true)

    // Advance time past TTL (15 minutes)
    vi.advanceTimersByTime(16 * 60 * 1000)

    expect(isPyodideInitialized()).toBe(false)
  })

  test('should reset TTL on subsequent use', async () => {
    vi.useFakeTimers()

    mockPyodide.runPythonAsync.mockResolvedValue(42)

    // First call
    await runPythonCode('1+1')
    expect(isPyodideInitialized()).toBe(true)

    // Advance 10 minutes
    vi.advanceTimersByTime(10 * 60 * 1000)

    // Second call resets timer
    await runPythonCode('2+2')
    expect(isPyodideInitialized()).toBe(true)

    // Advance another 10 minutes (20 total, but timer was reset)
    vi.advanceTimersByTime(10 * 60 * 1000)

    // Should still be alive
    expect(isPyodideInitialized()).toBe(true)

    // Advance another 6 minutes (now 16 from last use)
    vi.advanceTimersByTime(6 * 60 * 1000)

    // Should be disposed now
    expect(isPyodideInitialized()).toBe(false)
  })

  test('should reinitialize after disposal', async () => {
    vi.useFakeTimers()

    mockPyodide.runPythonAsync.mockResolvedValue(42)

    // First use
    await runPythonCode('1+1')
    const firstCallCount = mockLoadPyodide.mock.calls.length

    // Dispose
    vi.advanceTimersByTime(16 * 60 * 1000)
    expect(isPyodideInitialized()).toBe(false)

    // Use again
    await runPythonCode('2+2')

    // Should have reinitialized
    expect(isPyodideInitialized()).toBe(true)
    expect(mockLoadPyodide.mock.calls.length).toBeGreaterThan(firstCallCount)
  })
})
