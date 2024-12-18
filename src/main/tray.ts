
import { App, Tray, Menu, nativeImage } from 'electron';
import AutoUpdater from './autoupdate';
import Commander from '../automations/commander';
import PromptAnywhere from '../automations/anywhere';
import ReadAloud from '../automations/readaloud';
import Transcriber from '../automations/transcriber';
import * as config from './config';
import * as window from './window';
import * as shortcuts from './shortcuts';
import path from 'path';

export default class {

  app: App
  autoUpdater: AutoUpdater
  quit: CallableFunction
  tray: Tray

  constructor(app: App, autoUpdater: AutoUpdater, quit: CallableFunction) {
    this.app = app;
    this.quit = quit;
    this.autoUpdater = autoUpdater;
  }

  install = () => {

    // delete previous one
    if (this.tray) {
      this.tray.destroy();
    }
  
    // need to know if an update is available
    const updateAvailable = this.autoUpdater.updateAvailable;
  
    // tray icon
    const assetsFolder = process.env.DEBUG ? path.resolve('./assets') : process.resourcesPath;
    const iconColor = process.platform === 'linux' ? 'White' : 'Template';
    const trayIconPath = path.join(assetsFolder, updateAvailable ? `bulbUpdate${iconColor}@2x.png` : `bulb${iconColor}@2x.png`);
    //console.log('trayIconPath', trayIconPath);
    const trayIcon = nativeImage.createFromPath(trayIconPath);
    trayIcon.setTemplateImage(true);
  
    // create tray
    this.tray = new Tray(trayIcon);
    this.tray.setContextMenu(Menu.buildFromTemplate(this.buildTrayMenu()));
    this.tray.on('click', () => {
      const contextMenu = Menu.buildFromTemplate(this.buildTrayMenu());
      this.tray.setContextMenu(contextMenu);
      this.tray.popUpContextMenu();
    });
    this.tray.on('right-click', () => {
      window.openMainWindow();
    }) 
  
  }

  private buildTrayMenu = (): Array<Electron.MenuItemConstructorOptions> => {

    // load the config
    const configShortcuts = config.loadSettings(this.app).shortcuts;
  
    // visible does not seem to work for role 'about' and type 'separator' so we need to add them manually
    let menuItems: Array<Electron.MenuItemConstructorOptions> = []
  
    // start with update
    if (this.autoUpdater.updateAvailable) {
      menuItems = [
        ...menuItems,
        { label: 'Install update and restart...', click: this.autoUpdater.install },
        { type: 'separator' },
      ]
    } 
  
    // for other platform
    if (process.platform !== 'darwin') {
      menuItems = [
        ...menuItems,
        { role: 'about' },
        { type: 'separator' },
      ]
    }
  
    // add common stuff
    menuItems = menuItems.concat([
      { label: 'Quick Prompt', accelerator: shortcuts.shortcutAccelerator(configShortcuts?.prompt), click: PromptAnywhere.open },
      { label: 'New Chat', accelerator: shortcuts.shortcutAccelerator(configShortcuts?.chat), click: window.openMainWindow },
      { label: 'Scratchpad', accelerator: shortcuts.shortcutAccelerator(configShortcuts?.scratchpad), click: () => window.openScratchPad() },
      { label: 'Run AI Command', accelerator: shortcuts.shortcutAccelerator(configShortcuts?.command), click: Commander.initCommand },
      { label: 'Read Aloud', accelerator: shortcuts.shortcutAccelerator(configShortcuts?.readaloud), click: ReadAloud.read },
      { label: 'Start Dictation', accelerator: shortcuts.shortcutAccelerator(configShortcuts?.transcribe), click: Transcriber.initTranscription },
      { type: 'separator' },
      { label: 'Settings…', click: window.openSettingsWindow },
      { type: 'separator' },
      { label: 'Quit', /*accelerator: 'Command+Q', */click: () => this.quit() }
    ]);

    // return
    return menuItems;
  };

}