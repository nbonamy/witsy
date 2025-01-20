
import { anyDict } from 'types/index';
import { app, BrowserWindow, Size } from 'electron';
import { createWindow, getCurrentScreen, getCenteredCoordinates, ensureOnCurrentScreen } from './index';

export let promptAnywhereWindow: BrowserWindow = null;

const kWidthMinimum = 800;
const kWidthMaximum = 1000;
const kWidthRatio = 2.25;

const desiredSize = (): Size => ({
  width: Math.min(kWidthMaximum, Math.max(kWidthMinimum, Math.floor(getCurrentScreen().workAreaSize.width / kWidthRatio))),
  height: Math.floor(getCurrentScreen().workAreaSize.height * 0.80)
});

export const preparePromptAnywhere = (queryParams?: anyDict): BrowserWindow => {

  // get bounds
  const size = desiredSize();
  const { x } = getCenteredCoordinates(size.width, size.height);
  const y = Math.floor(size.height * 0.18);

  // open a new one
  promptAnywhereWindow = createWindow({
    hash: '/prompt',
    queryParams: queryParams,
    x, y, width: size.width, height: size.height,
    frame: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    //opacity: 0.975,
    resizable: process.env.DEBUG ? true : false,
    //backgroundColor: 'rgba(255, 255, 255, 0)',
    transparent: true,
    hiddenInMissionControl: true,
    keepHidden: true,
    hasShadow: false,
    movable: true,
  });

  promptAnywhereWindow.on('show', () => {
    app.focus({ steal: true });
    promptAnywhereWindow.moveTop();
    promptAnywhereWindow.focusOnWebView();
  });

  // done
  return promptAnywhereWindow;
  
}

export const openPromptAnywhere = (params: anyDict): BrowserWindow => {

  // if we don't have a window, create one
  if (!promptAnywhereWindow || promptAnywhereWindow.isDestroyed()) {
    preparePromptAnywhere(params);
  } else {
    promptAnywhereWindow.webContents.send('show', params);
  }

  // adjust height to current screem
  const windowSize = promptAnywhereWindow.getSize();
  promptAnywhereWindow.setSize(windowSize[0], desiredSize().height);

  // check prompt is on the right screen
  ensureOnCurrentScreen(promptAnywhereWindow);

  // done
  promptAnywhereWindow.show();
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
