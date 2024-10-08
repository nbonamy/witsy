
import path from 'path'
import fs from 'fs'

export default class {

  delay: number
  filepath: string
  filesize: number
  callback: CallableFunction
  timer: NodeJS.Timeout
  
  constructor(callback: CallableFunction, delay = 1000) {
    this.callback = callback
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
        this.notify(filepath)
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

  notify(filepath: string): void {

    // log
    const filename = path.basename(filepath)
    console.log(`File ${filename} modified. Notifying`)

    // callback
    this.callback()

  }

}
