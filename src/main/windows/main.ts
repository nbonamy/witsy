
import { CreateWindowOpts } from 'types/window';
import { app, BrowserWindow, dialog, Menu, MenuItem } from 'electron';
import { electronStore, createWindow, titleBarOptions, ensureOnCurrentScreen } from './index';
import { loadSettings, saveSettings } from '../config';
import { useI18n } from '../i18n';

const storeBoundsId = 'main.bounds'

export let mainWindow: BrowserWindow = null;

export const prepareMainWindow = (opts: CreateWindowOpts = {}): void => {

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
    keepHidden: true,
    showInDock: true,
    ...opts,
  });

  // spellchecker context menu
  // not reliable in macOS so disabled there (https://github.com/electron/electron/issues/24455)
  if (process.platform !== 'darwin') {
    mainWindow.webContents.on('context-menu', (event, params) => {
    
      // init
      const menu = new Menu();

      // Add each spelling suggestion
      for (const suggestion of params.dictionarySuggestions) {
        menu.append(new MenuItem({
          label: suggestion,
          click: () => mainWindow.webContents.replaceMisspelling(suggestion)
        }))
      }

      // Allow users to add the misspelled word to the dictionary
      if (params.misspelledWord) {
        menu.append(
          new MenuItem({
            label: useI18n(app)('common.spellcheck.add'),
            click: () => mainWindow.webContents.session.addWordToSpellCheckerDictionary(params.misspelledWord)
          })
        )
      }
      menu.popup();
    })
  }

  // show a tip
  mainWindow.on('close', (event) => {

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

    // hide only
    mainWindow.hide();
    event.preventDefault();

  })

  mainWindow.on('closed', () => {
    mainWindow = null;
  })

  // open the DevTools
  if (process.env.DEBUG) {
    mainWindow.webContents.openDevTools({ mode: 'right' });
  }

}

export const openMainWindow = (opts: CreateWindowOpts = {}): void => {

  // default to chat
  if (!opts.queryParams) {
    opts.queryParams = {};
  }
  if (!opts.queryParams.view) {
    opts.queryParams.view = 'chat';
  }

  // if we don't have a window, create one
  if (!mainWindow || mainWindow.isDestroyed()) {
    prepareMainWindow(opts);
  } else {
      mainWindow.webContents.send('query-params', opts.queryParams);
  }

  // restore
  if (mainWindow.isMinimized()) {
    mainWindow.restore();
  }

  // now show
  ensureOnCurrentScreen(mainWindow);
  mainWindow.show();
  mainWindow.focus();
  app.focus({ steal: true });

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
