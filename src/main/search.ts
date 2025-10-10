
import { BrowserWindow } from 'electron'
import { getTextContent } from './text'
import { deleteFile } from './file'
import { getCleanUserAgent } from './utils'
import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'

const grabGoogleResults = `
  const results = []
  const search = document.getElementById("search")
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
`

export type LocalSearchResult = {
  url: string
  title: string
  content: string
}

export default class LocalSearch {

  public async test(): Promise<boolean> {

    try {
      
      const results = await this.search('What is Witsy?', 1, true)
      console.log('Test search results:', results.map(r => r.url))
      if (results.length > 0) {
        return true
      }
    } catch (e) {
      console.error('Test search error:', e)
    }

    // too bad
    return false
  
  }

  public search(query: string, num: number = 5, testMode: boolean = false, abortSignal?: AbortSignal): Promise<LocalSearchResult[]> {

    return new Promise((resolve, reject) => {

      // Check if already aborted
      if (abortSignal?.aborted) {
        reject(new Error('Operation cancelled'))
        return
      }

      //const url = 'https://2captcha.com/demo/recaptcha-v2'
      const url = `https://www.google.com/search?q=${encodeURIComponent(query)}`

      // open a new window
      const win = this.openHiddenWindow(testMode)

      // Track if we've resolved/rejected to avoid double resolution
      let hasResolved = false

      // Set up abort listener
      abortSignal?.addEventListener('abort', () => {
        if (!hasResolved) {
          hasResolved = true
          this.tryCloseWindow(win)
          reject(new Error('Operation cancelled'))
        }
      }, { once: true })

      // get ready to grab the results
      win.webContents.on('did-finish-load', async () => {

        // Check abort before processing
        if (abortSignal?.aborted) {
          if (!hasResolved) {
            hasResolved = true
            this.tryCloseWindow(win)
            reject(new Error('Operation cancelled'))
          }
          return
        }

        try {
        
          // const html = await win.webContents.executeJavaScript(`document.documentElement.innerHTML`, true)
          // fs.writeFileSync('page.html', html, 'utf8')

          // get the results
          const googleResults: LocalSearchResult[] = await win.webContents.executeJavaScript(grabGoogleResults)
          console.log(`[search] found ${googleResults.length} results`)

          // close the window now
          this.tryCloseWindow(win)

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
            resolve(results)
          }

        } catch (e) {

          // done
          if (!testMode) {
            this.tryCloseWindow(win)
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
      const win = this.openHiddenWindow(false)

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
        item.once('done', async (event, state) => {

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
      win.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {

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

  protected openHiddenWindow(testMode: boolean): BrowserWindow {

    // open a new window
    const win = new BrowserWindow({
      width: 800,
      height: 600,
      show: testMode,
      frame: testMode,
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
