
import { type Chat, type Command, type Expert } from '@types/index.d';
import { type Configuration } from '@types/config.d';
import process from 'node:process';
import fontList from 'font-list';
import { app, BrowserWindow, ipcMain, nativeImage, clipboard, dialog, nativeTheme } from 'electron';
import installExtension, { VUEJS_DEVTOOLS } from 'electron-devtools-installer';
import { PythonShell } from 'python-shell';
import Store from 'electron-store';
import log from 'electron-log/main';
import { wait } from './main/utils';

import AutoUpdater from './main/autoupdate';
import Commander, { notEditablePrompts } from './automations/commander';
import PromptAnywhere from './automations/anywhere';
import ReadAloud from './automations/readaloud';
import Transcriber from './automations/transcriber';
import DocumentRepository from './rag/docrepo';
import Embedder from './rag/embedder';
import Nestor from './main/nestor';
import Computer from './main/computer';
//import OnlineStorage from './main/online';
import TrayIconManager from './main/tray';

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
let docRepo: DocumentRepository = null
//let onlineStorage: OnlineStorage = null
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
// eslint-disable-next-line @typescript-eslint/no-require-imports
if (require('electron-squirrel-startup')) {
  app.quit();
}

// auto-update
const autoUpdater = new AutoUpdater({
  preInstall: () => quitAnyway = true,
  onUpdateAvailable: () => {
    window.notifyBrowserWindows('update-available');
    trayIconManager.install();
  },
});

// open store
const store = new Store({ name: 'window' });
window.setStore(store);

// start nestor
if (!process.mas) {
  nestor = new Nestor();
}

// start online storage
// onlineStorage = new OnlineStorage(app);
// onlineStorage.initialize();

// this is going to be called later
const registerShortcuts = () => {
  shortcuts.registerShortcuts(app, {
    prompt: PromptAnywhere.open,
    chat: window.openMainWindow,
    command: Commander.initCommand,
    readaloud: ReadAloud.read,
    transcribe: Transcriber.initTranscription,
    scratchpad: window.openScratchPad,
  });
}

// quit at all costs
let quitAnyway = false;
const quitApp = () => {
  quitAnyway = true;
  app.exit();
}

//  tray icon
const trayIconManager = new TrayIconManager(app, autoUpdater, quitApp);

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

  // set theme
  nativeTheme.themeSource = settings.appearance.theme;

  // install the menu
  menu.installMenu(app, {
    quit: app.quit,
    checkForUpdates: autoUpdater.check,
    newPrompt: PromptAnywhere.open,
    newChat: window.openMainWindow,
    newScratchpad: window.openScratchPad,
    settings: window.openSettingsWindow,
  }, settings.shortcuts);

  // register shortcuts
  registerShortcuts();

  // create the main window
  if (!settings.general.hideOnStartup/* || process.env.DEBUG*/) {
    log.info('Creating initial main window');
    window.openMainWindow();
  } else {
    app.dock?.hide();
  }

  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  app.on('activate', () => {
    if (window.areAllWindowsClosed()) {
      window.openMainWindow();
    }
  });

  // tray icon
  trayIconManager.install();

  // create the document repository
  docRepo = new DocumentRepository(app);

  // we want prompt anywhere to be as fast as possible
  window.preparePromptAnywhere({});

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
    app.dock?.hide();
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
    //win.removeAllListeners('close');
    win.close();
  });
  ev.preventDefault();

});

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and import them here.

ipcMain.on('update-is-available', (event) => {
  event.returnValue = autoUpdater.updateAvailable;
});

ipcMain.on('update-apply', () => {
  autoUpdater.install();
});

ipcMain.on('set-appearance-theme', (event, theme) => {
  nativeTheme.themeSource = theme;
  event.returnValue = theme;
});

ipcMain.handle('dialog-show', (event, payload): Promise<Electron.MessageBoxReturnValue> => {
  return dialog.showMessageBox(payload);
});

ipcMain.on('get-app-path', (event) => {
  event.returnValue = app.getPath('userData');
});

ipcMain.on('fonts-list', async (event) => {
  event.returnValue = process.mas ? [] : await fontList.getFonts();
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

ipcMain.on('command-get-prompt', (event, payload) => {
  event.returnValue = Commander.getCachedText(payload);
})

ipcMain.on('command-palette-close', async () => {
  await window.closeCommandPalette();
  await window.restoreWindows();
  await window.releaseFocus();
});

ipcMain.on('command-is-prompt-editable', (event, payload) => {
  event.returnValue = !notEditablePrompts.includes(payload);
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

ipcMain.on('anywhere-prompt', async () => {
  await PromptAnywhere.open();
});

ipcMain.on('anywhere-insert', async (event, payload) => {
  await PromptAnywhere.insert(app, payload);
})

ipcMain.on('anywhere-continue-as-chat', async (_, chatId) => {
  await PromptAnywhere.continueAsChat(app, chatId);
})

ipcMain.on('anywhere-close', async () => {
  await PromptAnywhere.close();
})

ipcMain.on('anywhere-resize', async (_, payload) => {
  await window.resizePromptAnywhere(payload.deltaX, payload.deltaY);
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

ipcMain.on('nestor-is-available', (event) => {
  event.returnValue = nestor !== null;
});

ipcMain.handle('nestor-get-status', async () => {
  return nestor ? await nestor.getStatus() : {}
});

ipcMain.handle('nestor-get-tools', async () => {
  return nestor ? await nestor.getTools() : []
});

ipcMain.handle('nestor-call-tool', async (_, payload) => {
  return nestor ? await nestor.callTool(payload.name, payload.parameters) : null
});

ipcMain.on('scratchpad-open', async () => {
  await window.openScratchPad();
});

ipcMain.on('computer-is-available', async (event) => {
  event.returnValue = await Computer.isAvailable();
});

ipcMain.on('computer-get-scaled-screen-size', (event) => {
  event.returnValue = Computer.getScaledScreenSize();
});

ipcMain.on('computer-get-screen-number', (event) => {
  event.returnValue = Computer.getScreenNumber();
});

ipcMain.on('computer-get-screenshot', async (event) => {
  event.returnValue = await Computer.takeScreenshot();
});

ipcMain.on('computer-execute-action', async (event, payload) => {
  event.returnValue = await Computer.executeAction(payload);
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
