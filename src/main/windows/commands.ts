
import { BrowserWindow, screen } from 'electron';
import { createWindow, restoreWindows } from './index';
import { wait } from '../utils';

export let commandPicker: BrowserWindow = null;

export const closeCommandPicker = async () => {
  try {
    if (commandPicker && !commandPicker.isDestroyed()) {
      // console.log('Closing command picker')
      commandPicker?.close()
      await wait();
    }
  } catch (error) {
    console.error('Error while closing command picker', error);
  }
  commandPicker = null;
};

export const openCommandPicker = async (textId: string) => {

  // try to show existig one
  closeCommandPicker();

  // get bounds
  const width = 300;
  const height = 320;
  const { x, y } = screen.getCursorScreenPoint();

  // open a new one
  commandPicker = createWindow({
    hash: '/commands',
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

  commandPicker.on('blur', () => {
    closeCommandPicker();
    restoreWindows();
  });

}
