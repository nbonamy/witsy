
import { strDict } from 'types/index.d';
import { BrowserWindow } from 'electron';
import { createWindow, getCurrentScreen, getCenteredCoordinates } from './index';

export let promptAnywhereWindow: BrowserWindow = null;

export const preparePromptAnywhere = (params: strDict, keepHidden: boolean = true) => {

  // get bounds
  const width = Math.floor(getCurrentScreen().workAreaSize.width / 2.25);
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
    opacity: 0.975,
    resizable: process.env.DEBUG ? true : false,
    backgroundColor: 'rgba(0, 0, 0, 0)',
    transparent: true,
    hiddenInMissionControl: true,
    queryParams: params,
    keepHidden: keepHidden,
    hasShadow: false,
    movable: true,
  });

  // notify show
  if (!keepHidden) {
    promptAnywhereWindow.webContents.send('show', params);
  }

}


export const openPromptAnywhere = (params: strDict) => {

  // do we have one
  if (promptAnywhereWindow && !promptAnywhereWindow.isDestroyed()) {
    promptAnywhereWindow.webContents.send('query-params', params);
    promptAnywhereWindow.webContents.send('show', params);
    promptAnywhereWindow.show();
    return;
  }

  // create a new one
  preparePromptAnywhere(params, false);

};

export const closePromptAnywhere = async () => {

  // just hide so we reuse it
  promptAnywhereWindow.hide();

}

export const resizePromptAnywhere = async (deltaX: number, deltaY: number) => {
  const bounds = promptAnywhereWindow.getBounds();
  bounds.width += deltaX;
  bounds.height += deltaY;
  promptAnywhereWindow.setBounds(bounds);
}
