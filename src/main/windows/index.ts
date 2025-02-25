
import { strDict } from '../../types/index';
import { CreateWindowOpts, ReleaseFocusOpts } from '../../types/window';
import { app, BrowserWindow, BrowserWindowConstructorOptions, Menu, nativeTheme, screen, shell } from 'electron';
import MacosAutomator from '../../automations/macos';
import { promptAnywhereWindow } from './anywhere';
import { commandPicker } from './commands';
import * as config from '../config';
import { wait } from '../utils';
import Store from 'electron-store';
import process from 'node:process';
import path from 'node:path';

// store
export let electronStore: Store|null = null
export const setStore = (aStore: Store): void => {
  electronStore = aStore
}

// listener
export interface WindowListener {
  onWindowCreated: (window: BrowserWindow) => void;
  onWindowTitleChanged: (window: BrowserWindow) => void;
  onWindowClosed: (window: BrowserWindow) => void;
}
const listeners: WindowListener[] = [];
export const addWindowListener = (listener: WindowListener) => {
  listeners.push(listener);
}

// titlebarOptions
export const titleBarOptions = (opts?: any): BrowserWindowConstructorOptions => {

  const settings = config.loadSettings(app);
  const isBlueTheme = settings.appearance.tint === 'blue';

  opts = {
    titleBarStyle: 'hidden',
    lightThemeColor: '#efefef',
    darkBlackThemeColor: '#383838',
    darkBlueThemeColor: 'rgb(40, 50, 65)',
    height: undefined,
    ...opts
  }

  return {
    titleBarStyle: opts.titleBarStyle,
    titleBarOverlay: {
      // windows+linux
      color: nativeTheme.shouldUseDarkColors ? (isBlueTheme ? opts.darkBlueThemeColor : opts.darkBlackThemeColor) : opts.lightThemeColor,
      // windows
      symbolColor: nativeTheme.shouldUseDarkColors ? '#fff' : '#000',
      // windows
      height: process.platform === 'win32' ? opts.height : undefined,
    },
    trafficLightPosition: { x: 16, y: 16 },
  }
}

export const getCurrentScreen = () => {
  const cursorPoint = screen.getCursorScreenPoint();
  return screen.getDisplayNearestPoint(cursorPoint);
}

// get coordinates for a centered window slightly above the center
export const getCenteredCoordinates = (w: number, h: number) => {
  const cursorScreen = getCurrentScreen();
  const { width, height } = cursorScreen.workAreaSize;
  return {
    x: cursorScreen.bounds.x + Math.round((width - w) / 2),
    y: cursorScreen.bounds.y + Math.round(Math.max(height/5, (height - h) / 3)),
  };
};

// ensure window is on current screen
export const ensureOnCurrentScreen = (window: BrowserWindow) => {

  const cursorScreen = getCurrentScreen();
  const windowPosition = window.getPosition();
  const windowScreen = screen.getDisplayNearestPoint({ x: windowPosition[0], y: windowPosition[1] });
  if (cursorScreen.id !== windowScreen.id) {

    // adjust width
    let windowSize = window.getSize();
    if (windowSize[0] > cursorScreen.workAreaSize.width) {
      window.setSize(Math.floor(cursorScreen.workAreaSize.width * .8), windowSize[1]);
    }

    // move
    windowSize = window.getSize();
    const { x, y } = getCenteredCoordinates(windowSize[0], windowSize[1]);
    window.setPosition(x, y);

  }

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
    if (!opts.keepHidden) {
      window.show();
    }
  });

  // notify listeners
  window.on('show', () => {
    for (const listener of listeners) {
      listener.onWindowCreated(window);
    }
  });

  // notify listeners
  window.webContents.on('page-title-updated', () => {
    for (const listener of listeners) {
      listener.onWindowTitleChanged(window);
    }
  });

  // we keep prompt anywhere all the time so we need our own way
  window.on('closed', () => {
    for (const listener of listeners) {
      listener.onWindowClosed(window);
    }
    if (areAllWindowsClosed()) {
      app.emit('window-all-closed');
    }
  });

  // web console to here
  window.webContents.on('console-message', (event, level, message, line, sourceId) => {
    if (!message.includes('Electron Security Warning') && !message.includes('Third-party cookie will be blocked')) {
      console.log(`${message} ${sourceId}:${line}`);
    }
  });

  // open links in default browser
  window.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
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



export const releaseFocus = async (opts?: ReleaseFocusOpts) => {

  // defaults
  opts = {
    sourceApp: null,
    delay: 500,
    ...opts
  };

  // platform specific
  if (process.platform === 'darwin') {

    let focused = false;

    // if we have an app then target it
    if (opts?.sourceApp) {

      try {
        console.log(`Releasing focus to ${opts.sourceApp.id} / ${opts.sourceApp.window}`);
        const macosAutomator = new MacosAutomator();
        focused = await macosAutomator.focusApp(opts.sourceApp);
      } catch (error) {
        console.error('Error while focusing app', error);
      }

    }

    if (!focused) {
      Menu.sendActionToFirstResponder('hide:');
    }

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

  }

  // pause
  if (opts.delay > 0) {
    await wait(opts.delay);
  }

};

export const persistentWindows = (): BrowserWindow[] => {
  return [ promptAnywhereWindow, commandPicker ]
}

export const areAllWindowsClosed = () => {
  let windows = BrowserWindow.getAllWindows();
  const permanentWindows = persistentWindows();
  windows = windows.filter(window => !permanentWindows.includes(window));
  return windows.length === 0;
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
