
import { CreateWindowOpts } from 'types/window';
import { app, BrowserWindow, dialog } from 'electron';
import { electronStore, createWindow, titleBarOptions, ensureOnCurrentScreen } from './index';
import { loadSettings, saveSettings } from '../config';
import { useI18n } from '../i18n';

const storeBoundsId = 'main.bounds'

export let mainWindow: BrowserWindow = null;

export const openMainWindow = (opts: CreateWindowOpts = {}): void => {

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
  const bounds: Electron.Rectangle = electronStore?.get(storeBoundsId) as Electron.Rectangle;

  // else open a new one
  mainWindow = createWindow({
    title: useI18n(app)('common.chat'),
    x: bounds?.x,
    y: bounds?.y,
    width: bounds?.width ?? 1400,
    height: bounds?.height ?? 800,
    minWidth: 800,
    minHeight: 600,
    ...titleBarOptions({
      height: 48,
    }),
    showInDock: true,
    ...opts,
  });

  // check
  ensureOnCurrentScreen(mainWindow);

  // focus
  app.focus({ steal: true });
  mainWindow.focus();

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
    try {
      electronStore.set(storeBoundsId, mainWindow.getBounds());
    } catch { /* empty */ }

  })

  mainWindow.on('closed', () => {
    mainWindow = null;
  })

  // open the DevTools
  if (process.env.DEBUG) {
    mainWindow.webContents.openDevTools({ mode: 'right' });
  }

};

// only available for test purposes
export const closeMainWindow = (): void => {
  if (!process.env.TEST) {
    console.error('closeMainWindow is only available for test purposes');
  }
  mainWindow = null;
}

export const isMainWindowFocused = () => {
  return mainWindow && !mainWindow.isDestroyed() && mainWindow.isFocused();
}
