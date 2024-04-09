
const path = require('node:path');
const { app, BrowserWindow, Menu, screen } = require('electron');
const Store = require('electron-store');
import { wait } from './utils';

// titlebarOptions
const titleBarOptions = {
  titleBarStyle: 'hidden',
  titleBarOverlay: {
    color: '#ffffff',
  },
  trafficLightPosition: { x: 16, y: 16 },
}

// create window
const store = new Store()
const createWindow = (opts = {}) => {
  
  // Create the browser window
  const window = new BrowserWindow({
    ...opts,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: true,
      contextIsolation: false,
      webSecurity: false,
      defaultEncoding: 'UTF-8',
      //devTools: process.env.DEBUG,
    },
  });

  // web console to here
  if (process.env.DEBUG) {
    window.webContents.on('console-message', (event, level, message, line, sourceId) => {
      if (!message.includes('Electron Security Warning') && !message.includes('Third-party cookie will be blocked')){
        console.log(`${message} ${sourceId}:${line}`);
      }
    });
  }

  // and load the index.html of the app.
  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {

    // build query params
    let queryParams = '';
    if (opts.queryParams) {
      queryParams = '?' + Object.keys(opts.queryParams).map(key => key + '=' + encodeURIComponent(opts.queryParams[key])).join('&');
    }

    // load url
    window.loadURL(`${MAIN_WINDOW_VITE_DEV_SERVER_URL}${queryParams}#${opts.hash||''}`);
  
  } else {

    // build query params
    let queryParams = {};
    if (opts.queryParams) {
      for (let key in opts.queryParams) {
        queryParams[key] = encodeURIComponent(opts.queryParams[key]);
      }
    }

    // load file
    window.loadFile(path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`), { hash: opts.hash||'', query: queryParams });
  
  }

  // done
  return window;
};

// https://ashleyhindle.com/thoughts/electron-returning-focus
export const releaseFocus = async () => {
  if (process.platform === 'darwin') {
    Menu.sendActionToFirstResponder('hide:');
    await wait();
  }
};

export let mainWindow = null;
export const openMainWindow = () => {

  // try to show existig one
  if (mainWindow) {
    try {
      mainWindow.show();
      return
    } catch {
    }
  };

  // else open a new one
  mainWindow = createWindow({
    width: 1400,
    height: 800,
    ...titleBarOptions,
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

export const openChatWindow = (params) => {

  // always open
  let chatWindow = createWindow({
    width: 600,
    height: 600,
    ...titleBarOptions,
    queryParams: params,
  });

  // open the DevTools
  if (process.env.DEBUG) {
    //chatWindow.webContents.openDevTools();
  }

  // done
  return chatWindow;

};

let windowsToRestore = [];
export const hideActiveWindows = async () => {

  // remember to restore all windows
  windowsToRestore = [];
  try {
    console.log('Hiding active windows');
    let windows = BrowserWindow.getAllWindows();
    for (let window of windows) {
      if (!window.isDestroyed() && window.isVisible() && !window.isFocused() && !window.isMinimized()) {
        windowsToRestore.push(window);
        window.hide();
      }
    }
    await releaseFocus();
  } catch {}

}

export const restoreWindows = () => {
  if (windowsToRestore.length) {
    console.log('Restoring active windows')
    if (windowsToRestore.includes(mainWindow)) {
      mainWindow.showInactive();
    }
    for (let window of windowsToRestore) {
      try {
        if (window != mainWindow) {
          window.showInactive();
        }
      } catch {}
    }
    windowsToRestore = [];
  }
};

let commandPalette = null;
export const closeCommandPalette = async () => {
  try {
    commandPalette.close()
    await wait();
  } catch {}
};

export const openCommandPalette = async (text) => {

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
    hiddenInMissionControl: true,
    queryParams: {
      text: text,
    }
  });

  commandPalette.on('blur', () => {
    closeCommandPalette();
    restoreWindows();
  });

}

let waitingPanel = null;

export const closeWaitingPanel = async (destroy) => {
  try {
    if (destroy) waitingPanel.destroy()
    else waitingPanel.close()
    await wait();
  } catch {}
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
    hasShadow: false,
  });

}
