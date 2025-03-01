
import path from 'path'
import fs, { FSWatcher } from 'fs'

export default class {

  filepath: string
  filesize: number
  callback: CallableFunction
  timeout: NodeJS.Timeout
  watcher: FSWatcher
  
  constructor(callback: CallableFunction) {
    this.callback = callback
  }

  start(filepath: string): void {

    // clear
    this.stop()
    
    // init
    this.timeout = null
    this.filepath = filepath
    this.filesize = this.size()

    // start
    this.watcher = fs.watch(filepath, async () => {
      const size = this.size()
      if (size !== this.filesize) {
        this.filesize = size
        clearTimeout(this.timeout)
        this.timeout = setTimeout(() => {
          this.notify(filepath)
        }, 200)
      }
    })
  }

  stop(): void {
    this.watcher?.close()
    this.watcher = null
    this.filepath = null
    this.filesize = 0
  }

  size(): number {
    try {
      return fs.statSync(this.filepath).size
    } catch {
      //console.error('Error while getting file size', error)
      return 0
    }
  }

  notify(filepath: string): void {

    // log
    const filename = path.basename(filepath)
    console.log(`File ${filename} modified. Notifying`)

    // callback
    this.callback()

  }

}
