
import { MainWindowMode } from '../../types/index';
import { CreateWindowOpts } from '../../types/window';
import { app, BrowserWindow, ContextMenuParams, Menu, MenuItem, Notification } from 'electron';
import { electronStore, createWindow, titleBarOptions, ensureOnCurrentScreen, undockWindow } from './index';
import { loadSettings, saveSettings } from '../config';
import { useI18n } from '../i18n';

const storeBoundsId = 'main.bounds'

let firstOpen = true;
let contextMenuContext: string | null = null;
let mainWindowMode: MainWindowMode = 'none';
export let mainWindow: BrowserWindow = null;

export const getMainWindowMode = (): MainWindowMode => mainWindowMode

export const mainWindowCanDictate = (): boolean => {
  return mainWindowMode === 'chat' ||
    mainWindowMode === 'dictation' ||
    mainWindowMode === 'voice-mode'
}

export const setMainWindowMode = (mode: MainWindowMode): void => {
  mainWindowMode = mode;
}

export const setMainContextMenuContext = (id: string | null): void => {
  contextMenuContext = id;
}

export const prepareMainWindow = (opts: CreateWindowOpts = {}): void => {

  // do not allow multiple windows
  if (mainWindow) {
    return;
  }
  
  // get bounds from here
  const bounds: Electron.Rectangle = electronStore?.get(storeBoundsId) as Electron.Rectangle;

  // else open a new one
  mainWindow = createWindow({
    title: 'StationOne',
    x: bounds?.x,
    y: bounds?.y,
    width: bounds?.width ?? 1400,
    height: bounds?.height ?? 1000,
    minWidth: 800,
    minHeight: 600,
    ...titleBarOptions({
      height: 48,
    }),
    keepHidden: true,
    showInDock: true,
    ...opts,
  });

  mainWindow.webContents.on('context-menu', (event, params: ContextMenuParams) => {
    
    // init
    const menu = new Menu();
    menu.addListener('menu-will-close', () => {
      setTimeout(() => {
        contextMenuContext = null;
      }, 500);
    })

    // if we have a selection add options
    if (contextMenuContext && params.selectionText.length > 0) {

      menu.append(new MenuItem({
        label: useI18n(app)('common.copy'),
        click: () => mainWindow.webContents.copy(),
      }));

      // menu.append(new MenuItem({
      //   label: useI18n(app)('common.copyMd'),
      //   click: () => mainWindow.webContents.send('copy-as-markdown', { context: contextMenuContext, selection: params.selectionText }),
      // }));

      // Add a paste option
      menu.append(new MenuItem({
        label: useI18n(app)('tray.menu.readAloud'),
        click: () => mainWindow.webContents.send('read-aloud-selection', { context: contextMenuContext, selection: params.selectionText }),
      }));

      // menu.append(new MenuItem({
      //   type: 'separator',
      // }));

    }

    // spellchecker context menu
    // not reliable in macOS so disabled there (https://github.com/electron/electron/issues/24455)
    if (process.platform !== 'darwin') {

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

    }
    
    // only if populated
    if (menu.items.length > 0) {
      menu.popup();
    }
    
  })

  // show a tip
  mainWindow.on('close', (event) => {

    // check
    const config = loadSettings(app);
    if (config.general.tips.trayIcon === undefined || config.general.tips.trayIcon === true) {

      new Notification({
        title: app.getName(),
        body: useI18n(app)(`tray.notification.${process.platform}`),
      }).show()
      
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
    undockWindow(mainWindow);
    event.preventDefault();

    // notify the app
    mainWindow.webContents.send('window-closed');

  })

  mainWindow.on('closed', () => {
    mainWindow = null;
  })

}

export const openMainWindow = (opts: CreateWindowOpts = {}): void => {

  // default to chat
  if (!opts.queryParams) {
    opts.queryParams = {};
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

  // open the DevTools
  if (process.env.DEBUG && firstOpen) {
    mainWindow.webContents.openDevTools({ mode: 'right' });
  }

  // notify
  mainWindow.webContents.send('window-opened');
  
  // record
  firstOpen = false;

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
