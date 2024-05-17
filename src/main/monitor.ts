
import { BrowserWindow } from 'electron'
import fs from 'fs'

export default class {

  delay: number
  filepath: string
  filesize: number
  signal: string
  timer: NodeJS.Timeout
  
  constructor(signal: string, delay = 1000) {
    this.signal = signal
    this.delay = delay
  }

  start(filepath: string): void {

    // clear
    this.stop()
    
    // init
    this.filepath = filepath
    this.filesize = this.size()

    // start
    this.timer = setInterval(() => {
      const size = this.size()
      if (size !== this.filesize) {
        this.filesize = size
        this.notify()
      }
    }, this.delay)
  }

  stop(): void {
    clearInterval(this.timer)
    this.timer = null
    this.filepath = null
    this.filesize = 0
  }

  size(): number {
    try {
      return fs.statSync(this.filepath).size
    } catch (error) {
      //console.error('Error while getting file size', error)
      return 0
    }
  }

  notify(): void {

    // log
    console.log(`File modified. Sending ${this.signal} signal`)

    // notify all active windows
    try {
      const windows = BrowserWindow.getAllWindows()
      for (const window of windows) {
        try {
          if (!window.isDestroyed()) {
            window.webContents.send('file-modified', this.signal)
          }
        } catch (error) {
          console.error('Error while notifying file modification', error)
        }
      }
    } catch (error) {
      console.error('Error while notifying file modification', error)
    }
  }

}
