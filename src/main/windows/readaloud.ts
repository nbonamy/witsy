
import { anyDict } from 'types/index';
import { app, BrowserWindow } from 'electron';
import { createWindow, getCenteredCoordinates } from './index';
import { useI18n } from '../i18n';

export let readAloudPalette: BrowserWindow = null;

export const closeReadAloudPalette = (): void => {
  try {
    if (readAloudPalette && !readAloudPalette.isDestroyed()) {
      // console.log('Closing read aloud picker')
      readAloudPalette?.close()
    }
  } catch (error) {
    console.error('Error while closing read aloud picker', error);
  }
  readAloudPalette = null;
};

export const openReadAloudPalette = (params: anyDict): void => {

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

  // focus
  readAloudPalette.focus();

}
