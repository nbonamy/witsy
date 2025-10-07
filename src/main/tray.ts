import { App, Menu, nativeImage, Tray } from 'electron';
import path from 'path';
import PromptAnywhere from '../automations/anywhere';
import Commander from '../automations/commander';
import ReadAloud from '../automations/readaloud';
import Transcriber from '../automations/transcriber';
import AutoUpdater from './autoupdate';
import { loadSettings } from './config';
import { useI18n } from './i18n';
import * as shortcuts from './shortcuts';
import * as window from './window';

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

  destroy = () => {
    if (this.tray) {
      this.tray.destroy();
      this.tray = null;
    }
  }

  install = () => {

    // create if needed
    if (!this.tray) {
      this.tray = new Tray(this.getIcon());
      this.tray.on('right-click', () => {
        window.openMainWindow();
      });
    }

    // update icon
    this.tray.setImage(this.getIcon());
    
    // and now set/update the context menu
    this.tray.setContextMenu(Menu.buildFromTemplate(this.buildTrayMenu()));
    this.tray.on('click', () => {
      const contextMenu = Menu.buildFromTemplate(this.buildTrayMenu());
      this.tray.setContextMenu(contextMenu);
      this.tray.popUpContextMenu();
    });
  
  }

  private getIcon = () => {

    // need to know if an update is available
    const updateAvailable = this.autoUpdater.updateAvailable;
  
    // tray icon
    const assetsFolder = process.env.DEBUG ? path.resolve('./assets') : process.resourcesPath;
    if (process.platform === 'win32') {
      const trayIconPath = path.join(assetsFolder, 'icon.ico');
      return nativeImage.createFromPath(trayIconPath);
    } else {
      const iconColor = process.platform === 'linux' ? 'White' : 'Template';
      const trayIconPath = path.join(assetsFolder, updateAvailable ? `trayUpdate${iconColor}@2x.png` : `tray${iconColor}@2x.png`);
      //console.log('trayIconPath', trayIconPath);
      const trayIcon = nativeImage.createFromPath(trayIconPath);
      trayIcon.setTemplateImage(true);
      return trayIcon;
    }

  }

  private buildTrayMenu = (): Array<Electron.MenuItemConstructorOptions> => {

    // get i18n
    const t = useI18n(this.app);

    // load the config
    const config = loadSettings(this.app);
    const configShortcuts = config.shortcuts;

    // visible does not seem to work for role 'about' and type 'separator' so we need to add them manually
    let menuItems: Array<Electron.MenuItemConstructorOptions> = []
  
    // start with update
    if (this.autoUpdater.updateAvailable) {
      menuItems = [
        ...menuItems,
        { label: t('tray.menu.installUpdate'), click: this.autoUpdater.install },
        { type: 'separator' },
      ]
    } 
  
    // // for other platform
    // if (process.platform !== 'darwin') {
    //   menuItems = [
    //     ...menuItems,
    //     { role: 'about' },
    //     { 
    //       label: t('menu.app.checkForUpdates'),
    //       click: () => this.autoUpdater.check()
    //     },
    //     { type: 'separator' },
    //   ]
    // }
  
    // add common stuff
    menuItems = menuItems.concat([
      {
        label: t('tray.menu.mainWindow'),
        accelerator: shortcuts.shortcutAccelerator(configShortcuts?.main),
        click: () => window.openMainWindow({ queryParams: { view: 'chat'} }),
      },
      {
        label: t('tray.menu.quickPrompt'),
        accelerator: shortcuts.shortcutAccelerator(configShortcuts?.prompt),
        click: () => PromptAnywhere.open(),
      },
      {
        label: t('tray.menu.runAiCommand'),
        accelerator: shortcuts.shortcutAccelerator(configShortcuts?.command),
        click: () => Commander.initCommand(this.app),
      },
      {
        type: 'separator'
      },
      {
        label: t('tray.menu.scratchpad'),
        accelerator: shortcuts.shortcutAccelerator(configShortcuts?.scratchpad),
        click: () => window.openMainWindow({ queryParams: { view: 'scratchpad' } })
      },
      {
        label: t('tray.menu.designStudio'),
        accelerator: shortcuts.shortcutAccelerator(configShortcuts?.studio),
        click: () => window.openDesignStudioWindow(),
      },
      {
        type: 'separator'
      },
      {
        label: t('tray.menu.readAloud'),
        accelerator: shortcuts.shortcutAccelerator(configShortcuts?.readaloud),
        click: () => ReadAloud.read(this.app),
      },
      {
        label: t('tray.menu.startDictation'),
        accelerator: shortcuts.shortcutAccelerator(configShortcuts?.transcribe),
        click: () => Transcriber.initTranscription(),
      },
      {
        label: t('tray.menu.voiceMode'),
        accelerator: shortcuts.shortcutAccelerator(configShortcuts?.realtime),
        click: () => window.openRealtimeChatWindow(),
      },
      {
        type: 'separator'
      },
      {
        label: t('tray.menu.settings'),
        click: () => window.openSettingsWindow()
      },
    ])

    // if (config.general?.enableHttpEndpoints) {
    //   menuItems = menuItems.concat([
    //     {
    //       type: 'separator'
    //     },
    //     {
    //       label: t('tray.menu.httpServer', { port: HttpServer.getInstance().getPort() }),
    //       enabled: false
    //     },
    //   ])
    // }

    // finally quit
    menuItems = menuItems.concat([
      {
        type: 'separator'
      },
      {
        label: t('tray.menu.quit'),
        /*accelerator: 'Command+Q', */
        click: () => this.quit()
      }
    ]);

    // return
    return menuItems;
  };

}