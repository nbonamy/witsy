
import { app, BrowserWindow } from 'electron';
import { createWindow, getCenteredCoordinates } from './index';
import { wait } from '../utils';
import { useI18n } from '../i18n';

export let transcribePalette: BrowserWindow = null;

export const closeTranscribePalette = async () => {
  try {
    if (transcribePalette && !transcribePalette.isDestroyed()) {
      // console.log('Closing read aloud picker')
      transcribePalette?.close()
      await wait();
    }
  } catch (error) {
    console.error('Error while closing read aloud picker', error);
  }
  transcribePalette = null;
};

export const openTranscribePalette = async () => {

  // try to show existig one
  closeTranscribePalette();

  // get bounds
  const width = 400;
  const height = 300;
  const { x, y } = getCenteredCoordinates(width, height);

  // open a new one
  transcribePalette = createWindow({
    title: useI18n(app)('settings.shortcuts.dictation'),
    hash: '/transcribe',
    x, y, width, height,
    center: true,
    frame: false,
    skipTaskbar: true,
    resizable: false,
    hiddenInMissionControl: true,
  });

}