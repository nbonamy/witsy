
import { anyDict } from '../../types/index';
import { BrowserWindow } from 'electron';
import { createWindow, getCenteredCoordinates, getCurrentScreen, restoreWindows } from './index';
import { wait } from '../utils';

export let commandResult: BrowserWindow = null;

export const closeCommandResult = async () => {
  try {
    if (commandResult && !commandResult.isDestroyed()) {
      // console.log('Closing command picker')
      commandResult?.close()
      await wait();
    }
  } catch (error) {
    console.error('Error while closing command result', error);
  }
  commandResult = null;
};

export const openCommandResult = async (params: anyDict) => {

  // try to show existig one
  closeCommandResult();

  // get bounds
  const width = Math.floor(getCurrentScreen().workAreaSize.width / 2.25);
  const height = getCurrentScreen().workAreaSize.height;
  const { x } = getCenteredCoordinates(width, height);
  const y = Math.floor(height * 0.15);

  // open a new one
  commandResult = createWindow({
    hash: '/command',
    x, y, width, height: Math.floor(height * 0.75),
    frame: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    //opacity: 0.975,
    resizable: process.env.DEBUG ? true : false,
    backgroundColor: 'rgba(0, 0, 0, 0)',
    transparent: true,
    hiddenInMissionControl: true,
    queryParams: params,
    hasShadow: false,
    movable: true,
  });

  commandResult.on('blur', () => {
    closeCommandResult();
    restoreWindows();
  });

}

export const resizeCommandResult = async (deltaX: number, deltaY: number) => {
  const bounds = commandResult.getBounds();
  bounds.width += deltaX;
  bounds.height += deltaY;
  commandResult.setBounds(bounds);
}
