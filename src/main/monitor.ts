import fs, { FSWatcher } from 'fs'
import crypto from 'crypto'

export default class {

  filepath: string
  fileDigest: string
  callback: CallableFunction
  timeout: NodeJS.Timeout
  watcher: FSWatcher
  
  constructor(callback: CallableFunction) {
    this.callback = callback
  }

  start(filepath: string): void {

    // same?
    if (this.filepath === filepath) {
      return
    }

    // clear
    this.stop()
    
    // init
    this.timeout = null
    this.filepath = filepath
    this.fileDigest = this.calculateDigest()

    // start
    this.watcher = fs.watch(filepath, async () => {
      const digest = this.calculateDigest()
      if (digest !== this.fileDigest) {
        this.fileDigest = digest
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

  calculateDigest(): string {
    try {
      const fileContent = fs.readFileSync(this.filepath, 'utf8')
      return crypto.createHash('md5').update(fileContent).digest('hex')
    } catch {
      return ''
    }
  }

   
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  notify(filepath: string): void {

    // log
    // console.log(`File ${filepath} modified. Notifying`)

    // callback
    this.callback()

  }

}
