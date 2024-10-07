
import { OnlineStorageProvider } from 'types'
import GoogleDrive from './gdrive'
import { App } from 'electron'

export default class OnlineStorage implements OnlineStorageProvider {

  app: App
  providers: OnlineStorageProvider[]

  constructor(app: App) {
    this.app = app
    this.providers = []
  }

  async initialize() : Promise<void> {
    this.checkGoogle(this.app)
  }

  private checkGoogle(app: App) {
    const gdrive = new GoogleDrive(app)
    if (gdrive.isSetup()) {
      this.providers.push(gdrive)
    }
  }

  monitor(filepath: string): void {
    for (const provider of this.providers) {
      provider.monitor(filepath)
    }
  }
  
  async download(filepath: string): Promise<string> {
    return ''
  }
  
  async upload(filepath: string): Promise<boolean> {
    let rc = true
    for (const provider of this.providers) {
      if (!await provider.upload(filepath)) {
        rc = false
      }
    }
    return rc
  }

}
