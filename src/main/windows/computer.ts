import { app, BrowserWindow } from 'electron';
import { createWindow, getCurrentScreen } from './index';
import { useI18n } from '../i18n';

export let computerStatusWindow: BrowserWindow = null;

export const closeComputerStatusWindow = (): void => {
  try {
    if (computerStatusWindow && !computerStatusWindow.isDestroyed()) {
      computerStatusWindow?.close()
    }
  } catch (error) {
    console.error('Error while closing computer status window', error);
  }
  computerStatusWindow = null;
};

export const openComputerStatusWindow = (): void => {

  // try to close existing one
  closeComputerStatusWindow();

  // set dimensions
  const width = 360;
  const height = 48;
  
  // get current screen
  const currentScreen = getCurrentScreen();
  const { workAreaSize } = currentScreen;
  
  // position in corner based on platform
  const x = currentScreen.bounds.x + workAreaSize.width - width - 16;
  const y = currentScreen.bounds.y + 40;

  // open a new one
  computerStatusWindow = createWindow({
    title: useI18n(app)('computer.title'),
    hash: '/computer',
    x, y, width, height,
    frame: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    hiddenInMissionControl: true,
    resizable: process.env.DEBUG ? true : false,
  });

}
