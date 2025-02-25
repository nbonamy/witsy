
import { app, BrowserWindow } from 'electron';
import { createWindow, getCenteredCoordinates, titleBarOptions } from './index';
import { wait } from '../utils';

export let realtimeChatWindow: BrowserWindow = null;

export const closeRealtimeChatWindow = async () => {
  try {
    if (realtimeChatWindow && !realtimeChatWindow.isDestroyed()) {
      // console.log('Closing realtime chat window')
      realtimeChatWindow?.close()
      await wait();
    }
  } catch (error) {
    console.error('Error while closing realtime chat window', error);
  }
  realtimeChatWindow = null;
};

export const openRealtimeChatWindow = async () => {

  // try to show existig one
  closeRealtimeChatWindow();

  // get bounds
  const width = 600;
  const height = 600;
  const { x, y } = getCenteredCoordinates(width, height);

  // open a new one
  realtimeChatWindow = createWindow({
    hash: '/realtime',
    x, y, width, height,
    ...titleBarOptions(),
    title: 'Realtime Chat',
    resizable: process.env.DEBUG ? true : false,
    movable: true,
  });

  // show in dock
  if (process.platform === 'darwin') {
    app.dock.show();
  }

  // open the DevTools
  if (process.env.DEBUG) {
    realtimeChatWindow.webContents.openDevTools({ mode: 'right' });
  }
}