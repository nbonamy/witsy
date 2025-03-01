
import path from 'path'
import fs, { FSWatcher, Stats } from 'fs'

export default class {

  filepath: string
  filestats: Stats
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
    this.filestats = this.stats()

    // start
    this.watcher = fs.watch(filepath, async () => {
      const stats = this.stats()
      if (stats.size !== this.filestats.size || stats.mtimeMs !== this.filestats.mtimeMs) {
        this.filestats = stats
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
  }

  stats(): Stats {
    try {
      return fs.statSync(this.filepath)
    } catch {
      //console.error('Error while getting file size', error)
      return { size: 0, mtimeMs: 0 } as Stats
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  notify(filepath: string): void {

    // log
    // const filename = path.basename(filepath)
    // console.log(`File ${filename} modified. Notifying`)

    // callback
    this.callback()

  }

}
