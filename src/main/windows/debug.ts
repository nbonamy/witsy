import { app, BrowserWindow } from 'electron';
import { electronStore, createWindow, ensureOnCurrentScreen, titleBarOptions } from './index';

const storeBoundsId = 'debug.bounds'

export let debugWindow: BrowserWindow = null;

export const openDebugWindow = (): void => {
  
  // if we don't have a window, create one
  if (!debugWindow || debugWindow.isDestroyed()) {
    
    // get bounds from here
    const bounds: Electron.Rectangle = electronStore?.get(storeBoundsId) as Electron.Rectangle;

    debugWindow = createWindow({
      title: 'Debug Console',
      hash: '/debug',
      x: bounds?.x,
      y: bounds?.y,
      width: bounds?.width || 800,
      height: bounds?.height || 600,
      minWidth: 600,
      minHeight: 400,
      ...titleBarOptions(),
      showInDock: true,
    });

    debugWindow.on('close', () => {
      electronStore.set(storeBoundsId, debugWindow.getBounds());
    })

    // handle window close
    debugWindow.on('closed', () => {
      debugWindow = null;
    });
  
  }

  // check
  ensureOnCurrentScreen(debugWindow);

  // and focus
  app.focus({ steal: true });
  debugWindow.focus();
  
  // open the DevTools
  if (process.env.DEBUG) {
    debugWindow.webContents.openDevTools({ mode: 'right' });
  }

};
