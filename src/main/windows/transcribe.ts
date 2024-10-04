
import { BrowserWindow } from 'electron';
import { createWindow, restoreWindows } from './index';
import { wait } from '../utils';

export let transcribePalette: BrowserWindow = null;

export const closeTranscribePalette = async () => {
  try {
    if (transcribePalette && !transcribePalette.isDestroyed()) {
      // console.log('Closing read aloud palette')
      transcribePalette?.close()
      await wait();
    }
  } catch (error) {
    console.error('Error while closing read aloud palette', error);
  }
  transcribePalette = null;
};

export const openTranscribePalette = async () => {

  // try to show existig one
  closeTranscribePalette();

  // get bounds
  const width = 400;
  const height = 300;

  // open a new one
  transcribePalette = createWindow({
    hash: '/transcribe',
    width: width,
    height: height,
    center: true,
    frame: false,
    skipTaskbar: true,
    resizable: false,
    hiddenInMissionControl: true,
  });

  transcribePalette.on('closed', () => {
    restoreWindows();
  });

}