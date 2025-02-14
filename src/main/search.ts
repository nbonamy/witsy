
import { BrowserWindow } from 'electron'

const grabGoogleResults = `
  const results = []
  document.querySelectorAll(".g").forEach((result) => {
    const title = result.querySelector("h3")
    const link = result.querySelector("a")
    const url = link?.getAttribute("href")
    const item = {
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

  public search(query: string, num: number = 5): Promise<LocalSearchResult[]> {

    return new Promise((resolve, reject) => {

      const url = `https://www.google.com/search?q=${encodeURIComponent(query)}`;

      // open a new window
      const win = this.openHiddenWindow();

      // get ready to grab the results
      win.webContents.on('did-finish-load', async () => {

        try {
        
          // get the results
          const googleResults: LocalSearchResult[] = await win.webContents.executeJavaScript(grabGoogleResults)
          //console.log(googleResults)

          // now iterate
          const urls = new Set()
          const results: LocalSearchResult[] = []
          for (const result of googleResults) {

            // unique url
            if (urls.has(result.url)) continue
            urls.add(result.url)

            // now get content
            try {
              result.content = await this.getContents(result.url)
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
          resolve(results)

        } catch (e) {

          // done
          reject(e)

        }
      
      })

      // now load
      win.loadURL(url);

    })

  }

  protected getContents(url: string): Promise<string> {

    return new Promise((resolve, reject) => {

      // open a new window
      const win = this.openHiddenWindow();

      // get ready to grab the contents
      win.webContents.on('did-finish-load', async () => {
        
        try {
          const html = await win.webContents.executeJavaScript(`document.body.outerHTML`)
          resolve(html)
        } catch (e) {
          reject(e)
        }
      
      })

      // now load
      win.loadURL(url);

    })

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
      },
    });

    // done
    return win;

  }




}


