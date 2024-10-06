
import { Chat, Command, Expert } from './types/index.d';
import { Configuration } from './types/config.d';
import process from 'node:process';
import { app, Menu, Tray, BrowserWindow, ipcMain, nativeImage, clipboard } from 'electron';
import installExtension, { VUEJS_DEVTOOLS } from 'electron-devtools-installer';
import { PythonShell } from 'python-shell';
import Store from 'electron-store';
import log from 'electron-log/main';
import { wait } from './main/utils';
import path from 'node:path';

import AutoUpdater from './main/autoupdate';
import Commander from './automations/commander';
import PromptAnywhere from './automations/anywhere';
import ReadAloud from './automations/readaloud';
import Transcriber from 'automations/transcriber';
import DocumentRepository from './rag/docrepo';
import Embedder from './rag/embedder';
import Nestor from './main/nestor';
//import Dropbox from './main/dropbox';

import * as config from './main/config';
import * as history from './main/history';
import * as commands from './main/commands';
import * as experts from './main/experts';
import * as file from './main/file';
import * as shortcuts from './main/shortcuts';
import * as window from './main/window';
import * as markdown from './main/markdown';
import * as menu from './main/menu';
import * as text from './main/text';

let commander: Commander = null
let anywhere: PromptAnywhere = null
let docRepo: DocumentRepository = null
let nestor: Nestor = null

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

// open store
const store = new Store({ name: 'window' });
window.setStore(store);

// // look for menus as soon as possible
// import MacosAutomator from './automations/macos2';
// new MacosAutomator();

// start nestor
nestor = new Nestor();

// this is going to be called later
const registerShortcuts = () => {
  shortcuts.registerShortcuts(app, {
    chat: window.openMainWindow,
    command: Commander.initCommand,
    anywhere: PromptAnywhere.initPrompt,
    readaloud: ReadAloud.read,
    transcribe: Transcriber.initTranscription,
    scratchpad: window.openScratchPad,
  });
}

//  tray icon 
let tray: Tray = null;
const buildTrayMenu = (): Array<Electron.MenuItemConstructorOptions> => {

  // load the config
  const configShortcuts = config.loadSettings(app).shortcuts;

  // visible does not seem to work for role 'about' and type 'separator' so we need to add them manually
  let menuItems: Array<Electron.MenuItemConstructorOptions> = []
  if (process.platform !== 'darwin') {
    menuItems = [
      ...menuItems,
      { role: 'about' },
      { type: 'separator' },
    ]
  }

  // add common stuff
  return [
    ...menuItems,
    { label: 'New Chat', accelerator: shortcuts.shortcutAccelerator(configShortcuts?.chat), click: window.openMainWindow },
    { label: 'Scratch Pad', accelerator: shortcuts.shortcutAccelerator(configShortcuts?.scratchpad), click: window.openScratchPad },
    { label: 'Prompt Anywhere', accelerator: shortcuts.shortcutAccelerator(configShortcuts?.anywhere), click: PromptAnywhere.initPrompt },
    { label: 'Run AI Command', accelerator: shortcuts.shortcutAccelerator(configShortcuts?.command), click: Commander.initCommand },
    { label: 'Read Aloud', accelerator: shortcuts.shortcutAccelerator(configShortcuts?.readaloud), click: ReadAloud.read },
    { label: 'Start Dictation', accelerator: shortcuts.shortcutAccelerator(configShortcuts?.transcribe), click: Transcriber.initTranscription },
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

  // we need settings
  const settings = config.loadSettings(app);

  // debugging
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
    newScratchpad: window.openScratchPad,
    settings: window.openSettingsWindow,
  }, settings.shortcuts);

  // register shortcuts
  registerShortcuts();

  // create the main window
  if (!settings.general.hideOnStartup || process.env.DEBUG) {
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

  // tray icon
  const assetsFolder = process.env.DEBUG ? path.resolve('./assets') : process.resourcesPath;
  const trayIconPath = path.join(assetsFolder, 'bulbTemplate@2x.png');
  //console.log('trayIconPath', trayIconPath);
  const trayIcon = nativeImage.createFromPath(trayIconPath);
  trayIcon.setTemplateImage(true);

  // create tray
  tray = new Tray(trayIcon);
  tray.on('click', () => {
    const contextMenu = Menu.buildFromTemplate(buildTrayMenu());
    tray.popUpContextMenu(contextMenu);
  });
  tray.on('right-click', () => {
    window.openMainWindow();
  })

  // create the document repository
  docRepo = new DocumentRepository(app);

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

ipcMain.on('store-get-value', (event, payload) => {
  event.returnValue = store.get(payload.key, payload.fallback);
});

ipcMain.on('store-set-value', (event, payload) => {
  store.set(payload.key, payload.value);
});

ipcMain.on('clipboard-write-text', (event, payload) => {
  clipboard.writeText(payload);
});

ipcMain.on('clipboard-write-image', (event, payload) => {
  const image = nativeImage.createFromPath(payload.replace('file://', ''))
  clipboard.writeImage(image);
});

ipcMain.on('config-load', (event) => {
  event.returnValue = JSON.stringify(config.loadSettings(app));
});

ipcMain.on('config-save', (event, payload) => {
  event.returnValue = config.saveSettings(app, JSON.parse(payload) as Configuration);
});

ipcMain.on('history-load', async (event) => {
  event.returnValue = JSON.stringify(await history.loadHistory(app));
});

ipcMain.on('history-save', (event, payload) => {
  event.returnValue = history.saveHistory(app, JSON.parse(payload) as Chat[]);
});

ipcMain.on('commands-load', (event) => {
  event.returnValue = JSON.stringify(commands.loadCommands(app));
});

ipcMain.on('commands-save', (event, payload) => {
  event.returnValue = commands.saveCommands(app, JSON.parse(payload) as Command[]);
});

ipcMain.on('commands-export', (event) => {
  event.returnValue = commands.exportCommands(app);
});

ipcMain.on('commands-import', (event) => {
  event.returnValue = commands.importCommands(app);
});

ipcMain.on('experts-load', (event) => {
  event.returnValue = JSON.stringify(experts.loadExperts(app));
});

ipcMain.on('experts-save', (event, payload) => {
  event.returnValue = experts.saveExperts(app, JSON.parse(payload) as Expert[]);
});

ipcMain.on('experts-export', (event) => {
  event.returnValue = experts.exportExperts(app);
});

ipcMain.on('experts-import', (event) => {
  event.returnValue = experts.importExperts(app);
});

ipcMain.on('run-at-login-get', (event) => {
  event.returnValue = app.getLoginItemSettings();
});

ipcMain.on('run-at-login-set', (_, value) => {
  app.setLoginItemSettings({
    openAtLogin: value,
    openAsHidden: true,
  });
});

ipcMain.on('shortcuts-register', () => {
  registerShortcuts();
});

ipcMain.on('shortcuts-unregister', () => {
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

ipcMain.on('pick-directory', (event) => {
  event.returnValue = file.pickDirectory(app);
});

ipcMain.on('find-program', (event, payload) => {
  event.returnValue = file.findProgram(app, payload);
});

ipcMain.on('read-file', (event, payload) => {
  event.returnValue = file.getFileContents(app, payload);
});

ipcMain.on('read-icon', async (event, payload) => {
  event.returnValue = await file.getIconContents(app, payload);
});

ipcMain.on('save-file', (event, payload) => {
  event.returnValue = file.writeFileContents(app, JSON.parse(payload));
});

ipcMain.on('download', async (event, payload) => {
  event.returnValue = await file.downloadFile(app, JSON.parse(payload));
});

ipcMain.on('get-text-content', async (event, contents, format) => {
  event.returnValue = await text.getTextContent(contents, format);
});

ipcMain.on('get-app-info', (event, payload) => {
  event.returnValue = file.getAppInfo(app, payload);
});

ipcMain.on('markdown-render', (event, payload) => {
  event.returnValue = markdown.renderMarkdown(payload);
});

ipcMain.on('command-get-prompt', (event, payload) => {
  event.returnValue = Commander.getCachedText(payload);
})

ipcMain.on('command-palette-close', async () => {
  await window.closeCommandPalette();
  await window.restoreWindows();
  await window.releaseFocus();
});

ipcMain.on('command-run', async (event, payload) => {

  // cancel any running command
  if (commander !== null) {
    await commander.cancelCommand();
  }

  // prepare
  const args = JSON.parse(payload);
  await window.closeCommandPalette();
  await window.releaseFocus();

  // now run
  commander = new Commander();
  const result = await commander.execCommand(app, args.textId, args.command);
  commander = null;
  
  // cancelled
  if (result.cancelled) return;

  // show chat window
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

ipcMain.on('command-stop', async () => {

  // cancel any running command
  if (commander !== null) {
    await commander.cancelCommand();
    commander = null;
  }

});

ipcMain.on('code-python-run', async (event, payload) => {
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

ipcMain.on('anywhere-prompt', async (event, payload) => {

  // if cancel on prompt window
  await window.closePromptAnywhere();

  // cancel previous
  if (anywhere != null) {
    await anywhere.cancel();
  }

  // do it
  anywhere = new PromptAnywhere();
  anywhere.execPrompt(app, JSON.parse(payload));

})

ipcMain.on('anywhere-resize', (_, height) => {
  window.resizePromptAnywhere(height);
})

ipcMain.on('anywhere-show-experts', async () => {
  await window.showExpertsPalette();
})

ipcMain.on('anywhere-close-experts', async () => {
  await window.closeExpertsPalette();
})

ipcMain.on('anywhere-toggle-experts', async () => {
  await window.toggleExpertsPalette();
})

ipcMain.on('anywhere-is-experts-open', (event) => {
  event.returnValue = window.isExpertsPaletteOpen();
})

ipcMain.on('anywhere-on-expert', async (_, expertId) => {
  await window.setPromptAnywhereExpertPrompt(JSON.parse(expertId));
  await window.closeExpertsPalette();
})

ipcMain.on('anywhere-cancel', async () => {

  // if cancel on prompt window
  await window.closePromptAnywhere();
  
  // if cancel on waiting panel
  if (anywhere != null) {
    console.log('Cancelling anywhere')
    await anywhere.cancel();
    anywhere = null;
  }
})

ipcMain.on('readaloud-get-text', (event, payload) => {
  event.returnValue = ReadAloud.getCachedText(payload);
})

ipcMain.on('readaloud-close-palette', async () => {
  await window.closeReadAloudPalette();
});

ipcMain.on('transcribe-insert', async (_, payload) => {
  await Transcriber.insertTranscription(payload);
});

ipcMain.on('transcribe-cancel', async () => {
  await window.closeTranscribePalette();
});

ipcMain.on('docrepo-list', (event) => {
  event.returnValue = JSON.stringify(docRepo.list());
});

ipcMain.on('docrepo-connect', async (event, baseId) => {
  try {
    await docRepo.connect(baseId, true);
    event.returnValue = true
  } catch (error) {
    console.error(error);
    event.returnValue = false
  }
});

ipcMain.on('docrepo-disconnect', async (event) => {
  try {
    await docRepo.disconnect();
    event.returnValue = true
  } catch (error) {
    console.error(error);
    event.returnValue = false
  }
});

ipcMain.on('docrepo-create', async (event, payload) => {
  try {
    const { title, embeddingEngine, embeddingModel } = payload;
    event.returnValue = await docRepo.create(title, embeddingEngine, embeddingModel);
  } catch (error) {
    console.error(error);
    event.returnValue = null
  }
});

ipcMain.on('docrepo-rename', async (event, payload) => {
  try {
    const { baseId, title } = payload;
    await docRepo.rename(baseId, title);
    event.returnValue = true
  } catch (error) {
    console.error(error);
    event.returnValue = false
  }
});

ipcMain.on('docrepo-delete', async (event, baseId) => {
  try {
    await docRepo.delete(baseId);
    event.returnValue = true
  } catch (error) {
    console.error(error);
    event.returnValue = false
  }
});

ipcMain.on('docrepo-add-document', async (_, payload) => {
  try {
    const { baseId, type, url } = payload;
    await docRepo.addDocument(baseId, type, url);
  } catch (error) {
    console.error(error);
  }
});

ipcMain.on('docrepo-remove-document', async (event, payload) => {
  try {
    const { baseId, docId } = payload;
    console.log('docrepo-remove-document', baseId, docId);
    await docRepo.removeDocument(baseId, docId);
    event.returnValue = true
  } catch (error) {
    console.error(error);
    event.returnValue = false
  }
});

ipcMain.handle('docrepo-query', async(_, payload) => {
  try {
    const { baseId, text } = payload;
    console.log('docrepo-query', baseId, text);
    const results = await docRepo.query(baseId, text);
    console.log('docrepo-query results returned = ', results.length);
    return results
  } catch (error) {
    console.error(error);
    return []
  }
});

ipcMain.on('docrepo-is-embedding-available', async(event, payload) => {
  try {
    const { engine, model } = payload;
    event.returnValue = Embedder.isModelReady(app, engine, model);
  } catch (error) {
    console.error(error);
    event.returnValue = false
  }
});

ipcMain.handle('nestor-get-status', async (_) => {
  return await nestor.getStatus();
});

ipcMain.handle('nestor-get-tools', async (_) => {
  return await nestor.getTools();
});

ipcMain.handle('nestor-call-tool', async (_, payload) => {
  return await nestor.callTool(payload.name, payload.parameters);
});

ipcMain.on('scratchpad-open', async () => {
  await window.openScratchPad();
});

// ipcMain.on('dropbox-get-authentication-url', async (event, payload) => {
//   const dropbox = new Dropbox(app, '', '')
//   event.returnValue = await dropbox.getOAuthUrl()
// })

// ipcMain.on('dropbox-authenticate-with-code', async (event, payload) => {
//   const dropbox = new Dropbox(app, '', '')
//   const accessToken = await dropbox.getAccessTokenFromCode(payload)
//   event.returnValue = (accessToken != null)
// })
