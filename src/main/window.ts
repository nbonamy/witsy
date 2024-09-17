
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

// store
let store: Store|null = null
export const setStore = (aStore: Store): void => {
  store = aStore
}

// create window
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

  // get bounds from here
  const bounds: Electron.Rectangle = store?.get('bounds') as Electron.Rectangle;

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

  // save state
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

export let commandPalette: BrowserWindow = null;
export const closeCommandPalette = async () => {
  try {
    if (commandPalette && !commandPalette.isDestroyed()) {
      // console.log('Closing command palette')
      commandPalette?.close()
      await wait();
    }
  } catch (error) {
    console.error('Error while closing command palette', error);
  }
  commandPalette = null;
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

export let waitingPanel: BrowserWindow = null;
export const closeWaitingPanel = async () => {
  try {
    if (waitingPanel && !waitingPanel.isDestroyed()) {
      // console.log('Closing waiting panel')
      waitingPanel?.close()
      await wait();
    }
  } catch (error) {
    console.error('Error while closing waiting panel', error);
  }
  waitingPanel = null;
}

export const openWaitingPanel = () => {

  // try to close existig one
  // console.log('Opening waiting panel')
  closeWaitingPanel();

  // get bounds
  const width = 100;
  const height = 20;
  const { x, y } = screen.getCursorScreenPoint();

  // open a new one
  waitingPanel = createWindow({
    hash: '/wait',
    x: x - width/2,
    y: y - height*1.5,
    width: width,
    height: height,
    frame: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    hiddenInMissionControl: true,
    hasShadow: false,
  });

}

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

export let promptAnywhereWindow: BrowserWindow = null;
export const openPromptAnywhere = () => {

  // try to close existig one
  closePromptAnywhere();

  // get bounds
  const width = 500;
  const height = 48;
  const { x, y } = screen.getCursorScreenPoint();

  // open a new one
  promptAnywhereWindow = createWindow({
    hash: '/prompt',
    x: x - width/2,
    y: y - 24,
    width: width,
    height: height,
    frame: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    hiddenInMissionControl: true,
  });

  promptAnywhereWindow.on('focus', () => {
    closeExpertsPalette();
  })

  promptAnywhereWindow.on('blur', () => {
    const paletteNotHere = expertsPalette == null || expertsPalette.isDestroyed()
    const paletteNotFocused = expertsPalette != null && !expertsPalette.isFocused()
    if (paletteNotHere || paletteNotFocused) {
      closeExpertsPalette();
      closePromptAnywhere();
      restoreWindows();
    }
  });

};

export const closePromptAnywhere = async () => {

  // close palette too
  closeExpertsPalette();

  // now close window itself
  try {
    if (promptAnywhereWindow && !promptAnywhereWindow.isDestroyed()) {
      // console.log('Closing prompt anywhere window')
      promptAnywhereWindow?.close()
      await wait();
    }
  } catch (error) {
    console.error('Error while closing prompt anywhere window', error);
  }
  promptAnywhereWindow = null;
}

export const resizePromptAnywhere = (height: number) => {
  try {
    const size = promptAnywhereWindow.getSize()
    promptAnywhereWindow?.setSize(size[0], height);
  } catch (error) {
    console.error('Error while resizing prompt anywhere window', error);
  }
}

export const setPromptAnywhereExpertPrompt = (expertId: string) =>  {
  try {
    if (promptAnywhereWindow && !promptAnywhereWindow.isDestroyed()) {
      promptAnywhereWindow.webContents.send('set-expert-prompt', expertId);
    }
  } catch (error) {
    console.error('Error while settings prompt anywhere prompt]', error);
  }
}

export let expertsPalette: BrowserWindow = null;
export const showExpertsPalette = () => {

  // try to close existig one
  closeExpertsPalette();

  // get bounds
  const width = 282;
  const height = 412;
  const position = promptAnywhereWindow.getPosition();
  const x = position[0];
  const y = position[1] + promptAnywhereWindow.getBounds().height + 8;

  // open a new one
  expertsPalette = createWindow({
    hash: '/experts',
    x: x,
    y: y,
    width: width,
    height: height,
    frame: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    hiddenInMissionControl: true,
  });

  expertsPalette.on('blur', () => {
    closeExpertsPalette();
  });
  
}

export const closeExpertsPalette = async () => {

  // close it
  try {

    if (expertsPalette && !expertsPalette.isDestroyed()) {

      // console.log('Closing experts palette')
      expertsPalette?.close()
      expertsPalette = null;
      await wait();

      // focus prompt anywhere
      //console.log('Focusing prompt anywhere window')
      promptAnywhereWindow.focus();
      await wait();

    }

  } catch (error) {
    console.error('Error while closing experts palette', error)
  }

  // reset it here to be sure
  //console.log('Done closing experts palette')
  expertsPalette = null;

}

export const isExpertsPaletteOpen = () => {
  return (expertsPalette != null && !expertsPalette.isDestroyed());
}

export const toggleExpertsPalette = async () => {
  showExpertsPalette();
}

export let readAloudPalette: BrowserWindow = null;
export const closeReadAloudPalette = async () => {
  try {
    if (readAloudPalette && !readAloudPalette.isDestroyed()) {
      // console.log('Closing read aloud palette')
      readAloudPalette?.close()
      await wait();
    }
  } catch (error) {
    console.error('Error while closing read aloud palette', error);
  }
  readAloudPalette = null;
};

export const openReadAloudPalette = async (textId: string) => {

  // try to show existig one
  closeReadAloudPalette();

  // get bounds
  const width = 84;
  const height = 48;
  const { x, y } = screen.getCursorScreenPoint();

  // open a new one
  readAloudPalette = createWindow({
    hash: '/readaloud',
    x: x - width/2,
    y: y - height/2,
    width: width,
    height: height,
    frame: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    resizable: false,
    hiddenInMissionControl: true,
    queryParams: {
      textId: textId,
    }
  });

  readAloudPalette.on('closed', () => {
    restoreWindows();
  });

}

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
