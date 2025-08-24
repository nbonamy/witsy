
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

import { fixPath, putCachedText } from './main/utils';
import { useI18n } from './main/i18n';
import { installIpc } from './main/ipc';
import { importOpenAI } from './main/import_oai';
import * as httpServer from './main/httpServer';

import * as config from './main/config';
import * as shortcuts from './main/shortcuts';
import * as window from './main/window';
import * as menu from './main/menu';
import * as backup from './main/backup';

let mcp: Mcp = null
let scheduler: Scheduler = null;

// minimal HTTP server state/config
type HttpCfg = { enabled: boolean; port: number };
let httpCfg: HttpCfg = { enabled: false, port: 18081 };

const getHttpConfig = (settings: any): HttpCfg => {
  const s = settings as any;
  const enabled = s?.httpServerEnabled ?? s?.features?.httpServerEnabled ?? false;
  const port = Number(s?.httpServerPort ?? s?.features?.httpServerPort ?? 18081);
  return { enabled: !!enabled, port: isNaN(port) ? 18081 : port };
};

const handleHttpCmd = async (
  cmd: string,
  params?: { text?: string }
): Promise<boolean> => {
  try {
    switch ((cmd || '').toLowerCase()) {
      case 'prompt': {
        if (params?.text) {
          const promptId = putCachedText(params.text);
          await window.openPromptAnywhere({ promptId });
        } else {
          await PromptAnywhere.open();
        }
        return true;
      }
      case 'chat':
        await window.openMainWindow({ queryParams: { view: 'chat' } });
        return true;
      case 'scratchpad':
        await window.openScratchPad();
        return true;
      case 'command': {
        if (params?.text) {
          const textId = putCachedText(params.text);
          const automator = new Automator();
          const sourceApp = await automator.getForemostApp();
          await window.openCommandPicker({ textId, sourceApp, startTime: Date.now() });
          return true;
        }
        await Commander.initCommand(app);
        return true;
      }
      case 'readaloud':
        await ReadAloud.read(app);
        return true;
      case 'transcribe':
        await Transcriber.initTranscription();
        return true;
      case 'realtime':
        await window.openRealtimeChatWindow();
        return true;
      case 'studio':
        await window.openDesignStudioWindow();
        return true;
      case 'forge':
        await window.openAgentForgeWindow();
        return true;
      default:
        return false;
    }
  } catch (e) {
    console.warn('HTTP trigger handler error:', e);
    return false;
  }
};

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
    importOpenAI: async () => await importOpenAI(app),
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

// document monitor (will be initialized in app.on('ready'))
let docMonitor: DocumentMonitor;

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

  // start minimal HTTP server if enabled (no dependencies, localhost only)
  httpCfg = getHttpConfig(settings);
  if (httpCfg.enabled) {
    httpServer.start(httpCfg.port, handleHttpCmd);
  }

  // start mcp
  if (!process.mas) {
    await fixPath()
    mcp = new Mcp(app);
    mcp.connect();
  }

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

    // (PR2) HTTP server: react to config changes (enable/port)
    try {
      const newSettings = config.loadSettings(app);
      const newCfg = getHttpConfig(newSettings);
      if (newCfg.enabled !== httpCfg.enabled || newCfg.port !== httpCfg.port) {
        httpServer.stop();
        if (newCfg.enabled) {
          httpServer.start(newCfg.port, handleHttpCmd);
        }
        httpCfg = newCfg;
      }
    } catch (e) {
      console.warn('HTTP server reconfigure failed:', e);
    }

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
