
import { History, Command, Expert } from './types/index';
import { Configuration } from './types/config';
import { Application, RunCommandParams } from './types/automation';
import { McpInstallStatus, McpTool } from './types/mcp';
import { LlmTool } from 'multi-llm-ts';
import * as IPC from './ipc_consts';

import process from 'node:process';
import fontList from 'font-list';
import { app, BrowserWindow, ipcMain, nativeImage, clipboard, dialog, nativeTheme, systemPreferences, Menu, Notification, shell } from 'electron';
import installExtension, { VUEJS_DEVTOOLS } from 'electron-devtools-installer';
import Store from 'electron-store';
import log from 'electron-log/main';
import { fixPath, getCachedText } from './main/utils';

import AutoUpdater from './main/autoupdate';
import Automator from './automations/automator';
import Automation, { AutomationAction } from './automations/automation'
import Commander, { askMeAnythingId, notEditablePrompts } from './automations/commander';
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
import * as agents from './main/agents';
import * as file from './main/file';
import * as shortcuts from './main/shortcuts';
import * as window from './main/window';
import * as markdown from './main/markdown';
import * as menu from './main/menu';
import * as text from './main/text';
import * as i18n from './main/i18n';
import * as debug from './main/network';
import * as interpreter from './main/interpreter';
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
    window.notifyBrowserWindows(IPC.UPDATE_AVAILABLE);
    trayIconManager.install();
  },
});

// open store
const store = new Store({ name: 'window' });
window.setStore(store);

// this is going to be called later
const installMenu = () => {
  const settings = config.loadSettings(app);
  menu.installMenu(app, {
    quit: app.quit,
    checkForUpdates: autoUpdater.check,
    quickPrompt: PromptAnywhere.open,
    newChat: window.openMainWindow,
    scratchpad: window.openScratchPad,
    settings: window.openSettingsWindow,
    studio: window.openDesignStudioWindow,
    forge: window.openAgentForgeWindow,
  }, settings.shortcuts);
}

// this is going to be called later
const registerShortcuts = () => {
  shortcuts.registerShortcuts(app, {
    prompt: PromptAnywhere.open,
    chat: () => window.openMainWindow({ queryParams: { view: 'chat' } }),
    command: () => Commander.initCommand(app),
    readaloud: () => ReadAloud.read(app),
    transcribe: Transcriber.initTranscription,
    scratchpad: window.openScratchPad,
    realtime: window.openRealtimeChatWindow,
    studio: window.openDesignStudioWindow,
    forge: window.openAgentForgeWindow,
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
  if (settings.general.proxyMode === 'bypass') {
    app.commandLine.appendSwitch('no-proxy-server');
  } else if (settings.general.proxyMode === 'custom' && settings.general.customProxy?.length) {
    app.commandLine.appendSwitch('proxy-server', settings.general.customProxy);
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
  window.addWindowListener({
    onWindowCreated: () => setTimeout(installMenu, 500), 
    onWindowFocused: () => setTimeout(installMenu, 500), 
    onWindowTitleChanged: () => setTimeout(installMenu, 500), 
    onWindowClosed: () => setTimeout(installMenu, 500), 
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
    window.openMainWindow({ queryParams: { view: 'chat'} });
  } else {
    app.dock?.hide();
  }

  // on config change
  config.setOnSettingsChange(() => {

    console.log('Settings changed');

    // notify browser windows
    window.notifyBrowserWindows(IPC.FILE_MODIFIED, 'settings');

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

  // request notification permission
  new Notification();

  // create the document repository
  docRepo = new DocumentRepository(app);

  // create the memory manager
  memoryManager = new MemoryManager(app);

  // some platforms have a one-time automator initialization to do so give them a chance
  new Automator();

  // we want some windows to be as fast as possible
  if (!process.env.TEST) {
    window.prepareMainWindow();
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

    // close all windows
    BrowserWindow.getAllWindows().forEach((win) => {
      win.removeAllListeners('close');
      win.close();
    });

    // clean up when debugging (vscode restarts the app)
    if (process.env.DEBUG) {
      trayIconManager.destroy();
      shortcuts.unregisterShortcuts();
    }

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

});

// real quit
app.on('will-quit', () => {
  try { Menu.setApplicationMenu(null)  } catch { /* empty */ }
  try { trayIconManager.destroy();  } catch { /* empty */ }
  try { shortcuts.unregisterShortcuts(); } catch { /* empty */ }
  try { mcp?.shutdown(); } catch { /* empty */ }
})

// vscode debugging
app.on('render-process-gone', () => {
  quitAnyway = true;
  app.quit();
})

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and import them here.

ipcMain.on(IPC.MAIN_WINDOW_SET_MODE, (event, mode) => {
  window.setMainWindowMode(mode);
  installMenu();
});

ipcMain.on(IPC.MAIN_WINDOW_CLOSE, () => {
  window.mainWindow.close();
});

ipcMain.on(IPC.SHOW_ABOUT, () => {
  app.showAboutPanel();
});

ipcMain.on(IPC.UPDATE_CHECK, () => {
  autoUpdater.check()
})

ipcMain.on(IPC.UPDATE_IS_AVAILABLE, (event) => {
  event.returnValue = autoUpdater.updateAvailable;
});

ipcMain.on(IPC.UPDATE_APPLY, () => {
  autoUpdater.install();
});

ipcMain.on(IPC.SET_APPEARANCE_THEME, (event, theme) => {
  nativeTheme.themeSource = theme;
  event.returnValue = theme;
});

ipcMain.handle(IPC.SHOW_DIALOG, (event, payload): Promise<Electron.MessageBoxReturnValue> => {
  return dialog.showMessageBox(payload);
});

ipcMain.on(IPC.SHOW_DEBUG_CONSOLE, () => {
  window.openDebugWindow();
})

ipcMain.on(IPC.GET_NETWORK_HISTORY, (event) => {
  event.returnValue = debug.getNetworkHistory();
})

ipcMain.on(IPC.CLEAR_NETWORK_HISTORY, () => {
  debug.clearNetworkHistory();
})

ipcMain.on(IPC.OPEN_APP_FOLDER, (event, name) => {
  shell.openPath(app.getPath(name))
})

ipcMain.on(IPC.GET_APP_PATH, (event) => {
  event.returnValue = app.getPath('userData');
});

ipcMain.on(IPC.FONTS_LIST, async (event) => {
  event.returnValue = process.mas ? [] : await fontList.getFonts();
});

ipcMain.on(IPC.STORE_GET_VALUE, (event, payload) => {
  event.returnValue = store.get(payload.key, payload.fallback);
});

ipcMain.on(IPC.STORE_SET_VALUE, (event, payload) => {
  store.set(payload.key, payload.value);
});

ipcMain.on(IPC.CLIPBOARD_READ_TEXT, (event) => {
  const text = clipboard.readText();
  event.returnValue = text;
});

ipcMain.on(IPC.CLIPBOARD_WRITE_TEXT, async (event, payload) => {
  event.returnValue = await Automation.writeTextToClipboard(payload);
});

ipcMain.on(IPC.CLIPBOARD_WRITE_IMAGE, (event, payload) => {
  const image = nativeImage.createFromPath(payload.replace('file://', ''))
  clipboard.writeImage(image);
  event.returnValue = true;
});

ipcMain.on(IPC.CONFIG_GET_LOCALE_UI, (event) => {
  event.returnValue = i18n.getLocaleUI(app);
});

ipcMain.on(IPC.CONFIG_GET_LOCALE_LLM, (event) => {
  event.returnValue = i18n.getLocaleLLM(app);
});

ipcMain.on(IPC.CONFIG_GET_I18N_MESSAGES, (event) => {
  event.returnValue = i18n.getLocaleMessages(app);
});

ipcMain.on(IPC.CONFIG_LOAD, (event) => {
  event.returnValue = JSON.stringify(config.loadSettings(app));
});

ipcMain.on(IPC.CONFIG_SAVE, (event, payload) => {
  config.saveSettings(app, JSON.parse(payload) as Configuration);
});

ipcMain.on(IPC.HISTORY_LOAD, async (event) => {
  event.returnValue = JSON.stringify(await history.loadHistory(app));
});

ipcMain.on(IPC.HISTORY_SAVE, (event, payload) => {
  event.returnValue = history.saveHistory(app, JSON.parse(payload) as History);
});

ipcMain.on(IPC.COMMANDS_LOAD, (event) => {
  event.returnValue = JSON.stringify(commands.loadCommands(app));
});

ipcMain.on(IPC.COMMANDS_SAVE, (event, payload) => {
  event.returnValue = commands.saveCommands(app, JSON.parse(payload) as Command[]);
});

ipcMain.on(IPC.COMMANDS_EXPORT, (event) => {
  event.returnValue = commands.exportCommands(app);
});

ipcMain.on(IPC.COMMANDS_IMPORT, (event) => {
  event.returnValue = commands.importCommands(app);
});

ipcMain.on(IPC.COMMAND_PICKER_CLOSE, async (_, sourceApp: Application) => {
  window.closeCommandPicker(sourceApp);
});

ipcMain.on(IPC.COMMANDS_ASK_ME_ANYTHING_ID, (event) => {
  event.returnValue = askMeAnythingId;
});

ipcMain.on(IPC.COMMANDS_IS_PROMPT_EDITABLE, (event, payload) => {
  event.returnValue = !notEditablePrompts.includes(payload);
});

ipcMain.on(IPC.COMMAND_RUN, async (event, payload) => {

  // prepare
  const args: RunCommandParams = JSON.parse(payload);
  await window.closeCommandPicker(args.sourceApp);
  //await window.releaseFocus();

  // now run
  commander = new Commander();
  await commander.execCommand(app, args);
  commander = null;
  
});

ipcMain.on(IPC.EXPERTS_LOAD, (event) => {
  event.returnValue = JSON.stringify(experts.loadExperts(app));
});

ipcMain.on(IPC.EXPERTS_SAVE, (event, payload) => {
  event.returnValue = experts.saveExperts(app, JSON.parse(payload) as Expert[]);
});

ipcMain.on(IPC.EXPERTS_EXPORT, (event) => {
  event.returnValue = experts.exportExperts(app);
});

ipcMain.on(IPC.EXPERTS_IMPORT, (event) => {
  event.returnValue = experts.importExperts(app);
});

ipcMain.on(IPC.AGENTS_OPEN_FORGE,  () => {
  //window.openAgentForgeWindow();
});

ipcMain.on(IPC.AGENTS_LOAD, (event) => {
  event.returnValue = JSON.stringify(agents.loadAgents(app));
});

ipcMain.on(IPC.AGENTS_SAVE, (event, payload) => {
  event.returnValue = agents.saveAgent(app, JSON.parse(payload));
});

ipcMain.on(IPC.AGENTS_DELETE, (event, payload) => {
  event.returnValue = agents.deleteAgent(app, payload);
});

ipcMain.on(IPC.AGENTS_GET_RUNS, (event, agentId) => {
  event.returnValue = JSON.stringify(agents.getAgentRuns(app, agentId));
});

ipcMain.on(IPC.AGENTS_SAVE_RUN, (event, payload) => {
  event.returnValue = agents.saveAgentRun(app, JSON.parse(payload));
});

ipcMain.on(IPC.AGENTS_DELETE_RUN, (event, payload) => {
  const { agentId, runId } = JSON.parse(payload);
  event.returnValue = agents.deleteAgentRun(app, agentId, runId);
});

ipcMain.on(IPC.AGENTS_DELETE_RUNS, (event, payload) => {
  event.returnValue = agents.deleteAgentRuns(app, payload);
});

ipcMain.on(IPC.SETTINGS_OPEN, (event, payload) => {
  window.openSettingsWindow(payload);
});

ipcMain.on(IPC.RUN_AT_LOGIN_GET, (event) => {
  event.returnValue = app.getLoginItemSettings();
});

ipcMain.on(IPC.RUN_AT_LOGIN_SET, (_, value) => {
  if (app.getLoginItemSettings().openAtLogin != value) {
    app.setLoginItemSettings({
      openAtLogin: value,
      openAsHidden: true,
    });
  }
});

ipcMain.on(IPC.SHORTCUTS_REGISTER, () => {
  registerShortcuts();
});

ipcMain.on(IPC.SHORTCUTS_UNREGISTER, () => {
  shortcuts.unregisterShortcuts();
});

ipcMain.on(IPC.FULLSCREEN, (_, payload) => {
  if (payload.window === 'main') {
    window.mainWindow.setFullScreen(payload.state);
  } else if (payload.window === 'create') {
    window.mainWindow.setFullScreen(payload.state);
  }
});

ipcMain.on(IPC.DELETE_FILE, (event, payload) => {
  event.returnValue = file.deleteFile(app, payload);
});

ipcMain.on(IPC.PICK_FILE, (event, payload) => {
  event.returnValue = file.pickFile(app, JSON.parse(payload));
});

ipcMain.on(IPC.PICK_DIRECTORY, (event) => {
  event.returnValue = file.pickDirectory(app);
});

ipcMain.on(IPC.FIND_PROGRAM, (event, payload) => {
  event.returnValue = file.findProgram(app, payload);
});

ipcMain.on(IPC.READ_FILE, (event, payload) => {
  event.returnValue = file.getFileContents(app, payload);
});

ipcMain.on(IPC.READ_ICON, async (event, payload) => {
  event.returnValue = await file.getIconContents(app, payload);
});

ipcMain.on(IPC.SAVE_FILE, (event, payload) => {
  event.returnValue = file.writeFileContents(app, JSON.parse(payload));
});

ipcMain.on(IPC.DOWNLOAD, async (event, payload) => {
  event.returnValue = await file.downloadFile(app, JSON.parse(payload));
});

ipcMain.on(IPC.GET_TEXT_CONTENT, async (event, contents, format) => {
  event.returnValue = await text.getTextContent(contents, format);
});

ipcMain.on(IPC.GET_APP_INFO, async (event, payload) => {
  event.returnValue = await file.getAppInfo(app, payload);
});

ipcMain.on(IPC.LIST_DIRECTORY, (event, dirPath, includeHidden) => {
  try {
    event.returnValue = {
      success: true,
      items: file.listDirectory(app, dirPath, includeHidden)
    }
  } catch (error) {
    console.error('Error while listing directory', error);
    event.returnValue = {
      success: false,
      error: error.message
    }
  }
});

ipcMain.on(IPC.FILE_EXISTS, (event, filePath) => {
  event.returnValue = file.fileExists(app, filePath);
});

ipcMain.on(IPC.WRITE_FILE, (event, filePath, content) => {
  event.returnValue = file.writeFile(app, filePath, content);
});

ipcMain.on(IPC.NORMALIZE_PATH, (event, filePath) => {
  event.returnValue = file.normalizePath(app, filePath);
});

ipcMain.on(IPC.MARKDOWN_RENDER, (event, payload) => {
  event.returnValue = markdown.renderMarkdown(payload);
});

ipcMain.on(IPC.CODE_PYTHON_RUN, async (event, payload) => {
  try {
    const result = await interpreter.runPython(payload);
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

ipcMain.on(IPC.AUTOMATION_GET_TEXT, (event, payload) => {
  event.returnValue = getCachedText(payload);
})

ipcMain.on(IPC.AUTOMATION_INSERT, async (event, payload) => {
  const { text, sourceApp } = payload
  event.returnValue = await Automation.automate(text, sourceApp, AutomationAction.INSERT_BELOW);
})

ipcMain.on(IPC.AUTOMATION_REPLACE, async (event, payload) => {
  const { text, sourceApp } = payload
  event.returnValue = await Automation.automate(text, sourceApp, AutomationAction.REPLACE);
})

ipcMain.on(IPC.CHAT_OPEN, async (_, chatId) => {
  await window.openMainWindow({ queryParams: { view: 'chat', chatId: chatId } });
})

ipcMain.on(IPC.ANYWHERE_PROMPT, async () => {
  await PromptAnywhere.open();
});

ipcMain.on(IPC.ANYWHERE_CLOSE, async (_, sourceApp: Application) => {
  await PromptAnywhere.close(sourceApp);
})

ipcMain.on(IPC.ANYWHERE_RESIZE, async (_, payload) => {
  await window.resizePromptAnywhere(payload.deltaX, payload.deltaY);
})

ipcMain.on(IPC.READALOUD_CLOSE_PALETTE, async (_, sourceApp: Application) => {
  await window.releaseFocus({ sourceApp });
  await window.closeReadAloudPalette();
});

ipcMain.on(IPC.TRANSCRIBE_INSERT, async (_, payload) => {
  await Transcriber.insertTranscription(payload);
});

ipcMain.on(IPC.DOCREPO_OPEN, () => {
  window.openMainWindow({ queryParams: { view: 'docrepo' } });
});

ipcMain.on(IPC.DOCREPO_LIST, (event) => {
  event.returnValue = JSON.stringify(docRepo.list());
});

ipcMain.on(IPC.DOCREPO_CONNECT, async (event, baseId) => {
  try {
    await docRepo.connect(baseId, true);
    event.returnValue = true
  } catch (error) {
    console.error(error);
    event.returnValue = false
  }
});

ipcMain.on(IPC.DOCREPO_DISCONNECT, async (event) => {
  try {
    await docRepo.disconnect();
    event.returnValue = true
  } catch (error) {
    console.error(error);
    event.returnValue = false
  }
});

ipcMain.on(IPC.DOCREPO_CREATE, async (event, payload) => {
  try {
    const { title, embeddingEngine, embeddingModel } = payload;
    event.returnValue = await docRepo.create(title, embeddingEngine, embeddingModel);
  } catch (error) {
    console.error(error);
    event.returnValue = null
  }
});

ipcMain.on(IPC.DOCREPO_RENAME, async (event, payload) => {
  try {
    const { baseId, title } = payload;
    await docRepo.rename(baseId, title);
    event.returnValue = true
  } catch (error) {
    console.error(error);
    event.returnValue = false
  }
});

ipcMain.on(IPC.DOCREPO_DELETE, async (event, baseId) => {
  try {
    await docRepo.delete(baseId);
    event.returnValue = true
  } catch (error) {
    console.error(error);
    event.returnValue = false
  }
});

ipcMain.on(IPC.DOCREPO_ADD_DOCUMENT, async (_, payload) => {
  try {
    const { baseId, type, url } = payload;
    await docRepo.addDocument(baseId, type, url);
  } catch (error) {
    console.error(error);
  }
});

ipcMain.on(IPC.DOCREPO_REMOVE_DOCUMENT, async (event, payload) => {
  try {
    const { baseId, docId } = payload;
    console.log(IPC.DOCREPO_REMOVE_DOCUMENT, baseId, docId);
    await docRepo.removeDocument(baseId, docId);
    event.returnValue = true
  } catch (error) {
    console.error(error);
    event.returnValue = false
  }
});

ipcMain.handle(IPC.DOCREPO_QUERY, async(_, payload) => {
  try {
    const { baseId, text } = payload;
    console.log(IPC.DOCREPO_QUERY, baseId, text);
    const results = await docRepo.query(baseId, text);
    console.log('docrepo-query results returned = ', results.length);
    return results
  } catch (error) {
    console.error(error);
    return []
  }
});

ipcMain.on(IPC.DOCREPO_IS_EMBEDDING_AVAILABLE, async(event, payload) => {
  try {
    const { engine, model } = payload;
    event.returnValue = Embedder.isModelReady(app, engine, model);
  } catch (error) {
    console.error(error);
    event.returnValue = false
  }
});

ipcMain.on(IPC.MCP_IS_AVAILABLE, (event) => {
  event.returnValue = mcp !== null;
});

ipcMain.on(IPC.MCP_GET_SERVERS, (event) => {
  event.returnValue = mcp ? mcp.getServers() : [];
});

ipcMain.handle(IPC.MCP_EDIT_SERVER, async (_, server): Promise<boolean> => {
  return mcp ? await mcp.editServer(JSON.parse(server)) : false;
});

ipcMain.handle(IPC.MCP_DELETE_SERVER, async (_, uuid): Promise<boolean> => {
  return await mcp?.deleteServer(uuid) || false;
});

ipcMain.on(IPC.MCP_GET_INSTALL_COMMAND, (event, payload) => {
  const { registry, server } = payload;
  event.returnValue = mcp ? mcp.getInstallCommand(registry, server, '') : '';
});

ipcMain.handle(IPC.MCP_INSTALL_SERVER, async (_, payload): Promise<McpInstallStatus> => {
  const { registry, server, apiKey } = payload;
  return await mcp?.installServer(registry, server, apiKey) || 'error';
});

ipcMain.handle(IPC.MCP_RELOAD, async () => {
  await mcp?.reload();
});

ipcMain.on(IPC.MCP_GET_STATUS, (event): void => {
  event.returnValue = mcp ? mcp.getStatus() : null;
});

ipcMain.handle(IPC.MCP_GET_SERVER_TOOLS, async (_, payload): Promise<McpTool[]> => {
  return mcp ? await mcp.getServerTools(payload) : [];
});

ipcMain.handle(IPC.MCP_GET_TOOLS, async (): Promise<LlmTool[]> => {
  return mcp ? await mcp.getTools() : [];
});

ipcMain.handle(IPC.MCP_CALL_TOOL, async (_, payload) => {
  return mcp ? await mcp.callTool(payload.name, payload.parameters) : null;
});

ipcMain.on(IPC.MCP_ORIGINAL_TOOL_NAME, (event, payload) => {
  event.returnValue = mcp ? mcp.originalToolName(payload) : null;
});

ipcMain.on(IPC.SCRATCHPAD_OPEN, async (_, payload) => {
  await window.openScratchPad(payload);
});

ipcMain.on(IPC.COMPUTER_IS_AVAILABLE, async (event) => {
  event.returnValue = await Computer.isAvailable();
});

ipcMain.on(IPC.COMPUTER_GET_SCALED_SCREEN_SIZE, (event) => {
  event.returnValue = Computer.getScaledScreenSize();
});

ipcMain.on(IPC.COMPUTER_GET_SCREEN_NUMBER, (event) => {
  event.returnValue = Computer.getScreenNumber();
});

ipcMain.on(IPC.COMPUTER_GET_SCREENSHOT, async (event) => {
  event.returnValue = await Computer.takeScreenshot();
});

ipcMain.on(IPC.COMPUTER_EXECUTE_ACTION, async (event, payload) => {
  event.returnValue = await Computer.executeAction(payload);
});

ipcMain.on(IPC.COMPUTER_START, async () => {
  window.mainWindow?.minimize();
  window.openComputerStatusWindow();
});

ipcMain.on(IPC.COMPUTER_CLOSE, async () => {
  window.closeComputerStatusWindow();
  window.mainWindow?.restore();
});

ipcMain.on(IPC.COMPUTER_STOP, async () => {
  try {
    window.mainWindow?.webContents.send(IPC.COMPUTER_STOP);
  } catch { /* empty */ }
});

ipcMain.on(IPC.COMPUTER_STATUS, async (_, payload) => {
  try {
    window.computerStatusWindow?.webContents.send(IPC.COMPUTER_STATUS, payload);
  } catch { /* empty */ }
});

ipcMain.on(IPC.MEMORY_RESET, async () => {
  await memoryManager.reset();
});

ipcMain.on(IPC.MEMORY_HAS_FACTS, async (event) => {
  event.returnValue = await memoryManager.isNotEmpty();
});

ipcMain.on(IPC.MEMORY_FACTS, async (event) => {
  event.returnValue = await memoryManager.list();
});

ipcMain.on(IPC.MEMORY_STORE, async (event, payload) => {
  event.returnValue = await memoryManager.store(payload);
});

ipcMain.on(IPC.MEMORY_RETRIEVE, async (event, payload) => {
  event.returnValue = await memoryManager.query(payload);
});

ipcMain.on(IPC.MEMORY_DELETE, async (event, payload) => {
  event.returnValue = await memoryManager.delete(payload);
});

ipcMain.handle(IPC.SEARCH_QUERY, async (_, payload) => {
  const { query, num } = payload;
  const localSearch = new LocalSearch();
  const results = localSearch.search(query, num);
  return results;
});

ipcMain.on(IPC.STUDIO_START, () => {
  window.openDesignStudioWindow();
})

ipcMain.on(IPC.VOICE_MODE_START, () => {
  window.openRealtimeChatWindow();
})


