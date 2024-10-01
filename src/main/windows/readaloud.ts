
import { BrowserWindow, screen } from 'electron';
import { createWindow, restoreWindows } from './index';
import { wait } from '../utils';

export let readAloudPalette: BrowserWindow = null;

export const closeReadAloudPalette = async () => {
  try {
    if (readAloudPalette && !readAloudPalette.isDestroyed()) {
      // console.log('Closing read aloud palette')
      readAloudPalette?.close()
      await wait();
    }
  } catch (error) {
    console.error('Error while closing read aloud palette', error);
  }
  readAloudPalette = null;
};

export const openReadAloudPalette = async (textId: string) => {

  // try to show existig one
  closeReadAloudPalette();

  // get bounds
  const width = 84;
  const height = 48;
  const { x, y } = screen.getCursorScreenPoint();

  // open a new one
  readAloudPalette = createWindow({
    hash: '/readaloud',
    x: x - width/2,
    y: y - height/2,
    width: width,
    height: height,
    frame: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    resizable: false,
    hiddenInMissionControl: true,
    queryParams: {
      textId: textId,
    }
  });

  readAloudPalette.on('closed', () => {
    restoreWindows();
  });

}