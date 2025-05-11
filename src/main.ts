
import { History, Command, Expert } from './types/index';
import { Configuration } from './types/config';
import { Application, RunCommandParams } from './types/automation';
import { McpTool } from './types/mcp';
import { LlmTool } from 'multi-llm-ts';

import process from 'node:process';
import fontList from 'font-list';
import { app, BrowserWindow, ipcMain, nativeImage, clipboard, dialog, nativeTheme, systemPreferences, Menu } from 'electron';
import installExtension, { VUEJS_DEVTOOLS } from 'electron-devtools-installer';
import { PythonShell } from 'python-shell';
import Store from 'electron-store';
import log from 'electron-log/main';
import { fixPath, getCachedText, wait } from './main/utils';

import AutoUpdater from './main/autoupdate';
import Commander, { notEditablePrompts } from './automations/commander';
import PromptAnywhere from './automations/anywhere';
import ReadAloud from './automations/readaloud';
import Transcriber from './automations/transcriber';
import DocumentRepository from './rag/docrepo';
import MemoryManager from './main/memory';
import LocalSearch from './main/search';
import Embedder from './rag/embedder';
import Mcp from './main/mcp';
import Computer from './main/computer';
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
import * as i18n from './main/i18n';
import * as debug from './main/network';
import Automator, { AutomationAction } from 'automations/automator';
import { useI18n } from './main/i18n';

let commander: Commander = null
let docRepo: DocumentRepository = null
let memoryManager: MemoryManager = null
let mcp: Mcp = null

// first-thing: single instance
// on darwin/mas this is done through Info.plist (LSMultipleInstancesProhibited)
if (process.platform !== 'darwin' && !process.env.TEST) {
  const gotTheLock = app.requestSingleInstanceLock();
  if (!gotTheLock) {
    app.quit();
    process.exit(0);
  }
}

// changes path
if (process.env.WITSY_HOME) {
  app.getPath = (name: string) => `${process.env.WITSY_HOME}/${name}`;
}

// set up logging
Object.assign(console, log.functions);
log.eventLogger.startLogging();
console.log('Log file:',log.transports.file.getFile().path);

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
// eslint-disable-next-line @typescript-eslint/no-require-imports
if (require('electron-squirrel-startup')) {
  app.quit();
}

// auto-update
const autoUpdater = new AutoUpdater(app, {
  preInstall: () => quitAnyway = true,
  onUpdateAvailable: () => {
    window.notifyBrowserWindows('update-available');
    trayIconManager.install();
  },
});

// open store
const store = new Store({ name: 'window' });
window.setStore(store);

// this is going to be called later
const registerShortcuts = () => {
  shortcuts.registerShortcuts(app, {
    prompt: PromptAnywhere.open,
    chat: window.openMainWindow,
    command: () => Commander.initCommand(app),
    readaloud: () => ReadAloud.read(app),
    transcribe: Transcriber.initTranscription,
    scratchpad: window.openScratchPad,
    realtime: window.openRealtimeChatWindow,
    studio: window.openDesignStudioWindow,
  });
}

// quit at all costs
let quitAnyway = false;
const quitApp = () => {
  quitAnyway = true;
  app.quit();
}

//  tray icon
const trayIconManager = new TrayIconManager(app, autoUpdater, quitApp);

// this needs to be done before onReady
if (process.platform === 'darwin') {
  systemPreferences.setUserDefault('NSDisabledDictationMenuItem', 'boolean', true)
  //systemPreferences.setUserDefault('NSDisabledCharacterPaletteMenuItem', 'boolean', true)
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {

  // check if run from app folder
  if (process.platform === 'darwin' && !process.env.DEBUG && !process.env.TEST && !app.isInApplicationsFolder()) {
    dialog.showMessageBox({
      type: 'error',
      message: 'You need to run Witsy from the Applications folder. Move the app icon there and try again.',
      detail: 'If you already moved the app icon there, make sure you run Witsy from the Applications folder.',
      buttons: ['OK'],
    });
    quitApp();
    return;
  }

  // we need settings
  const settings = config.loadSettings(app);

  // error
  if (config.settingsFileHadError()) {
    const t = useI18n(app)
    dialog.showMessageBox({
      type: 'error',
      message: t('settings.load.error.title'),
      detail: t('settings.load.error.text'),
    })
  }

  // proxy
  if (settings.general.bypassProxy) {
    app.commandLine.appendSwitch('no-proxy-server');
  }

  // debugging
  if (process.env.DEBUG) {
    installExtension(VUEJS_DEVTOOLS)
      .then((name) => console.log(`Added Extension:  ${name}`))
      .catch((err) => console.log('An error while installing Extension: ', err));
  }

  // set theme
  nativeTheme.themeSource = settings.appearance.theme;

  // install the menu
  const installMenu = () => {
    menu.installMenu(app, {
      quit: app.quit,
      checkForUpdates: autoUpdater.check,
      quickPrompt: PromptAnywhere.open,
      newChat: window.openMainWindow,
      scratchpad: window.openScratchPad,
      settings: window.openSettingsWindow,
      studio: window.openDesignStudioWindow,
    }, settings.shortcuts);
  }
  window.addWindowListener({
    onWindowCreated: installMenu,
    onWindowTitleChanged: installMenu,
    onWindowClosed: installMenu,
  });
  installMenu();

  // register shortcuts
  registerShortcuts();

  // start mcp
  if (!process.mas) {
    fixPath().then(() => {
      mcp = new Mcp(app);
      mcp.connect();
    });
  }

  // create the main window
  if (!settings.general.hideOnStartup || process.env.TEST) {
    log.info('Creating initial main window');
    window.openMainWindow();
  } else {
    app.dock?.hide();
  }

  // on config change
  config.setOnSettingsChange(() => {

    console.log('Settings changed');

    // notify browser windows
    window.notifyBrowserWindows('file-modified', 'settings');

    // update tray icon
    trayIconManager.install();

    // update main menu
    installMenu();

  });

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

  // create the memory manager
  memoryManager = new MemoryManager(app);

  // some platforms have a one-time automator initialization to do so give them a chance
  new Automator();

  // we want some windows to be as fast as possible
  if (!process.env.TEST) {
    if (window.isSettingsWindowPersistent()) {
      window.prepareSettingsWindow();
    }
    window.preparePromptAnywhere();
    window.prepareCommandPicker();
  }
  
});

// called when the app is already running
app.on('second-instance', () => {
  window.openMainWindow();
});

//
app.on('before-quit', (ev) => {

  const closeAllWindows = () => {
    BrowserWindow.getAllWindows().forEach((win) => {
      win.removeAllListeners('close');
      win.close();
    });
  }

  // if force quit
  if (/*process.env.DEBUG ||*/ process.env.TEST || quitAnyway) {
    closeAllWindows();
    return;
  }

  // check settings
  const settings = config.loadSettings(app);
  if (!settings.general.keepRunning) {
    closeAllWindows();
    return;
  }

  // close all windows but do not quit
  BrowserWindow.getAllWindows().forEach((win) => win.close());
  ev.preventDefault();

  // clean up when debugging (vscode restarts the app)
  if (process.env.DEBUG) {
    trayIconManager.destroy();
    shortcuts.unregisterShortcuts();
  }

});

// real quit
app.on('will-quit', () => {
  try { Menu.setApplicationMenu(null)  } catch { /* empty */ }
  try { trayIconManager.destroy();  } catch { /* empty */ }
  try { shortcuts.unregisterShortcuts(); } catch { /* empty */ }
  try { mcp?.shutdown(); } catch { /* empty */ }
})

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

ipcMain.handle('show-dialog', (event, payload): Promise<Electron.MessageBoxReturnValue> => {
  return dialog.showMessageBox(payload);
});

ipcMain.on('show-debug-console', () => {
  window.openDebugWindow();
})

ipcMain.on('get-network-history', (event) => {
  event.returnValue = debug.getNetworkHistory();
})

ipcMain.on('clear-network-history', () => {
  debug.clearNetworkHistory();
})

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

ipcMain.on('clipboard-read-text', (event) => {
  const text = clipboard.readText();
  event.returnValue = text;
});

ipcMain.on('clipboard-write-text', (event, payload) => {
  clipboard.writeText(payload);
});

ipcMain.on('clipboard-write-image', (event, payload) => {
  const image = nativeImage.createFromPath(payload.replace('file://', ''))
  clipboard.writeImage(image);
});

ipcMain.on('config-get-locale-ui', (event) => {
  event.returnValue = i18n.getLocaleUI(app);
});

ipcMain.on('config-get-locale-llm', (event) => {
  event.returnValue = i18n.getLocaleLLM(app);
});

ipcMain.on('config-get-i18n-messages', (event) => {
  event.returnValue = i18n.getLocaleMessages(app);
});

ipcMain.on('config-load', (event) => {
  event.returnValue = JSON.stringify(config.loadSettings(app));
});

ipcMain.on('config-save', (event, payload) => {
  config.saveSettings(app, JSON.parse(payload) as Configuration);
});

ipcMain.on('history-load', async (event) => {
  event.returnValue = JSON.stringify(await history.loadHistory(app));
});

ipcMain.on('history-save', (event, payload) => {
  event.returnValue = history.saveHistory(app, JSON.parse(payload) as History);
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

ipcMain.on('command-picker-close', async (_, sourceApp: Application) => {
  window.closeCommandPicker(sourceApp);
});

ipcMain.on('command-is-prompt-editable', (event, payload) => {
  event.returnValue = !notEditablePrompts.includes(payload);
});

ipcMain.on('command-run', async (event, payload) => {

  // prepare
  const args = JSON.parse(payload);
  await window.closeCommandPicker();
  //await window.releaseFocus();

  // now run
  commander = new Commander();
  const result = await commander.execCommand(app, args as RunCommandParams);
  commander = null;
  
  // error
  if (!result) {
    return;
  }

  // focus
  try {
    await wait();
    app.show();
    app.focus({
      steal: true,
    });
  } catch { /* empty */ }
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

ipcMain.on('settings-open', (event, payload) => {
  window.openSettingsWindow(payload);
});

ipcMain.on('settings-close', () => {
  window.closeSettingsWindow();
});

ipcMain.on('run-at-login-get', (event) => {
  event.returnValue = app.getLoginItemSettings();
});

ipcMain.on('run-at-login-set', (_, value) => {
  if (app.getLoginItemSettings().openAtLogin != value) {
    app.setLoginItemSettings({
      openAtLogin: value,
      openAsHidden: true,
    });
  }
});

ipcMain.on('shortcuts-register', () => {
  registerShortcuts();
});

ipcMain.on('shortcuts-unregister', () => {
  shortcuts.unregisterShortcuts();
});

ipcMain.on('fullscreen', (_, payload) => {
  if (payload.window === 'main') {
    window.mainWindow.setFullScreen(payload.state);
  } else if (payload.window === 'create') {
    window.mainWindow.setFullScreen(payload.state);
  }
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

ipcMain.on('get-app-info', async (event, payload) => {
  event.returnValue = await file.getAppInfo(app, payload);
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
    console.log('Error while running python', error);
    event.returnValue = {
      error: error || 'Unknown error'
    }
  }
})

ipcMain.on('automation-get-text', (event, payload) => {
  event.returnValue = getCachedText(payload);
})

ipcMain.on('automation-insert', async (_, payload) => {
  const { text, sourceApp } = payload
  await Automator.automate(text, sourceApp, AutomationAction.INSERT_BELOW);
})

ipcMain.on('automation-replace', async (_, payload) => {
  const { text, sourceApp } = payload
  await Automator.automate(text, sourceApp, AutomationAction.REPLACE);
})

ipcMain.on('chat-open', async (_, chatId) => {
  await window.openMainWindow({ queryParams: { chatId: chatId } });
})

ipcMain.on('anywhere-prompt', async () => {
  await PromptAnywhere.open();
});

ipcMain.on('anywhere-close', async (_, sourceApp: Application) => {
  await PromptAnywhere.close(sourceApp);
})

ipcMain.on('anywhere-resize', async (_, payload) => {
  await window.resizePromptAnywhere(payload.deltaX, payload.deltaY);
})

ipcMain.on('readaloud-close-palette', async (_, sourceApp: Application) => {
  await window.releaseFocus({ sourceApp });
  await window.closeReadAloudPalette();
});

ipcMain.on('transcribe-start', async () => {
  await Transcriber.initTranscription();
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

ipcMain.on('mcp-is-available', (event) => {
  event.returnValue = mcp !== null;
});

ipcMain.on('mcp-get-servers', (event) => {
  event.returnValue = mcp ? mcp.getServers() : [];
});

ipcMain.handle('mcp-edit-server', async (_, server): Promise<boolean> => {
  return mcp ? await mcp.editServer(JSON.parse(server)) : false;
});

ipcMain.handle('mcp-delete-server', async (_, uuid): Promise<boolean> => {
  return await mcp?.deleteServer(uuid) || false;
});

ipcMain.on('mcp-get-install-command', (event, payload) => {
  const { registry, server } = payload;
  event.returnValue = mcp ? mcp.getInstallCommand(registry, server) : '';
});

ipcMain.handle('mcp-install-server', async (_, payload): Promise<boolean> => {
  const { registry, server } = payload;
  return await mcp?.installServer(registry, server) || false;
});

ipcMain.handle('mcp-reload', async () => {
  await mcp?.reload();
});

ipcMain.on('mcp-get-status', (event): void => {
  event.returnValue = mcp ? mcp.getStatus() : null;
});

ipcMain.handle('mcp-get-server-tools', async (_, payload): Promise<McpTool[]> => {
  return mcp ? await mcp.getServerTools(payload) : [];
});

ipcMain.handle('mcp-get-tools', async (): Promise<LlmTool[]> => {
  return mcp ? await mcp.getTools() : [];
});

ipcMain.handle('mcp-call-tool', async (_, payload) => {
  return mcp ? await mcp.callTool(payload.name, payload.parameters) : null;
});

ipcMain.on('mcp-original-tool-name', (event, payload) => {
  event.returnValue = mcp ? mcp.originalToolName(payload) : null;
});

ipcMain.on('scratchpad-open', async (_, payload) => {
  await window.openScratchPad(payload);
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

ipcMain.on('computer-start', async () => {
  window.mainWindow?.minimize();
  window.openComputerStatusWindow();
});

ipcMain.on('computer-close', async () => {
  window.closeComputerStatusWindow();
  window.mainWindow?.restore();
});

ipcMain.on('computer-stop', async () => {
  try {
    window.mainWindow?.webContents.send('computer-stop');
  } catch { /* empty */ }
});

ipcMain.on('computer-status', async (_, payload) => {
  try {
    window.computerStatusWindow?.webContents.send('computer-status', payload);
  } catch { /* empty */ }
});

ipcMain.on('memory-reset', async () => {
  await memoryManager.reset();
});

ipcMain.on('memory-has-facts', async (event) => {
  event.returnValue = await memoryManager.isNotEmpty();
});

ipcMain.on('memory-facts', async (event) => {
  event.returnValue = await memoryManager.list();
});

ipcMain.on('memory-store', async (event, payload) => {
  event.returnValue = await memoryManager.store(payload);
});

ipcMain.on('memory-retrieve', async (event, payload) => {
  event.returnValue = await memoryManager.query(payload);
});

ipcMain.on('memory-delete', async (event, payload) => {
  event.returnValue = await memoryManager.delete(payload);
});

ipcMain.handle('search-query', async (_, payload) => {
  const { query, num } = payload;
  const localSearch = new LocalSearch();
  const results = localSearch.search(query, num);
  return results;
});

ipcMain.on('studio-start', () => {
  window.openDesignStudioWindow();
})

ipcMain.on('voice-mode-start', () => {
  window.openRealtimeChatWindow();
})


