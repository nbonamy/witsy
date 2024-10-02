
import { BrowserWindow, screen } from 'electron';
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
  const { x, y } = screen.getCursorScreenPoint();

  // open a new one
  transcribePalette = createWindow({
    hash: '/transcribe',
    x: x - width/2,
    y: y - height/2,
    width: width,
    height: height,
    frame: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    resizable: true,
    hiddenInMissionControl: true,
  });

  transcribePalette.on('closed', () => {
    restoreWindows();
  });

}