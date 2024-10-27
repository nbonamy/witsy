
import { strDict } from 'types/index.d';
import { BrowserWindow } from 'electron';
import { createWindow, getCurrentScreen, getCenteredCoordinates } from './index';
import { wait } from '../utils';

export let promptAnywhereWindow: BrowserWindow = null;

export const openPromptAnywhere = (params: strDict) => {

  // try to close existig one
  closePromptAnywhere();

  // get bounds
  const width = Math.floor(getCurrentScreen().workAreaSize.width / 2.5);
  const height = getCurrentScreen().workAreaSize.height;
  const { x } = getCenteredCoordinates(width, height);

  // open a new one
  promptAnywhereWindow = createWindow({
    hash: '/prompt',
    x, y: 0, width, height,
    frame: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    opacity: 0.975,
    resizable: process.env.DEBUG ? true : false,
    transparent: true,
    hiddenInMissionControl: true,
    queryParams: params,
  });

};

export const closePromptAnywhere = async () => {

  // now close window itself
  try {
    if (promptAnywhereWindow && !promptAnywhereWindow.isDestroyed()) {
      // console.log('Closing prompt anywhere window')
      promptAnywhereWindow?.close()
      await wait();
    }
  } catch (error) {
    console.error('Error while closing prompt anywhere window', error);
  }
  promptAnywhereWindow = null;
}
