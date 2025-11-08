
import { BrowserWindow } from 'electron'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import { LocalSearchResponse, LocalSearchResult } from '../types/index'
import { deleteFile } from './file'
import { getTextContent } from './text'
import { getCleanUserAgent } from './utils'
import { Mutex, Semaphore } from './sync'

const MAX_CONCURRENT_FETCHES = 8
const MAX_CONCURRENT_CONTENT_WINDOWS = 20

const grabGoogleResults = `
  const results = []
  const search = document.getElementById("search")
  if (!search) {
    const el = document.querySelector('#recaptcha') ?? document.querySelector('#g-recaptcha') ?? document.querySelector('#hcaptcha-demo')
    el ? 'captcha' : 'unknown'
  } else {
    search.querySelectorAll("a").forEach((link) => {
      const title = link.querySelector("h3")
      const url = link.getAttribute("href")
      const item = {
        el: link.outerHTML,
        title: title?.textContent || "",
        url,
      }
      if (!item.title || !item.url) return
      results.push(item)
    })
    results
  }
`

// Shared search window and mutex across all LocalSearch instances
let sharedSearchWindow: BrowserWindow | null = null
const searchWindowMutex = new Mutex()
const contentWindowSemaphore = new Semaphore(MAX_CONCURRENT_CONTENT_WINDOWS)

export default class LocalSearch {

  public async test(): Promise<boolean> {

    try {
      
      const response = await this.search('What is Witsy?', 1, true)
      console.log('Test search results:', response.results?.map(r => r.url))
      if (response.results?.length > 0) {
        return true
      }
    } catch (e) {
      console.error('Test search error:', e)
    }

    // too bad
    return false
  
  }

  public async search(query: string, num: number = 5, testMode: boolean = false, abortSignal?: AbortSignal): Promise<LocalSearchResponse> {

    // Check if already aborted
    if (abortSignal?.aborted) {
      throw new Error('Operation cancelled')
    }

    // Acquire mutex for Google search phase only
    const release = await searchWindowMutex.acquire()

    try {
      // Get Google search results (critical section - uses shared window)
      const googleResults = await this.getGoogleResults(query, testMode, abortSignal)

      // Release mutex immediately - we're done with the shared search window
      release()

      // Fetch content in parallel (no lock needed - each uses its own window)
      const results = await this.fetchContentForResults(googleResults, num, abortSignal)

      return { results }

    } catch (error) {
      release()
      throw error
    }
  }

  private getGoogleResults(query: string, testMode: boolean = false, abortSignal?: AbortSignal): Promise<LocalSearchResult[]> {

    return new Promise((resolve, reject) => {

      // Check if already aborted
      if (abortSignal?.aborted) {
        reject(new Error('Operation cancelled'))
        return
      }

      // const url = 'https://accounts.hcaptcha.com/demo'
      const url = `https://www.google.com/search?q=${encodeURIComponent(query)}`

      // get or create the shared search window
      const win = this.getOrCreateSearchWindow()

      // show window in test mode
      if (testMode) {
        win.show()
      }

      // Track if we've resolved/rejected to avoid double resolution
      let hasResolved = false

      // Set up abort listener
      abortSignal?.addEventListener('abort', () => {
        if (!hasResolved) {
          hasResolved = true
          if (testMode) {
            win.hide()
          }
          reject(new Error('Operation cancelled'))
        }
      }, { once: true })

      // Helper function to process results (happy path)
      const processResults = (results: LocalSearchResult[]) => {
        console.log(`[search] found ${results.length} results for ${query}`)

        // Hide window in test mode after results are extracted
        if (testMode) {
          win.hide()
        }

        // In real mode, set up random click on a result (5-10 seconds delay)
        if (!testMode && results.length > 0) {
          // Ensure window stays hidden even after the random click navigates
          win.webContents.once('did-navigate', () => {
            win.hide()
          })

          const randomDelay = 5000 + Math.random() * 5000
          const randomIndex = Math.floor(Math.random() * results.length)
          setTimeout(() => {
            win.webContents.executeJavaScript(`
              const links = document.querySelectorAll("#search a");
              if (links[${randomIndex}]) {
                links[${randomIndex}].click();
              }
            `).catch(() => {
              // Silently ignore - page may have navigated away
            })
          }, randomDelay)
        }

        // Done - return the Google results
        hasResolved = true
        resolve(results)
      }

      // Helper function to handle errors
      const handleError = (errorType: string) => {
        if (testMode) {
          win.hide()
        }
        reject({ error: errorType === 'captcha'
          ? 'Inform the user that a CAPTCHA mechanism is preventing search to work. They need to go Settings | Plugins | Web Search and click the "Test local search" button'
          : 'An unknown error happened while trying to search locally. Please try again later.'
        })
      }

      // get ready to grab the results
      win.webContents.once('did-finish-load', async () => {

        // Check abort before processing
        if (abortSignal?.aborted) {
          if (!hasResolved) {
            hasResolved = true
            if (testMode) {
              win.hide()
            }
            reject(new Error('Operation cancelled'))
          }
          return
        }

        try {
        
          // const html = await win.webContents.executeJavaScript(`document.documentElement.innerHTML`, true)
          // fs.writeFileSync('page.html', html, 'utf8')

          // get the results
          const googleResults: LocalSearchResult[] = await win.webContents.executeJavaScript(grabGoogleResults)
          if (!Array.isArray(googleResults)) {

            // Captcha detected - show window and wait for user to solve
            if (googleResults === 'captcha') {
              win.show()

              // Set up listeners for retry (did-finish-load) and cancel (close)
              const retryHandler = async () => {
                
                // Check abort before processing retry
                if (abortSignal?.aborted) {
                  if (!hasResolved) {
                    hasResolved = true
                    win.hide()
                    reject(new Error('Operation cancelled'))
                  }
                  return
                }

                try {
                  // Hide window after captcha solved (unless test mode)
                  if (!testMode) {
                    win.hide()
                  }

                  // Try to grab results again
                  const retryResults: LocalSearchResult[] = await win.webContents.executeJavaScript(grabGoogleResults)

                  if (!hasResolved) {
                    // Clean up close listener
                    win.removeListener('close', closeHandler)

                    if (!Array.isArray(retryResults)) {
                      // Failed again - reject with appropriate error
                      hasResolved = true
                      handleError(retryResults)
                    } else {
                      // Success! Process results
                      processResults(retryResults)
                    }
                  }
                } catch (e) {
                  if (!hasResolved) {
                    hasResolved = true
                    win.removeListener('close', closeHandler)
                    reject(e)
                  }
                }
              }

              const closeHandler = () => {
                if (!hasResolved) {
                  hasResolved = true
                  win.webContents.removeListener('did-finish-load', retryHandler)
                  reject(new Error('User cancelled captcha challenge'))
                }
              }

              // Set up abort listener for captcha wait state
              const abortHandler = () => {
                if (!hasResolved) {
                  hasResolved = true
                  win.webContents.removeListener('did-finish-load', retryHandler)
                  win.removeListener('close', closeHandler)
                  win.hide()
                  reject(new Error('Operation cancelled'))
                }
              }

              win.webContents.once('did-finish-load', retryHandler)
              win.once('close', closeHandler)
              abortSignal?.addEventListener('abort', abortHandler, { once: true })

              return // Don't proceed further - waiting for user action
            }

            // Unknown error - reject immediately
            hasResolved = true
            handleError('unknown')
            return
          }

          // Success! Process results
          if (!hasResolved) {
            processResults(googleResults)
          }

        } catch (e) {

          // hide window in test mode on error
          if (testMode) {
            win.hide()
          }
          if (!hasResolved) {
            hasResolved = true
            reject(e)
          }

        }

      })

      // now load
      win.loadURL(url)

    })

  }

  private async fetchContentForResults(googleResults: LocalSearchResult[], num: number, abortSignal?: AbortSignal): Promise<LocalSearchResult[]> {
    
    // Build queue of unique URLs
    const urls = new Set<string>()
    const queue: LocalSearchResult[] = []
    for (const result of googleResults) {
      if (!urls.has(result.url)) {
        urls.add(result.url)
        queue.push(result)
      }
    }

    const results: LocalSearchResult[] = []
    const inFlight = new Set<Promise<void>>()
    const workerAbortControllers = new Map<Promise<void>, AbortController>()
    let queueIndex = 0
    let cancelled = false

    // Helper to create timeout promise
    const createTimeout = (ms: number): Promise<never> => {
      return new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Timeout')), ms)
      )
    }

    // Worker function to fetch one URL
    const fetchOne = async (result: LocalSearchResult, workerAbortController: AbortController): Promise<void> => {
      if (cancelled || abortSignal?.aborted || workerAbortController.signal.aborted) return

      try {
        // Race between actual fetch and 5-second timeout
        const { title, content } = await Promise.race([
          this.getContents(result.url, workerAbortController.signal),
          createTimeout(5000)
        ])

        if (cancelled || abortSignal?.aborted || workerAbortController.signal.aborted) return

        result.title = title || result.title
        result.content = content

        // Only add if has content
        if (result.content.length) {
          results.push(result)
        }
      } catch (e) {
        // If timeout, abort the worker to close the window
        if (e instanceof Error && e.message === 'Timeout') {
          workerAbortController.abort()
        }

        // Timeout, abort, or error - log and skip
        if (!workerAbortController.signal.aborted) {
          console.error(`Error while getting content for ${result.url}`, e)
        }
      }
    }

    // Launch initial batch of workers
    const maxConcurrent = Math.min(urls.size, Math.min(num * 1.5, MAX_CONCURRENT_FETCHES))
    while (queueIndex < queue.length && inFlight.size < maxConcurrent && !cancelled) {
      const workerAbortController = new AbortController()
      const promise = fetchOne(queue[queueIndex++], workerAbortController)
      inFlight.add(promise)
      workerAbortControllers.set(promise, workerAbortController)

      // When this worker finishes, start next one if needed
      promise.finally(() => {
        inFlight.delete(promise)
        workerAbortControllers.delete(promise)

        // Check if we have enough results
        if (results.length >= num) {
          cancelled = true
          return
        }

        // Start next worker if queue has more
        if (queueIndex < queue.length && !cancelled && !abortSignal?.aborted) {
          const nextWorkerAbortController = new AbortController()
          const nextPromise = fetchOne(queue[queueIndex++], nextWorkerAbortController)
          inFlight.add(nextPromise)
          workerAbortControllers.set(nextPromise, nextWorkerAbortController)
        }
      })
    }

    // Wait for all in-flight requests to complete or until we have enough results
    while (inFlight.size > 0 && !cancelled && !abortSignal?.aborted) {
      await Promise.race(inFlight)
      // Check immediately after a promise completes if we have enough
      if (results.length >= num) {
        // Abort all remaining in-flight workers
        for (const workerAbortController of workerAbortControllers.values()) {
          workerAbortController.abort()
        }
        break
      }
    }

    // Check if aborted
    if (abortSignal?.aborted) {
      throw new Error('Operation cancelled')
    }

    // Return only the requested number of results
    return results.slice(0, num)
  }

  protected async getContents(url: string, abortSignal?: AbortSignal): Promise<LocalSearchResult> {

    // Acquire semaphore permit for window creation
    const releaseSemaphore = await contentWindowSemaphore.acquire()

    return new Promise((resolve, reject) => {

      // Check if already aborted
      if (abortSignal?.aborted) {
        releaseSemaphore()
        reject(new Error('Operation cancelled'))
        return
      }

      // log
      console.log(`[search] getting contents for ${url}`)

      // open a new window
      const win = this.openHiddenWindow()

      // flag to track if we've already resolved
      let hasResolved = false

      // Cleanup helper - closes window and releases semaphore
      const cleanup = () => {
        this.tryCloseWindow(win)
        releaseSemaphore()
      }

      // Set up abort listener
      const abortHandler = () => {
        if (!hasResolved) {
          hasResolved = true
          cleanup()
          reject(new Error('Operation cancelled'))
        }
      }
      abortSignal?.addEventListener('abort', abortHandler, { once: true })
      
      // handle downloads (for file URLs)
      win.webContents.session.once('will-download', (event, item) => {

        // only handle if not already resolved (dom-ready might have fired first)
        if (hasResolved) {
          event.preventDefault()
          return
        }

        // we don't want to reuse tempPath
        // use item/getSavePath() to ensure unique temp file
        const tempPath = path.join(os.tmpdir(), `witsy-${crypto.randomUUID()}.tmp`)
        item.setSavePath(tempPath)
        
        // handle download completion
        item.once('done', async (_event, state) => {

          try {
          
            // only one resolve
            if (hasResolved) {
              deleteFile(item.getSavePath())
              return
            }

            if (state === 'completed') {

              // mark as resolved
              hasResolved = true

              // for an unkown reason we sometimes received two 'done'/'completed' events
              if (!fs.existsSync(item.getSavePath())) {
                return
              }

              try {
                const content = fs.readFileSync(item.getSavePath(), 'base64')
                const text = await getTextContent(content, item.getMimeType().split('/')[1])
                hasResolved = true
                cleanup()
                resolve({ url, title: item.getFilename(), content: text })
                deleteFile(item.getSavePath())
              } catch (e) {
                console.error(`[search] error reading downloaded file ${item.getSavePath()}: ${e}`)
                hasResolved = true
                cleanup()
                reject(e)
                deleteFile(item.getSavePath())
              }

            } else if (state === 'cancelled') {

              hasResolved = true
              cleanup()
              reject(new Error(`Download failed with state: ${state}`))
              deleteFile(item.getSavePath())
            }
            

          } finally {

            this.tryCloseWindow(win)

          }

        })
      })

      // get ready to grab the contents (for regular HTML pages)
      win.webContents.once('dom-ready', async () => {

        // only one resolve
        if (hasResolved) {
          return
        }

        try {
          const title = await win.webContents.executeJavaScript(`document.title`)
          const html = await win.webContents.executeJavaScript(`document.body.outerHTML`)
          hasResolved = true
          cleanup()
          resolve({ url, title, content: html })
        } catch (e) {
          hasResolved = true
          cleanup()
          reject(e)
        } finally {
          this.tryCloseWindow(win)
        }
      })

      //  catch errors on main frame only
      win.webContents.once('did-fail-load', (_event, errorCode, errorDescription, _validatedURL, isMainFrame) => {

        // only one resolve
        if (hasResolved) {
          return
        }

        // ignore errors from embedded content (ads, trackers, iframes)
        if (!isMainFrame) {
          return
        }

        try {
          console.error(`[search] failed to load ${url}: ${errorDescription} (${errorCode})`)
          hasResolved = true
          cleanup()
          reject(new Error(errorDescription))
        } finally {
          this.tryCloseWindow(win)
        }

      })

      // now load
      win.loadURL(url)

    })

  }

  protected getOrCreateSearchWindow(): BrowserWindow {
    if (!sharedSearchWindow || sharedSearchWindow.isDestroyed()) {
      sharedSearchWindow = this.createSearchWindow()
    }
    return sharedSearchWindow
  }

  protected createSearchWindow(): BrowserWindow {

    // open a new window
    const win = new BrowserWindow({
      width: 800,
      height: 600,
      show: false,
      frame: true,
      focusable: true,
      hiddenInMissionControl: true,
      skipTaskbar: true,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: true,
        autoplayPolicy: 'user-gesture-required',
        disableDialogs: true,
        partition: 'persist:search',
        webSecurity: true,
        allowRunningInsecureContent: false,
        experimentalFeatures: true,
        javascript: true,
      },
    })

    // Set clean user agent (strip Witsy and Electron identifiers)
    const originalUA = win.webContents.session.getUserAgent()
    const cleanUA = getCleanUserAgent(originalUA)
    win.webContents.session.setUserAgent(cleanUA)

    // prevent memory leaks
    win.webContents.setMaxListeners(20)
    win.webContents.session.setMaxListeners(50) // Multiple concurrent downloads

    // suppress console spam from ad trackers and embedded content failures
    win.webContents.on('did-fail-provisional-load', (event) => { event.preventDefault() })
    win.webContents.on('did-fail-load', (event) => { event.preventDefault() })

    // done
    return win

  }

  protected openHiddenWindow(): BrowserWindow {

    // open a new window
    const win = new BrowserWindow({
      width: 800,
      height: 600,
      show: false,
      frame: false,
      focusable: true,
      hiddenInMissionControl: true,
      skipTaskbar: true,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: true,
        autoplayPolicy: 'user-gesture-required',
        disableDialogs: true,
        partition: 'persist:search',
        webSecurity: true,
        allowRunningInsecureContent: false,
        experimentalFeatures: true,
      },
    })

    // Set clean user agent (strip Witsy and Electron identifiers)
    const originalUA = win.webContents.session.getUserAgent()
    const cleanUA = getCleanUserAgent(originalUA)
    win.webContents.session.setUserAgent(cleanUA)

    // prevent memory leaks
    win.webContents.setMaxListeners(20)
    win.webContents.session.setMaxListeners(50) // Multiple concurrent downloads

    // suppress console spam from ad trackers and embedded content failures
    win.webContents.on('did-fail-provisional-load', (event) => { event.preventDefault() })
    win.webContents.on('did-fail-load', (event) => { event.preventDefault() })
    win.webContents.on('certificate-error', (event) => { event.preventDefault() })

    // done
    return win

  }

  protected tryCloseWindow(win: BrowserWindow) {
    if (!win || win.isDestroyed()) {
      return
    }
    try {
      win.close()
      setTimeout(() => {
        if (!win.isDestroyed()) {
          win.destroy()
        }
      }, 500)
    } catch {
      win.destroy()
    }
  }

}
