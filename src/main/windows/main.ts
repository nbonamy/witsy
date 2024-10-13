
import { CreateWindowOpts } from 'types/window';
import { anyDict } from 'types';
import { app, BrowserWindow, shell, dialog } from 'electron';
import { electronStore, createWindow, titleBarOptions } from './index';
import { wait } from '../utils';
import { loadSettings, saveSettings } from '../config';

export let mainWindow: BrowserWindow = null;

export const openMainWindow = (opts: CreateWindowOpts = {}) => {

  // try to show existig one
  if (mainWindow && !mainWindow.isDestroyed()) {
    try {
      mainWindow.show();
      if (mainWindow.isMinimized()) {
        mainWindow.restore();
      }
      mainWindow.focus();
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
    ...titleBarOptions,
    ...opts,
    show: false,
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  // show a tip
  mainWindow.on('close', () => {

    // check
    const config = loadSettings(app);
    if (config.general.tips.trayIcon) {
      const systemTray = process.platform === 'darwin' ? 'menu bar' : 'system tray';
      const message = `You can activate Witsy from the light bulb icon in the ${systemTray}.`;
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

  // open links in default browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  // open the DevTools
  if (process.env.DEBUG) {
    mainWindow.webContents.openDevTools();
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

export const openChatWindow = (params: anyDict) => {

  // always open
  const chatWindow = createWindow({
    width: 600,
    height: 600,
    ...titleBarOptions,
    queryParams: params,
  });

  // open the DevTools
  if (process.env.DEBUG) {
    //chatWindow.webContents.openDevTools();
  }

  // show in dock
  if (process.platform === 'darwin') {
    app.dock.show();
  }

  // done
  return chatWindow;

};

export const openSettingsWindow = () => {

  try {
    // send signal to current window
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('show-settings');
      return;
    }
  } catch (error) {
    console.error('Error while sending show-settings signal', error);
  }

  try {
    openMainWindow({ queryParams: { settings: true }});
    return;
  } catch (error) {
    console.error('Error while opening main window to show settings', error);
  }

}
