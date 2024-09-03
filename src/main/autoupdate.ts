
import { app, autoUpdater, dialog } from 'electron';

export default class {

  manualUpdate = false
  downloading = false

  constructor(public hooks: {
    preUpdate?: () => void;
  }) {
    this.install();
  }

  install = () => {

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

      // done
      console.log('Update downloaded', event, releaseNotes, releaseName)
      this.downloading = false
      
      // dialog
      const dialogOpts: Electron.MessageBoxOptions = {
        type: 'info',
        buttons: ['Restart', 'Later'],
        title: 'Application Update',
        message: process.platform === 'win32' ? releaseNotes : releaseName,
        detail: 'A new version has been downloaded. Restart the application to apply the updates.'
      }

      // show dialog
      dialog.showMessageBox(dialogOpts).then((returnValue) => {
        if (returnValue.response === 0) {
          autoUpdater.quitAndInstall()
        }
      })
    })

    // before quit for update
    autoUpdater.on('before-quit-for-update', () => {
    })

    // check now and schedule
    autoUpdater.checkForUpdates()
    setInterval(() => {
      console.log('Scheduled update-check')
      this.manualUpdate = false;
      autoUpdater.checkForUpdates()
    }, 60*60*1000)
  
  }

  check = () => {
    console.log('check')
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
}
