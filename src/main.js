const { app, Menu, Tray, BrowserWindow, ipcMain, shell, nativeImage, globalShortcut } = require('electron');
const Store = require('electron-store')
const process = require('node:process');
const path = require('node:path');

import { deleteFile, pickFile, downloadFile } from './file';
import { registerShortcut, shortcutAccelerator } from './shortcuts';
import trayIcon from '../assets/brainTemplate.png?asset';
import runAssistant from './automations/assistant';
import Automator from './automations/robot';

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (require('electron-squirrel-startup')) {
  app.quit();
}

// main window
let window = null;
const store = new Store()
const createWindow = () => {
  
  // Create the browser window
  const mainWindow = new BrowserWindow({
    width: 1400,
    height: 800,
    titleBarStyle: 'hidden',
    trafficLightPosition: { x: 16, y: 16 },
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: true,
      contextIsolation: false,
      webSecurity: false,
    },
  });

  // restore and save state
  mainWindow.setBounds(store.get('bounds'))
  mainWindow.on('close', () => {
    store.set('bounds', mainWindow.getBounds())
})

  // and load the index.html of the app.
  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`));
  }

  // open links in default browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  // Open the DevTools.
  if (process.env.DEBUG) {
    mainWindow.webContents.openDevTools();
  }

  // show in the dock
  app.dock.show();

  // done
  return mainWindow;
};

const registerShortcuts = (shortcuts) => {
  unregisterShortcuts();
  if (shortcuts.chat) {
    registerShortcut(shortcuts.chat, openMainWindow);
  }
  if (shortcuts.assistant) {
    registerShortcut(shortcuts.assistant, () => runAssistant(app));
  }
}

const unregisterShortcuts = () => {
  globalShortcut.unregisterAll();
}

const openMainWindow = () => {

  // try to show existig one
  if (window) {
    try {
      window.show();
      return
    } catch {
    }
  }

  // else open a new one
  window = createWindow();

}

const quitApp = () => {
  app.quit();
}

//  Tray icon

let tray = null;
let globalShortcuts = null;
const buildTrayMenu = () => {
  return [
    { label: 'Chat...', accelerator: shortcutAccelerator(globalShortcuts?.chat), click: openMainWindow },
    { label: 'Quit', accelerator: 'Command+Q', click: quitApp }
  ];
};

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  
  // hide dock
  // if (!process.env.DEBUG) {
  //   app.dock.hide();
  // }

  // create the main window
  window = createWindow();

  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      window = createWindow();
    }
  });

  // create tray
  tray = new Tray(nativeImage.createFromDataURL(trayIcon));
  const contextMenu = Menu.buildFromTemplate(buildTrayMenu());
  tray.setContextMenu(contextMenu);

});

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  } else {
    app.dock.hide();
  }
});

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and import them here.

ipcMain.on('get-app-path', (event) => {
  event.returnValue = app.getPath('userData');
})

ipcMain.on('get-run-at-login', (event) => {
  event.returnValue = app.getLoginItemSettings();
})

ipcMain.on('set-run-at-login', (event, value) => {
  app.setLoginItemSettings({
    openAtLogin: value,
    openAsHidden: true,
  });
})

ipcMain.on('register-shortcuts', (event, shortcuts) => {
  globalShortcuts = JSON.parse(shortcuts);
  registerShortcuts(globalShortcuts);
  tray.setContextMenu(Menu.buildFromTemplate(buildTrayMenu()));
})

ipcMain.on('unregister-shortcuts', () => {
  unregisterShortcuts();
})

ipcMain.on('fullscreen', (event, flag) => {
  window.setFullScreen(flag);
})

ipcMain.on('delete', (event, payload) => {
  event.returnValue = deleteFile(app, payload);
})

ipcMain.on('pick-file', (event, payload) => {
  event.returnValue = pickFile(app, payload);
})

ipcMain.on('download', async (event, payload) => {
  event.returnValue = await downloadFile(app, payload);
})
