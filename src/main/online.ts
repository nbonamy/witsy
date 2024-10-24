
import { OnlineStorageProvider } from 'types/index.d'
import { App } from 'electron'
import { settingsFilePath } from './config'
import { historyFilePath } from './history'
import GoogleDrive from './gdrive'
import Monitor from './monitor'
import fs from 'fs'

export default class OnlineConfig {

  app: App
  monitors: { [key: string]: Monitor }
  timers: { [key: string]: NodeJS.Timeout }
  provider: OnlineStorageProvider

  constructor(app: App) {
    this.app = app
    this.provider = null
    this.monitors = {}
    this.timers = {}
  }

  async initialize() : Promise<void> {
    this.provider = this.checkGoogle()
    if (this.provider) {
      await this.provider.initialize()
      this.initializeWatchers()
    }
  }

  private checkGoogle(): OnlineStorageProvider {
    const gdrive = new GoogleDrive(this.app)
    return gdrive.isSetup() ? gdrive : null
  }

  private initializeWatchers() {
    this.initializeWatcher(settingsFilePath(this.app))
    this.initializeWatcher(historyFilePath(this.app))
  }

  private initializeWatcher(filepath: string) {
    
    // we need only one local monitor
    if (this.monitors[filepath]) {
      return
    }

    // create local and remote
    this.monitors[filepath] = new Monitor(() => this.checkSync(filepath))
    this.timers[filepath] = setInterval(() => this.checkSync(filepath), 1000*60*5)

    // and check now
    this.checkSync(filepath)

  }

  private async checkSync(filepath: string): Promise<void> {

    try {

      // check if it exists
      const existsLocal = fs.existsSync(filepath)
      const metadata = await this.provider.metadata(filepath)

      // if it exists nowhere then...
      if (!existsLocal && !metadata) {
        return
      }

      // if it does not exist locally then...
      if (!existsLocal) {
        return this.download(filepath, metadata.modifiedTime)
      }
      
      // get the local stats
      const local = await fs.promises.stat(filepath)

      // if it does not exist remotely then...
      if (!metadata) {
        return this.upload(filepath, local.mtime)
      }

      // needed
      const remoteModifiedTime = metadata.modifiedTime
      const localModifiedTime = local.mtime

      // compare
      if (localModifiedTime.getTime() > remoteModifiedTime.getTime()) {
        return this.upload(filepath, localModifiedTime)
      } else if (localModifiedTime.getTime() < remoteModifiedTime.getTime()) {
        return this.download(filepath, remoteModifiedTime)
      }

    } catch (error) {
      console.error(`Error checking sync status for ${filepath}`, error)
    }    

  }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    private async download(filepath: string, modifiedTime: Date): Promise<void> {
    try {
      console.log(`Remote version for ${filepath} is newer. Downloading`)
      //const contents = await this.provider.download(filepath)
      //fs.writeFileSync(filepath, contents)
    } catch (err) {
      console.error(`Error downloading ${filepath}`, err)
    }
  }

  private async upload(filepath: string, modifiedTime: Date): Promise<void> {
    try {
      console.log(`Local version for ${filepath} is newer. Uploading`)
      await this.provider.upload(filepath, modifiedTime)
    } catch (err) {
      console.error(`Error uploading ${filepath}`, err)
    }
  }
  
}
