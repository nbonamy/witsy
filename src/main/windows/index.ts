
import { strDict } from '../../types/index.d';
import { CreateWindowOpts } from '../../types/window.d';
import { BrowserWindow, BrowserWindowConstructorOptions, Menu } from 'electron';
import { mainWindow } from './main';
import { wait } from '../utils';
import Store from 'electron-store';
import process from 'node:process';
import path from 'node:path';

// store
export let electronStore: Store|null = null
export const setStore = (aStore: Store): void => {
  electronStore = aStore
}

// titlebarOptions
export const titleBarOptions: BrowserWindowConstructorOptions = {
  titleBarStyle: 'hidden',
  titleBarOverlay: {
    color: '#ffffff',
  },
  trafficLightPosition: { x: 16, y: 16 },
}

// create window
export const createWindow = (opts: CreateWindowOpts = {}) => {

  // create the browser window
  const window = new BrowserWindow({
    ...opts,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false,
      defaultEncoding: 'UTF-8',
      devTools: process.env.DEBUG ? true : false,
      sandbox: true,
    },
  });

  // show when ready
  window.once('ready-to-show', () => {
    window.show();
  });

  // web console to here
  window.webContents.on('console-message', (event, level, message, line, sourceId) => {
    if (!message.includes('Electron Security Warning') && !message.includes('Third-party cookie will be blocked')) {
      console.log(`${message} ${sourceId}:${line}`);
    }
  });

  // and load the index.html of the app.
  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {

    // build query params
    let queryParams = '';
    if (opts.queryParams) {
      queryParams = '?' + Object.keys(opts.queryParams).map(key => key + '=' + encodeURIComponent(opts.queryParams[key])).join('&');
    }

    // load url
    const url = `${MAIN_WINDOW_VITE_DEV_SERVER_URL}${queryParams}#${opts.hash||''}`;
    console.log(url);
    window.loadURL(url);
  
  } else {

    // build query params
    const queryParams: strDict = {};
    if (opts.queryParams) {
      for (const key in opts.queryParams) {
        queryParams[key] = encodeURIComponent(opts.queryParams[key]);
      }
    }

    // load file
    console.log('Loading file:', path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`));
    console.log('With options:', opts.hash||'', queryParams);
    window.loadFile(path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`), { hash: opts.hash||'', query: queryParams });
  
  }

  // done
  return window;
};

// https://ashleyhindle.com/thoughts/electron-returning-focus
export const releaseFocus = async () => {

  if (process.platform === 'darwin') {

    Menu.sendActionToFirstResponder('hide:');
    await wait(500);

  } else if (process.platform === 'win32') {

    const dummyTransparentWindow = new BrowserWindow({
        width: 1,
        height: 1,
        x: -100,
        y: -100,
        transparent: true,
        frame: false,
      });

    dummyTransparentWindow.close();

    await wait(500);
  }
};

let windowsToRestore: BrowserWindow[] = [];
export const hideWindows = async () => {

  // remember to restore all windows
  windowsToRestore = [];
  try {
    // console.log('Hiding windows');
    const windows = BrowserWindow.getAllWindows();
    for (const window of windows) {
      if (!window.isDestroyed() && window.isVisible() && !window.isMinimized()) {
        windowsToRestore.push(window);
        window.hide();
      }
    }
  } catch (error) {
    console.error('Error while hiding active windows', error);
  }

}

export const restoreWindows = () => {

  // log
  // console.log(`Restoring ${windowsToRestore.length} windows`)

  // restore main window first
  windowsToRestore.sort((a, b) => {
    if (a === mainWindow) return -1;
    if (b === mainWindow) return 1;
    return 0;
  })

  // now restore
  for (const window of windowsToRestore) {
    try {
      window.restore();
      //window.showInactive();
    } catch (error) {
      console.error('Error while restoring window', error);
    }
  }

  // done
  windowsToRestore = [];

};

export const notifyBrowserWindows = (event: string, ...args: any[]) => {
  try {
    const windows = BrowserWindow.getAllWindows();
    for (const window of windows) {
      try {
        if (!window.isDestroyed()) {
          window.webContents.send(event, ...args);
        }
      } catch (error) {
        console.error('Error while notifying browser windows', error)
      }
    }
  } catch (error) {
    console.error('Error while notifying browser windows', error)
  }
}
