
import { BrowserWindow } from 'electron'
import { LocalSearchResponse, LocalSearchResult } from 'types/index'
import { getTextContent } from './text'
import { getCleanUserAgent } from './utils'
import { Mutex } from './sync'

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

        win.webContents.once('did-navigate', () => {
          // After navigation, hide the window again
          win.hide()
        })

        // In real mode, set up random click on a result (5-10 seconds delay)
        if (!testMode && results.length > 0) {
          const randomDelay = 5000 + Math.random() * 5000
          const randomIndex = Math.floor(Math.random() * results.length)
          setTimeout(() => {
            // Ensure window is hidden before and after click
            win.hide()
            win.webContents.executeJavaScript(`
              const links = document.querySelectorAll("#search a");
              if (links[${randomIndex}]) {
                links[${randomIndex}].click();
              }
            `).catch(() => {
              // Silently ignore - page may have navigated away
            })
            // Keep it hidden after navigation
            setTimeout(() => win.hide(), 500)
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

    // Helper to create timeout promise
    const createTimeout = (ms: number): Promise<never> => {
      return new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Timeout')), ms)
      )
    }

    // Fetch content for one URL using native fetch
    const fetchOne = async (result: LocalSearchResult): Promise<void> => {
      try {
        console.log(`[search] fetching contents for ${result.url}`)

        // Race between fetch and 5-second timeout
        const response = await Promise.race([
          fetch(result.url, { signal: abortSignal }),
          createTimeout(5000)
        ])

        const contentType = response.headers.get('content-type') || ''

        if (contentType.includes('text/html')) {
          // HTML content
          const html = await response.text()
          result.html = html
          // Title is already set from Google results
          results.push(result)
        } else {
          // PDF or other file - download and extract text
          const arrayBuffer = await response.arrayBuffer()
          const base64 = Buffer.from(arrayBuffer).toString('base64')
          const mimeType = contentType.split('/')[1] || 'pdf'
          const text = await getTextContent(base64, mimeType)
          result.content = text
          if (text.length > 0) {
            results.push(result)
          }
        }
      } catch (e) {
        // Timeout, abort, or error - log and skip
        console.error(`Error while getting content for ${result.url}`, e)
      }
    }

    // Fetch in batches until we have enough results
    let queueIndex = 0
    while (queueIndex < queue.length && results.length < num) {
      if (abortSignal?.aborted) break

      // Determine batch size: how many more results we need
      const batchSize = num - results.length
      const batch = queue.slice(queueIndex, queueIndex + batchSize)
      queueIndex += batchSize

      // Fetch this batch in parallel
      await Promise.allSettled(batch.map(result => fetchOne(result)))
    }

    return results.slice(0, num)
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

}
