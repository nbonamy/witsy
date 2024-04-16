
import process from 'node:process';
import { app, Menu, Tray, BrowserWindow, ipcMain, nativeImage } from 'electron';
import installExtension, { VUEJS_DEVTOOLS } from 'electron-devtools-installer';
import { PythonShell } from 'python-shell';
import log from 'electron-log/main';
import { wait } from './main/utils';

import * as config from './main/config';
import * as file from './main/file';
import * as shortcuts from './main/shortcuts';
import * as window from './main/window';
import * as commander from './automations/commander';

// first-thing: single instance
if (!process.env.TEST) {
  const gotTheLock = app.requestSingleInstanceLock();
  if (!gotTheLock) {
    app.quit();
    process.exit(0);
  }
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

// eslint-disable-next-line import/no-unresolved
import trayIconMacos from '../assets/bulbTemplate.png?asset';
// eslint-disable-next-line import/no-unresolved
import trayIconWindows from '../assets/bulbTemplate@2x.png?asset';
const trayIcon = process.platform === 'darwin' ? trayIconMacos : trayIconWindows;

let tray: Tray = null;
const buildTrayMenu = () => {

  // load the config
  const configShortcuts = config.loadSettings(config.settingsFilePath(app)).shortcuts;

  return [
    { label: 'New Chat', accelerator: shortcuts.shortcutAccelerator(configShortcuts?.chat), click: window.openMainWindow },
    { label: 'Run AI Command', accelerator: shortcuts.shortcutAccelerator(configShortcuts?.command), click: commander.prepareCommand },
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
  
  if (process.env.DEBUG) {
    installExtension(VUEJS_DEVTOOLS)
      .then((name) => console.log(`Added Extension:  ${name}`))
      .catch((err) => console.log('An error while installing Extension: ', err));
  }
  
  // register shortcuts
  registerShortcuts();

  // create the main window
  // TODO detect when lauched from login item
  const hidden = false;//app.getLoginItemSettings().wasOpenedAtLogin();
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
  if (process.env.DEBUG || process.env.TEST || quitAnyway) {
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

ipcMain.on('set-run-at-login', (_, value) => {
  app.setLoginItemSettings({
    openAtLogin: value,
    openAsHidden: true,
  });
});

ipcMain.on('register-shortcuts', () => {
  registerShortcuts();
  tray.setContextMenu(Menu.buildFromTemplate(buildTrayMenu()));
});

ipcMain.on('unregister-shortcuts', () => {
  shortcuts.unregisterShortcuts();
});

ipcMain.on('fullscreen', (_, flag) => {
  window.mainWindow.setFullScreen(flag);
});

ipcMain.on('delete', (event, payload) => {
  event.returnValue = file.deleteFile(app, payload);
});

ipcMain.on('pick-file', (event, payload) => {
  event.returnValue = file.pickFile(app, payload);
});

ipcMain.on('find-program', (event, payload) => {
  event.returnValue = file.findProgram(app, payload);
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

ipcMain.on('close-command-palette', async () => {
  window.closeCommandPalette();
  window.restoreWindows();
});

ipcMain.on('run-command', async (event, payload) => {
  const args = JSON.parse(payload);
  await window.closeCommandPalette();
  await window.releaseFocus();
  const result = await commander.runCommand(app, null, args.text, args.command);
  window.restoreWindows();
  if (result?.chatWindow) {
    await wait();
    result.chatWindow.show();
    result.chatWindow.moveTop();
    await wait();
    app.show();
    app.focus({
      steal: true,
    });
  }
});

ipcMain.on('run-python-code', async (event, payload) => {
  try {
    console.log('Running Python code:', payload);
    const result = await PythonShell.runString(payload);
    event.returnValue = {
      result: result
    }
  } catch (error) {
    console.error(error);
    event.returnValue = {
      error: error
    }
  }
})
