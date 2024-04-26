
import { app, autoUpdater, dialog } from 'electron';

export default class {

  manualUpdate = false

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
      if (this.manualUpdate) {
        dialog.showErrorBox('Witsy', 'Error while checking for updates. Please try again later.')
      } 
    })

    // available
    autoUpdater.on('update-available', () => {
      console.log('Update available. Downloading…')
      if (this.manualUpdate) {
        dialog.showMessageBox({
          type: 'info',
          message: 'Witsy',
          detail: 'A new version is available. Downloading now…'
        })
      }
    })

    // not available
    autoUpdater.on('update-not-available', () => {
      if (this.manualUpdate) {
        dialog.showMessageBox({
          type: 'info',
          message: 'Witsy',
          detail: 'You are already using the latest version of Witsy.',
        })
      }
    })

    // downloaded
    autoUpdater.on('update-downloaded', (event, releaseNotes, releaseName) => {
      
      const dialogOpts: Electron.MessageBoxOptions = {
        type: 'info',
        buttons: ['Restart', 'Later'],
        title: 'Application Update',
        message: process.platform === 'win32' ? releaseNotes : releaseName,
        detail: 'A new version has been downloaded. Restart the application to apply the updates.'
      }

      dialog.showMessageBox(dialogOpts).then((returnValue) => {
        if (returnValue.response === 0) {
          autoUpdater.quitAndInstall()
        }
      })
    })

    // before quit for update
    autoUpdater.on('before-quit-for-update', () => {
      this.hooks.preUpdate?.()
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
    this.manualUpdate = true;
    autoUpdater.checkForUpdates()
  }

}
