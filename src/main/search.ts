
import { BrowserWindow } from 'electron'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import PQueue from 'p-queue'
import { LocalSearchResponse, LocalSearchResult } from '../types/index'
import { deleteFile } from './file'
import { getTextContent } from './text'
import { getCleanUserAgent } from './utils'

const grabGoogleResults = `
  const results = []
  const search = document.getElementById("search")
  if (!search) {
    const el = document.querySelector('#recaptcha')
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

export default class LocalSearch {

  private searchWindow: BrowserWindow | null = null
  private searchQueue: PQueue

  constructor() {
    // Initialize queue with concurrency of 1 and 30 second timeout
    this.searchQueue = new PQueue({
      concurrency: 1,
      timeout: 30000,
      throwOnTimeout: true,
    })

    // Add event listeners for observability
    this.searchQueue.on('active', () => {
      console.log(`[search] Queue became active. Size: ${this.searchQueue.size}, Pending: ${this.searchQueue.pending}`)
    })

    this.searchQueue.on('idle', () => {
      console.log('[search] Queue became idle')
    })
  }

  public async test(): Promise<boolean> {

    try {
      
      const response = await this.searchQueue.add(() => this.doSearch('What is Witsy?', 1, true))
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

  public search(query: string, num: number = 5, testMode: boolean = false, abortSignal?: AbortSignal): Promise<LocalSearchResponse> {
    return this.searchQueue.add(() => this.doSearch(query, num, testMode, abortSignal))
  }

  private doSearch(query: string, num: number = 5, testMode: boolean = false, abortSignal?: AbortSignal): Promise<LocalSearchResponse> {

    return new Promise((resolve, reject) => {

      // Check if already aborted
      if (abortSignal?.aborted) {
        reject(new Error('Operation cancelled'))
        return
      }

      //const url = 'https://2captcha.com/demo/recaptcha-v2'
      const url = `https://www.google.com/search?q=${encodeURIComponent(query)}`

      // get or create the persistent search window
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

      // get ready to grab the results
      win.webContents.on('did-finish-load', async () => {

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
            if (testMode) {
              win.hide()
            }
            reject({ error: googleResults === 'captcha'
              ? 'Inform the user that a CAPTCHA mechanism is preventing search to work. They need to go Settings | Plugins | Web Search and click the "Test local search" button'
              : 'An unknown error happened while trying to search locally. Please try again later.'
            })
            return
          }

          // log
          console.log(`[search] found ${googleResults.length} results`)

          // hide window in test mode after results are extracted
          if (testMode) {
            win.hide()
          }

          // in real mode, set up random click on a result (5-10 seconds delay)
          // Only do this if no more searches are queued
          if (!testMode && googleResults.length > 0 && this.searchQueue.size === 0) {
            const randomDelay = 5000 + Math.random() * 5000 // 5-10 seconds
            const randomIndex = Math.floor(Math.random() * googleResults.length)
            setTimeout(() => {
              // click the random result
              win.webContents.executeJavaScript(`
                const links = document.querySelectorAll("#search a");
                if (links[${randomIndex}]) {
                  links[${randomIndex}].click();
                }
              `).catch(err => {
                console.error('[search] failed to click result:', err)
              })
            }, randomDelay)
          } else if (!testMode && googleResults.length > 0) {
            console.log('[search] Skipping random click, more searches queued')
          }

          // now iterate
          const urls = new Set()
          const results: LocalSearchResult[] = []
          for (const result of googleResults) {

            // unique url
            if (urls.has(result.url)) continue
            urls.add(result.url)

            // now get content
            try {

              // get full content
              const { title, content } = await this.getContents(result.url)
              result.title = title || result.title
              result.content = content
            }

            catch (e) {
              console.error(`Error while getting content for ${result.url}`, e)
              continue
            }

            // add
            if (result.content.length) {
              results.push(result)
              if (results.length >= num) {
                break
              }
            }
          }

          // done
          if (!hasResolved) {
            hasResolved = true
            resolve({ results })
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

  protected getContents(url: string): Promise<LocalSearchResult> {

    return new Promise((resolve, reject) => {

      // log
      console.log(`[search] getting contents for ${url}`)

      // open a new window
      const win = this.openHiddenWindow()

      // flag to track if we've already resolved
      let hasResolved = false
      
      // handle downloads (for file URLs)
      win.webContents.session.on('will-download', (event, item) => {
        
        // only handle if not already resolved
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
                resolve({ url, title: item.getFilename(), content: text })
                deleteFile(item.getSavePath())
              } catch (e) {
                console.error(`[search] error reading downloaded file ${item.getSavePath()}: ${e}`)
                hasResolved = true
                reject(e)
                deleteFile(item.getSavePath())
              }
            
            } else if (state === 'cancelled') {

              hasResolved = true
              reject(new Error(`Download failed with state: ${state}`))
              deleteFile(item.getSavePath())
            }
            

          } finally {

            this.tryCloseWindow(win)

          }

        })
      })

      // get ready to grab the contents (for regular HTML pages)
      win.webContents.on('dom-ready', async () => {
        
        // only one resolve
        if (hasResolved) {
          return
        }
        
        try {
          const title = await win.webContents.executeJavaScript(`document.title`)
          const html = await win.webContents.executeJavaScript(`document.body.outerHTML`)
          hasResolved = true
          resolve({ url, title, content: html })
        } catch (e) {
          hasResolved = true
          reject(e)
        } finally {
          this.tryCloseWindow(win)
        }
      })

      //  catch errors
      win.webContents.on('did-fail-load', (_event, errorCode, errorDescription) => {

        // only one resolve
        if (hasResolved) {
          return
        }

        try {
          console.error(`[search] failed to load ${url}: ${errorDescription} (${errorCode})`)
          hasResolved = true
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
    if (!this.searchWindow || this.searchWindow.isDestroyed()) {
      this.searchWindow = this.createSearchWindow()
    }
    return this.searchWindow
  }

  protected createSearchWindow(): BrowserWindow {

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

    // done
    return win

  }

  protected tryCloseWindow(win: BrowserWindow) {
    try {
      win?.close()
    } catch { /* empty */ }
  }

}
