
import { Chat, Command, Prompt } from './types/index.d';
import { Configuration } from './types/config.d';
import process from 'node:process';
import { app, Menu, Tray, BrowserWindow, ipcMain, nativeImage, clipboard } from 'electron';
import installExtension, { VUEJS_DEVTOOLS } from 'electron-devtools-installer';
import { PythonShell } from 'python-shell';
import Store from 'electron-store';
import log from 'electron-log/main';
import { wait } from './main/utils';

import AutoUpdater from './main/autoupdate';
import * as config from './main/config';
import * as history from './main/history';
import * as commands from './main/commands';
import * as prompts from './main/prompts';
import * as file from './main/file';
import * as shortcuts from './main/shortcuts';
import * as window from './main/window';
import * as markdown from './main/markdown';
import * as commander from './automations/commander';
import * as menu from './main/menu';

// first-thing: single instance
// on darwin/mas this is done through Info.plist (LSMultipleInstancesProhibited)
if (process.platform !== 'darwin' && !process.env.TEST) {
  const gotTheLock = app.requestSingleInstanceLock();
  if (!gotTheLock) {
    app.quit();
    process.exit(0);
  }
}

// set up logging
Object.assign(console, log.functions);

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (require('electron-squirrel-startup')) {
  app.quit();
}

// auto-update
const autoUpdater = new AutoUpdater({
  preUpdate: () => quitAnyway = true
});


// // look for menus as soon as possible
// import MacosAutomator from './automations/macos2';
// new MacosAutomator();

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
  const configShortcuts = config.loadSettings(app).shortcuts;

  return [
    { label: 'New Chat', accelerator: shortcuts.shortcutAccelerator(configShortcuts?.chat), click: window.openMainWindow },
    { label: 'Run AI Command', accelerator: shortcuts.shortcutAccelerator(configShortcuts?.command), click: commander.prepareCommand },
    { type: 'separator'},
    { label: 'Settings…', click: window.openSettingsWindow },
    { type: 'separator'},
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

  // install the menu
  menu.installMenu(app, {
    quit: app.quit,
    checkForUpdates: autoUpdater.check,
    newChat: window.openMainWindow,
    settings: window.openSettingsWindow,
  });

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
  tray.on('click', () => {
    const contextMenu = Menu.buildFromTemplate(buildTrayMenu() as Array<any>);
    tray.popUpContextMenu(contextMenu);
  });
  tray.on('right-click', () => {
    window.openMainWindow();
  })
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
  const settings = config.loadSettings(app);
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

ipcMain.on('get-store-value', (event, payload) => {
  event.returnValue = new Store().get(payload.key, payload.fallback);
});

ipcMain.on('set-store-value', (event, payload) => {
  new Store().set(payload.key, payload.value);
});

ipcMain.on('clipboard-write-text', (event, payload) => {
  clipboard.writeText(payload);
});

ipcMain.on('clipboard-write-image', (event, payload) => {
  const image = nativeImage.createFromPath(payload.replace('file://', ''))
  clipboard.writeImage(image);
});

ipcMain.on('load-config', (event) => {
  event.returnValue = JSON.stringify(config.loadSettings(app));
});

ipcMain.on('save-config', (event, payload) => {
  event.returnValue = config.saveSettings(app, JSON.parse(payload) as Configuration);
});

ipcMain.on('load-history', (event) => {
  event.returnValue = JSON.stringify(history.loadHistory(app));
});

ipcMain.on('save-history', (event, payload) => {
  event.returnValue = history.saveHistory(app, JSON.parse(payload) as Chat[]);
});

ipcMain.on('load-commands', (event) => {
  event.returnValue = JSON.stringify(commands.loadCommands(app));
});

ipcMain.on('save-commands', (event, payload) => {
  event.returnValue = commands.saveCommands(app, JSON.parse(payload) as Command[]);
});

ipcMain.on('load-prompts', (event) => {
  event.returnValue = JSON.stringify(prompts.loadPrompts(app));
});

ipcMain.on('save-prompts', (event, payload) => {
  event.returnValue = prompts.savePrompts(app, JSON.parse(payload) as Prompt[]);
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
});

ipcMain.on('unregister-shortcuts', () => {
  shortcuts.unregisterShortcuts();
});

ipcMain.on('fullscreen', (_, flag) => {
  window.mainWindow.setFullScreen(flag);
});

ipcMain.on('delete-file', (event, payload) => {
  event.returnValue = file.deleteFile(app, payload);
});

ipcMain.on('pick-file', (event, payload) => {
  event.returnValue = file.pickFile(app, JSON.parse(payload));
});

ipcMain.on('find-program', (event, payload) => {
  event.returnValue = file.findProgram(app, payload);
});

ipcMain.on('read-file', (event, payload) => {
  event.returnValue = file.getFileContents(app, payload);
});

ipcMain.on('save-file', (event, payload) => {
  event.returnValue = file.writeFileContents(app, JSON.parse(payload));
});

ipcMain.on('download', async (event, payload) => {
  event.returnValue = await file.downloadFile(app, JSON.parse(payload));
});

ipcMain.on('render-markdown', (event, payload) => {
  event.returnValue = markdown.renderMarkdown(payload);
});

ipcMain.on('get-command-prompt', (event, payload) => {
  event.returnValue = commander.getCachedText(payload);
})

ipcMain.on('close-command-palette', async () => {
  window.closeCommandPalette();
  window.restoreWindows();
});

ipcMain.on('run-command', async (event, payload) => {
  const args = JSON.parse(payload);
  await window.closeCommandPalette();
  await window.releaseFocus();
  const result = await commander.runCommand(app, null, args.textId, args.command);
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
