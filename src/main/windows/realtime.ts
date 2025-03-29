
import { app, BrowserWindow } from 'electron';
import { createWindow, ensureOnCurrentScreen, getCenteredCoordinates, titleBarOptions } from './index';
import { useI18n } from '../i18n';

export let realtimeChatWindow: BrowserWindow = null;

export const openRealtimeChatWindow = (): void => {

  // if we don't have a window, create one
  if (!realtimeChatWindow || realtimeChatWindow.isDestroyed()) {
    
    // get bounds
    const width = 600;
    const height = 600;
    const { x, y } = getCenteredCoordinates(width, height);

    // open a new one
    realtimeChatWindow = createWindow({
      title: useI18n(app)('realtimeChat.title'),
      hash: '/realtime',
      x, y, width, height,
      ...titleBarOptions({
        height: 48,
      }),
      resizable: process.env.DEBUG ? true : false,
      movable: true,
      showInDock: true,
    });

    // handle window close
    realtimeChatWindow.on('closed', () => {
      realtimeChatWindow = null;
    })

    // open the DevTools
    if (process.env.DEBUG) {
      realtimeChatWindow.webContents.openDevTools({ mode: 'right' });
    }

  }

  // check
  ensureOnCurrentScreen(realtimeChatWindow);

  // and focus
  app.focus({ steal: true });
  realtimeChatWindow.focus();
  
}