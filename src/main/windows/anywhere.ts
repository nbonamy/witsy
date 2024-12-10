
import { strDict } from 'types/index.d';
import { BrowserWindow } from 'electron';
import { createWindow, getCurrentScreen, getCenteredCoordinates } from './index';

export let promptAnywhereWindow: BrowserWindow = null;

export const preparePromptAnywhere = (): BrowserWindow => {

  // get bounds
  const width = 700;//Math.floor(getCurrentScreen().workAreaSize.width / 2.25);
  const height = getCurrentScreen().workAreaSize.height;
  const { x } = getCenteredCoordinates(width, height);
  const y = Math.floor(height * 0.15);

  // open a new one
  promptAnywhereWindow = createWindow({
    hash: '/prompt',
    x, y, width, height: Math.floor(height * 0.75),
    frame: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    //opacity: 0.975,
    resizable: process.env.DEBUG ? true : false,
    backgroundColor: 'rgba(0, 0, 0, 0)',
    transparent: true,
    hiddenInMissionControl: true,
    keepHidden: true,
    hasShadow: false,
    movable: true,
  });

  // done
  return promptAnywhereWindow;
  
}


export const openPromptAnywhere = (params: strDict): BrowserWindow => {

  // if we don't have a window, create one
  if (!promptAnywhereWindow || promptAnywhereWindow.isDestroyed()) {
    preparePromptAnywhere();
  }

  // now send our signals
  promptAnywhereWindow.webContents.send('show', params);
  promptAnywhereWindow.show();

  // done
  return promptAnywhereWindow;

};

export const closePromptAnywhere = async () => {

  // just hide so we reuse it
  try {
    if (promptAnywhereWindow && !promptAnywhereWindow.isDestroyed() && promptAnywhereWindow.isVisible()) {
      promptAnywhereWindow.hide();
    }
  } catch (error) {
    console.error('Error while hiding prompt anywhere', error);
    promptAnywhereWindow = null;
  }

}

export const resizePromptAnywhere = async (deltaX: number, deltaY: number) => {
  const bounds = promptAnywhereWindow.getBounds();
  bounds.width += deltaX;
  bounds.height += deltaY;
  promptAnywhereWindow.setBounds(bounds);
}
