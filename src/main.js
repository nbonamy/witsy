
const process = require('node:process');
const { app, Menu, Tray, BrowserWindow, ipcMain, nativeImage } = require('electron');
import log from 'electron-log/main';

import * as config from './config';
import * as file from './file';
import * as shortcuts from './shortcuts';
import * as window from './window';
import * as commander from './automations/commander';

// first-thing: single instance
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
  process.exit(0);
}

// set up logging
Object.assign(console, log.functions);

// // look for menus as soon as possible
// import MacosAutomator from './automations/macos2';
// new MacosAutomator();

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (require('electron-squirrel-startup')) {
  app.quit();
}

// this is going to be called later
const registerShortcuts = () => {
  shortcuts.registerShortcuts(app, {
    chat: window.openMainWindow,
    command: commander.prepareCommand,
  });
}

//  Tray icon

import trayIconMacos from '../assets/bulbTemplate.png?asset';
import trayIconWindows from '../assets/bulbTemplate@2x.png?asset';
const trayIcon = process.platform === 'darwin' ? trayIconMacos : trayIconWindows;

let tray = null;
let globalShortcuts = null;
const buildTrayMenu = () => {
  return [
    { label: 'Chat...', accelerator: shortcuts.shortcutAccelerator(globalShortcuts?.chat), click: window.openMainWindow },
    { label: 'Quit', /*accelerator: 'Command+Q', */click: quitApp }
  ];
};

// quit at all costs
let quitAnyway = false;
const quitApp = () => {
  quitAnyway = true;
  app.exit();
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  
  // register shortcuts
  registerShortcuts();

  // create the main window
  // TODO detect when lauched from login item
  let hidden = false;//app.getLoginItemSettings().wasOpenedAtLogin();
  if (!hidden) {
    log.info('Creating initial main window');
    window.openMainWindow();
  } else {
    app.dock.hide();
  }

  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      window.openMainWindow();
    }
  });

  // create tray
  tray = new Tray(nativeImage.createFromDataURL(trayIcon));
  const contextMenu = Menu.buildFromTemplate(buildTrayMenu());
  tray.setContextMenu(contextMenu);

});

// called when the app is already running
app.on('second-instance', () => {
  window.openMainWindow();
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

//
app.on('before-quit', (ev) => {

  // if force quit
  if (process.env.DEBUG || quitAnyway) {
    return;
  }

  // check settings
  const settings = config.loadSettings(config.settingsFilePath(app));
  if (!settings.general.keepRunning) {
    return;
  }

  // close all windows but do not quit
  BrowserWindow.getAllWindows().forEach((win) => {
    win.removeAllListeners('close');
    win.close();
  });
  ev.preventDefault();

});

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and import them here.

ipcMain.on('get-app-path', (event) => {
  event.returnValue = app.getPath('userData');
});

ipcMain.on('get-run-at-login', (event) => {
  event.returnValue = app.getLoginItemSettings();
});

ipcMain.on('set-run-at-login', (event, value) => {
  app.setLoginItemSettings({
    openAtLogin: value,
    openAsHidden: true,
  });
});

ipcMain.on('register-shortcuts', (event, payload) => {
  registerShortcuts();
  tray.setContextMenu(Menu.buildFromTemplate(buildTrayMenu()));
});

ipcMain.on('unregister-shortcuts', () => {
  shortcuts.unregisterShortcuts();
});

ipcMain.on('fullscreen', (event, flag) => {
  window.mainWindow.setFullScreen(flag);
});

ipcMain.on('delete', (event, payload) => {
  event.returnValue = file.deleteFile(app, payload);
});

ipcMain.on('pick-file', (event, payload) => {
  event.returnValue = file.pickFile(app, payload);
});

ipcMain.on('get-contents', (event, payload) => {
  event.returnValue = file.getFileContents(app, payload);
});

ipcMain.on('write-contents', (event, payload) => {
  event.returnValue = file.writeFileContents(app, JSON.parse(payload));
});

ipcMain.on('download', async (event, payload) => {
  event.returnValue = await file.downloadFile(app, payload);
});

ipcMain.on('close-command-palette', async (event) => {
  window.closeCommandPalette();
  window.restoreWindows();
});

ipcMain.on('run-command', async (event, payload) => {
  const args = JSON.parse(payload);
  await window.closeCommandPalette();
  await window.releaseFocus();
  let result = await commander.runCommand(app, args.text, args.command);
  window.restoreWindows();
  if (result?.chatWindow) {
    result.chatWindow.show();
    result.chatWindow.moveTop();
    app.focus();
  }
});
