
import { CreateWindowOpts } from 'types/window';
import { app, BrowserWindow, dialog } from 'electron';
import { electronStore, createWindow, titleBarOptions, ensureOnCurrentScreen } from './index';
import { wait } from '../utils';
import { loadSettings, saveSettings } from '../config';

export let mainWindow: BrowserWindow = null;

export const openMainWindow = (opts: CreateWindowOpts = {}) => {

  // try to show existig one
  if (mainWindow && !mainWindow.isDestroyed()) {
    try {
      ensureOnCurrentScreen(mainWindow);
      mainWindow.show();
      if (mainWindow.isMinimized()) {
        mainWindow.restore();
      }
      mainWindow.focus();
      if (opts.queryParams) {
        mainWindow.webContents.send('query-params', opts.queryParams);
      }
      return
    } catch (error) {
      console.error('Error while showing main window', error);
    }
  }

  // get bounds from here
  const bounds: Electron.Rectangle = electronStore?.get('bounds') as Electron.Rectangle;

  // else open a new one
  mainWindow = createWindow({
    x: bounds?.x,
    y: bounds?.y,
    width: bounds?.width ?? 1400,
    height: bounds?.height ?? 800,
    minWidth: 800,
    title: 'Witsy',
    ...titleBarOptions(),
    ...opts,
  });

  // check
  ensureOnCurrentScreen(mainWindow);

  // show a tip
  mainWindow.on('close', () => {

    // check
    const config = loadSettings(app);
    if (config.general.tips.trayIcon === undefined || config.general.tips.trayIcon === true) {
      const trayIconDesc = process.platform === 'win32' ? 'the icon in the system tray' : 'the fountain pen icon in the menu bar';
      const message = `You can activate Witsy from ${trayIconDesc}.`;
      const options = {
        buttons: ['OK'],
        message: message,
      };

      // show
      dialog.showMessageBoxSync(null, options);

      // save
      config.general.tips.trayIcon = false;
      saveSettings(app, config);

    }

    // save bounds    
    electronStore.set('bounds', mainWindow.getBounds());

  })

  // open the DevTools
  if (process.env.DEBUG) {
    mainWindow.webContents.openDevTools({ mode: 'right' });
  }

  // show in dock
  if (process.platform === 'darwin') {
    app.dock.show();
  }

};

export const closeMainWindow = async () => {
  try {
    if (mainWindow && !mainWindow.isDestroyed()) {
      // console.log('Closing main window')
      mainWindow?.close()
      await wait();
    }
  } catch (error) {
    console.error('Error while closing main window', error);
  }
  mainWindow = null;
}

export const isMainWindowFocused = () => {
  return mainWindow && !mainWindow.isDestroyed() && mainWindow.isFocused();
}

export const openSettingsWindow = () => {
  try {
    openMainWindow({ queryParams: { settings: true }});
    return;
  } catch (error) {
    console.error('Error while opening main window to show settings', error);
  }
}
