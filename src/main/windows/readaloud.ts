
import { strDict } from '../../types/index';
import { app, BrowserWindow } from 'electron';
import { createWindow, getCenteredCoordinates } from './index';
import { wait } from '../utils';
import { useI18n } from 'main/i18n';

export let readAloudPalette: BrowserWindow = null;

export const closeReadAloudPalette = async () => {
  try {
    if (readAloudPalette && !readAloudPalette.isDestroyed()) {
      // console.log('Closing read aloud picker')
      readAloudPalette?.close()
      await wait();
    }
  } catch (error) {
    console.error('Error while closing read aloud picker', error);
  }
  readAloudPalette = null;
};

export const openReadAloudPalette = async (params: strDict) => {

  // try to show existig one
  closeReadAloudPalette();

  // get bounds
  const width = 84;
  const height = 48;
  const { x, y } = getCenteredCoordinates(width, height);

  // open a new one
  readAloudPalette = createWindow({
    title: useI18n(app)('tray.menu.readAloud'),
    hash: '/readaloud',
    x, y, width, height,
    frame: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    resizable: false,
    hiddenInMissionControl: true,
    queryParams: params
  });

}