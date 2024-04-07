
const { app, BrowserWindow, Menu, screen } = require('electron');
const Store = require('electron-store')
const path = require('node:path');

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
      devTools: process.env.DEBUG,
    },
  });

  // get query params

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

export const releaseFocus = async () => {
  if (process.platform === 'darwin') {
    Menu.sendActionToFirstResponder('hide:');
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
};

export let mainWindow = null;
export const openMainWindow = (active) => {

  // try to show existig one
  if (mainWindow) {
    try {
      if (active) mainWindow.show();
      else mainWindow.showInactive();
      return
    } catch {
    }
  }

  // else open a new one
  mainWindow = createWindow({
    width: 1400,
    height: 800,
    titleBarStyle: 'hidden',
    trafficLightPosition: { x: 16, y: 16 },
    show: false,
  });

  mainWindow.once('ready-to-show', () => {
    if (active) mainWindow.show();
    else mainWindow.showInactive();
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

  // Open the DevTools.
  if (process.env.DEBUG) {
    mainWindow.webContents.openDevTools();
  }

  // show in dock
  app.dock.show();

}

export const openChatWindow = (params) => {

  // always open
  let chatWindow = createWindow({
    width: 600,
    height: 600,
    titleBarStyle: 'hidden',
    trafficLightPosition: { x: 16, y: 16 },
    queryParams: params,
  });

  // done
  return chatWindow;

}

let commandPalette = null;
export const closeCommandPalette = async () => {
  try {
    commandPalette.close()
    await new Promise((resolve) => setTimeout(resolve, 200));
  } catch {}
}

export const openCommandPalette = async () => {

  // try to show existig one
  closeCommandPalette();

  // remember to restore main window
  let restoreMainWindow = false;
  try {
    if (mainWindow != null && mainWindow.isDestroyed() == false) {
      if (mainWindow.isVisible() && !mainWindow.isFocused() && !mainWindow.isMinimized()) {
        console.log('Hiding main window');
        restoreMainWindow = true;
        mainWindow.hide();
        await releaseFocus();
      }
    }
  } catch {}

  // get bounds
  const width = 300;
  const height = 320;
  const { x, y } = screen.getCursorScreenPoint();

  // open a new one
  commandPalette = createWindow({
    hash: '/assistant',
    x: x - width/2,
    y: y - 24,
    width: width,
    height: height,
    frame: false,
    skipTaskbar: true,
    hiddenInMissionControl: true,
  });

  commandPalette.on('blur', () => {
    closeCommandPalette();
  });

  return restoreMainWindow;

}

let waitingPanel = null;

export const closeWaitingPanel = async (destroy) => {
  try {
    if (destroy) waitingPanel.destroy()
    else waitingPanel.close()
    await new Promise((resolve) => setTimeout(resolve, 200));
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

