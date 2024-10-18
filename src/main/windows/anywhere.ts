
import { strDict } from 'types';
import { BrowserWindow } from 'electron';
import { createWindow, getCenteredCoordinates, restoreWindows } from './index';
import { expertsPalette, closeExpertsPalette } from './experts';
import { wait } from '../utils';

export let promptAnywhereWindow: BrowserWindow = null;

export const openPromptAnywhere = (params: strDict) => {

  // try to close existig one
  closePromptAnywhere();

  // get bounds
  const width = 500;
  const height = 52;
  const { x, y } = getCenteredCoordinates(width, height);

  // open a new one
  promptAnywhereWindow = createWindow({
    hash: '/prompt',
    x, y, width, height,
    frame: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    opacity: 0.975,
    hiddenInMissionControl: true,
    queryParams: params,
  });

  promptAnywhereWindow.on('focus', () => {
    closeExpertsPalette();
  })

  promptAnywhereWindow.on('blur', () => {
    const paletteNotHere = expertsPalette == null || expertsPalette.isDestroyed()
    const paletteNotFocused = expertsPalette != null && !expertsPalette.isFocused()
    if (paletteNotHere || paletteNotFocused) {
      closeExpertsPalette();
      closePromptAnywhere();
      restoreWindows();
    }
  });

};

export const closePromptAnywhere = async () => {

  // close palette too
  closeExpertsPalette();

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

export const resizePromptAnywhere = (height: number) => {
  try {
    const size = promptAnywhereWindow.getSize()
    promptAnywhereWindow?.setSize(size[0], height);
  } catch (error) {
    console.error('Error while resizing prompt anywhere window', error);
  }
}

export const setPromptAnywhereExpertPrompt = (expertId: string) =>  {
  try {
    if (promptAnywhereWindow && !promptAnywhereWindow.isDestroyed()) {
      promptAnywhereWindow.webContents.send('set-expert-prompt', expertId);
    }
  } catch (error) {
    console.error('Error while settings prompt anywhere prompt]', error);
  }
}
