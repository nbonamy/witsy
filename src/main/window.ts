
import { strDict } from '../types/index.d';
import { CreateWindowOpts } from '../types/window.d';
import path from 'node:path';
import process from 'node:process';
import { app, BrowserWindow, BrowserWindowConstructorOptions, Menu, screen, shell } from 'electron';
import Store from 'electron-store';
import { wait } from './utils';

// titlebarOptions
const titleBarOptions: BrowserWindowConstructorOptions = {
  titleBarStyle: 'hidden',
  titleBarOverlay: {
    color: '#ffffff',
  },
  trafficLightPosition: { x: 16, y: 16 },
}

// create window
const store = new Store()
const createWindow = (opts: CreateWindowOpts = {}) => {
  
  // Create the browser window
  const window = new BrowserWindow({
    ...opts,
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

  // web console to here
  window.webContents.on('console-message', (event, level, message, line, sourceId) => {
    if (!message.includes('Electron Security Warning') && !message.includes('Third-party cookie will be blocked')){
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

  // else open a new one
  mainWindow = createWindow({
    width: 1400,
    height: 800,
    ...titleBarOptions,
    ...opts,
    show: false,
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  // restore and save state
  mainWindow.setBounds(store.get('bounds'))
  mainWindow.on('close', () => {
    store.set('bounds', mainWindow.getBounds())
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

export const openChatWindow = (params: strDict) => {

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

let windowsToRestore: BrowserWindow[] = [];
export const hideWindows = async () => {

  // remember to restore all windows
  windowsToRestore = [];
  try {
    console.log('Hiding windows');
    const windows = BrowserWindow.getAllWindows();
    for (const window of windows) {
      if (!window.isDestroyed() && window.isVisible() && !window.isMinimized()) {
        windowsToRestore.push(window);
        window.hide();
      }
    }
    await releaseFocus();
  } catch (error) {
    console.error('Error while hiding active windows', error);
  }

}

export const restoreWindows = () => {

  // log
  console.log(`Restoring ${windowsToRestore.length} windows`)

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

let commandPalette: BrowserWindow = null;
export const closeCommandPalette = async () => {
  try {
    if (commandPalette && !commandPalette.isDestroyed()) {
      commandPalette?.close()
      await wait();
    }
  } catch (error) {
    console.error('Error while closing command palette', error);
  }
};

export const openCommandPalette = async (textId: string) => {

  // try to show existig one
  closeCommandPalette();

  // get bounds
  const width = 300;
  const height = 320;
  const { x, y } = screen.getCursorScreenPoint();

  // open a new one
  commandPalette = createWindow({
    hash: '/command',
    x: x - width/2,
    y: y - 24,
    width: width,
    height: height,
    frame: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    hiddenInMissionControl: true,
    queryParams: {
      textId: textId,
    }
  });

  commandPalette.on('blur', () => {
    closeCommandPalette();
    restoreWindows();
  });

}

let waitingPanel: BrowserWindow = null;
export const closeWaitingPanel = async (destroy?: boolean) => {
  try {
    if (waitingPanel && !waitingPanel.isDestroyed()) {
      if (destroy) waitingPanel?.destroy()
      else waitingPanel?.close()
      waitingPanel = null;
      await wait();
    }
  } catch (error) {
    console.error('Error while closing waiting panel', error);
  }
}

export const openWaitingPanel = () => {

  // try to show existig one
  closeWaitingPanel();

  // get bounds
  const width = 100;
  const height = 20;
  const { x, y } = screen.getCursorScreenPoint();

  // else open a new one
  waitingPanel = createWindow({
    hash: '/wait',
    x: x - width/2,
    y: y - height*2,
    width: width,
    height: height,
    frame: false,
    alwaysOnTop: true,
    hasShadow: false,
  });

}

export const openSettingsWindow = () => {

  try {
    // send signal to current window
    mainWindow.webContents.send('show-settings');
    return;
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
