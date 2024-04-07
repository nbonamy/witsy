const { app, Menu, Tray, BrowserWindow, ipcMain, nativeImage } = require('electron');
const process = require('node:process');

import { deleteFile, pickFile, downloadFile } from './file';
import { unregisterShortcuts, registerShortcut, shortcutAccelerator } from './shortcuts';
import { mainWindow, openMainWindow, openCommandPalette, closeCommandPalette, releaseFocus } from './window';
import { runCommand } from './automations/commander.mjs';
import trayIcon from '../assets/brainTemplate.png?asset';

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (require('electron-squirrel-startup')) {
  app.quit();
}

var restoreMainWindow = false;
const registerShortcuts = (shortcuts) => {
  unregisterShortcuts();
  if (shortcuts.chat) {
    registerShortcut(shortcuts.chat, openMainWindow);
  }
  if (shortcuts.assistant) {
    registerShortcut(shortcuts.command, async () => {
      restoreMainWindow = await openCommandPalette()
    });
  }
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
  
  // create the main window
  console.log('Creating initial main window');
  openMainWindow();

  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      openMainWindow();
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

ipcMain.on('register-shortcuts', (event, shortcuts) => {
  globalShortcuts = JSON.parse(shortcuts);
  registerShortcuts(globalShortcuts);
  tray.setContextMenu(Menu.buildFromTemplate(buildTrayMenu()));
});

ipcMain.on('unregister-shortcuts', () => {
  unregisterShortcuts();
});

ipcMain.on('fullscreen', (event, flag) => {
  mainWindow.setFullScreen(flag);
  toggleMainWindowFullscreen(flag);
});

ipcMain.on('delete', (event, payload) => {
  event.returnValue = deleteFile(app, payload);
});

ipcMain.on('pick-file', (event, payload) => {
  event.returnValue = pickFile(app, payload);
});

ipcMain.on('download', async (event, payload) => {
  event.returnValue = await downloadFile(app, payload);
});

ipcMain.on('close-command-palette', async (event) => {
  closeCommandPalette(restoreMainWindow);
});

ipcMain.on('run-command', async (event, payload) => {
  const command = JSON.parse(payload);
  await closeCommandPalette(false);
  await releaseFocus();
  let result = await runCommand(app, command);
  if (restoreMainWindow) {
    console.log('Restoring main window')
    openMainWindow(false);
  }
  if (result?.chatWindow) {
    result.chatWindow.moveTop();
    app.focus();
  }
});
