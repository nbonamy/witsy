import { app, BrowserWindow } from 'electron';
import { electronStore, createWindow, ensureOnCurrentScreen, titleBarOptions } from './index';
import { useI18n } from '../i18n';

const storeBoundsId = 'forge.bounds'

export let agentForgeWindow: BrowserWindow = null;

export const openAgentForgeWindow = (): void => {

  // if we don't have a window, create one
  if (!agentForgeWindow || agentForgeWindow.isDestroyed()) {

    // get bounds from here
    const bounds: Electron.Rectangle = electronStore?.get(storeBoundsId) as Electron.Rectangle;

    agentForgeWindow = createWindow({
      title: useI18n(app)('menu.file.agentForge'),
      hash: '/forge',
      x: bounds?.x,
      y: bounds?.y,
      width: bounds?.width || 1280,
      height: bounds?.height || 800,
      minWidth: 800,
      minHeight: 400,
      ...titleBarOptions({
        height: 48,
      }),
      showInDock: true,
    });

    agentForgeWindow.on('close', () => {
      electronStore.set(storeBoundsId, agentForgeWindow.getBounds());
    })

    // handle window close
    agentForgeWindow.on('closed', () => {
      agentForgeWindow = null;
    });

    // // open the DevTools
    // if (process.env.DEBUG) {
    //   agentForgeWindow.webContents.openDevTools({ mode: 'right' });
    // }

  }

  // check
  ensureOnCurrentScreen(agentForgeWindow);

  // focus
  app.focus({ steal: true });
  agentForgeWindow.focus();

};