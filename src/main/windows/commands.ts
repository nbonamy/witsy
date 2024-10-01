
import { BrowserWindow, screen } from 'electron';
import { createWindow, restoreWindows } from './index';
import { wait } from '../utils';

export let commandPalette: BrowserWindow = null;

export const closeCommandPalette = async () => {
  try {
    if (commandPalette && !commandPalette.isDestroyed()) {
      // console.log('Closing command palette')
      commandPalette?.close()
      await wait();
    }
  } catch (error) {
    console.error('Error while closing command palette', error);
  }
  commandPalette = null;
};

export const openCommandPalette = async (textId: string) => {

  // try to show existig one
  closeCommandPalette();

  // get bounds
  const width = 300;
  const height = 320;
  const { x, y } = screen.getCursorScreenPoint();

  // open a new one
  commandPalette = createWindow({
    hash: '/command',
    x: x - width/2,
    y: y - 24,
    width: width,
    height: height,
    frame: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    hiddenInMissionControl: true,
    queryParams: {
      textId: textId,
    }
  });

  commandPalette.on('blur', () => {
    closeCommandPalette();
    restoreWindows();
  });

}
