
import process from 'node:process';
import { app, BrowserWindow, dialog, nativeTheme, systemPreferences, Menu, Notification } from 'electron';
import installExtension, { VUEJS_DEVTOOLS } from 'electron-devtools-installer';
import Store from 'electron-store';
import log from 'electron-log/main';

import AutoUpdater from './main/autoupdate';
import Automator from './automations/automator';
import Commander from './automations/commander';
import PromptAnywhere from './automations/anywhere';
import ReadAloud from './automations/readaloud';
import Transcriber from './automations/transcriber';
import DocumentRepository from './rag/docrepo';
import DocumentMonitor from './rag/docmonitor';
import MemoryManager from './main/memory';
import TrayIconManager from './main/tray';
import Scheduler from './main/scheduler';
import Mcp from './main/mcp';

import { fixPath } from './main/utils';
//import { useI18n } from './main/i18n';
import { installIpc } from './main/ipc';
import { importOpenAI } from './main/import_oai';

import * as config from './main/config';
import * as shortcuts from './main/shortcuts';
import * as window from './main/window';
import * as menu from './main/menu';
import * as backup from './main/backup';
import * as workspace from './main/workspace';

let mcp: Mcp;
let scheduler: Scheduler;
let autoUpdater: AutoUpdater;
let docMonitor: DocumentMonitor;
let trayIconManager: TrayIconManager;

// first-thing: single instance
// on darwin this is done through Info.plist (LSMultipleInstancesProhibited)
if (process.platform !== 'darwin' && !process.env.TEST) {
  const gotTheLock = app.requestSingleInstanceLock();
  if (!gotTheLock) {
    app.quit();
    process.exit(0);
  }
}

// changes path
if (process.env.WITSY_HOME) {
  const originalGetPath = app.getPath;
  app.getPath = (name: string) => {
    if (name === 'userData') {
      return process.env.WITSY_HOME;
    } else {
      return originalGetPath(name as any);
    }
  }
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
    openMain: window.openMainWindow,
    scratchpad: window.openScratchPad,
    settings: window.openSettingsWindow,
    studio: window.openDesignStudioWindow,
    forge: window.openAgentForgeWindow,
    backupExport: async () => await backup.exportBackup(app),
    backupImport: async () => await backup.importBackup(app, quitApp),
    importOpenAI: async () => await importOpenAI(app, settings.workspaceId),
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

// this needs to be done before onReady
if (process.platform === 'darwin') {
  systemPreferences.setUserDefault('NSDisabledDictationMenuItem', 'boolean', true)
  //systemPreferences.setUserDefault('NSDisabledCharacterPaletteMenuItem', 'boolean', true)
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(async () => {

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

  // initialize current workspace
  workspace.initializeWorkspace(app, settings.workspaceId)

  // error
  if (config.settingsFileHadError()) {
    const { useI18n } = await import('./main/i18n');
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

  // auto-updater (we need it now for menu)
  autoUpdater = new AutoUpdater(app, {
    preInstall: () => {
      quitApp();
    },
    onUpdateAvailable: () => {
      window.notifyBrowserWindows('update-available');
      trayIconManager.install();
    },
  });

  // tray icon
  trayIconManager = new TrayIconManager(app, autoUpdater, quitApp);  
  
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
  await fixPath()
  mcp = new Mcp(app);
  mcp.connect();

  // and now scheduler
  scheduler = new Scheduler(app, mcp);
  scheduler.start();

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

  // request notification permission
  new Notification();

  // create the document repository
  const docRepo = new DocumentRepository(app);
  docRepo.scanForUpdates(() => {
    docMonitor = new DocumentMonitor(app, docRepo);
    docMonitor.start();
  });

  // create the memory manager
  const memoryManager = new MemoryManager(app);

  // some platforms have a one-time automator initialization to do so give them a chance
  new Automator();

  // install IPC handlers
  installIpc(store, autoUpdater, docRepo, memoryManager, mcp, installMenu, registerShortcuts, quitApp);

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
  try { docMonitor.stop(); } catch { /* empty */ }
  try { mcp?.shutdown(); } catch { /* empty */ }
})

// vscode debugging
app.on('render-process-gone', () => {
  quitAnyway = true;
  app.quit();
})
