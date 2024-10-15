
import { app, autoUpdater, dialog } from 'electron';

export default class {

  manualUpdate = false
  downloading = false
  updateAvailable = false

  constructor(public hooks: {
    onUpdateAvailable: () => void
    preInstall: () => void
  }) {
    this.initialize();
  }

  private initialize = () => {

    // basic setup
    const server = 'https://update.electronjs.org'
    const feed = `${server}/nbonamy/witsy/${process.platform}-${process.arch}/${app.getVersion()}`
    console.log('Checking for updates at', feed)
    autoUpdater.setFeedURL({ url: feed })

    // error
    autoUpdater.on('error', (error) => {
      console.error('Error while checking for updates', error)
      this.downloading = false
      if (this.manualUpdate) {
        dialog.showErrorBox('Witsy', 'Error while checking for updates. Please try again later.')
      } 
    })

    // checking
    autoUpdater.on('checking-for-update', (event: any) => {
      console.log('Checking for updates', event)
    })

    // available
    autoUpdater.on('update-available', (event: any) => {
      console.log('Update available. Downloading…', event)
      this.downloading = true
      if (this.manualUpdate) {
        dialog.showMessageBox({
          type: 'info',
          message: 'Witsy',
          detail: 'A new version is available. Downloading now…'
        })
      }
    })

    // not available
    autoUpdater.on('update-not-available', (event: any) => {
      if (!this.downloading) {
        console.log('Update not available', event)
        if (this.manualUpdate) {
          dialog.showMessageBox({
            type: 'info',
            message: 'Witsy',
            detail: 'You are already using the latest version of Witsy.',
          })
        }
      }
    })

    // downloaded
    autoUpdater.on('update-downloaded', (event, releaseNotes, releaseName) => {
      console.log('Update downloaded', event, releaseNotes, releaseName)
      this.downloading = false
      this.updateAvailable = true
      this.hooks.onUpdateAvailable?.()
    })
      
    // before quit for update
    autoUpdater.on('before-quit-for-update', () => {
      this.hooks.preInstall?.()
    })

    // check now and schedule
    autoUpdater.checkForUpdates()
    setInterval(() => {
      console.log('Scheduled update-check')
      this.manualUpdate = false;
      autoUpdater.checkForUpdates()
    }, 60*60*1000)

    // debug
    // setTimeout(() => {
    //   this.updateAvailable = true;
    //   this.hooks.onUpdateAvailable?.();
    // }, 5000)
  
  }

  check = () => {
    if (this.downloading) {
      dialog.showMessageBox({
        type: 'info',
        message: 'Witsy',
        detail: 'An update is in progress. Please wait for it to complete.',
      })
    } else {
      this.manualUpdate = true;
      autoUpdater.checkForUpdates()
    }
  }

  install = () => {
    if (this.updateAvailable) {
      console.log('Applying update')
      autoUpdater.quitAndInstall()
    }
  }

}
