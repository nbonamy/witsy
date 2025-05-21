
import { anyDict } from 'types/index';
import { Application } from '../../types/automation';
import { app, BrowserWindow } from 'electron';
import { createWindow, getCurrentScreen, ensureOnCurrentScreen, releaseFocus, getWindowScreen, getFullscreenBounds } from './index';
import { useI18n } from '../i18n';

export let promptAnywhereWindow: BrowserWindow = null;

export const preparePromptAnywhere = (queryParams?: anyDict): void => {

  // get bounds
  const windowScreen = getCurrentScreen();

  // open a new one
  promptAnywhereWindow = createWindow({
    hash: '/prompt',
    queryParams: queryParams,
    title: useI18n(app)('tray.menu.quickPrompt'),
    ...getFullscreenBounds(windowScreen),
    frame: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    //opacity: 0.975,
    resizable: process.env.DEBUG ? true : false,
    // backgroundColor: 'rgba(255, 0, 0, 0)',
    // vibrancy: 'hud',
    transparent: true,
    hiddenInMissionControl: true,
    enableLargerThanScreen: true,
    keepHidden: true,
    hasShadow: false,
    //movable: true,
  });

  // // open the DevTools
  // if (process.env.DEBUG) {
  //   promptAnywhereWindow.webContents.openDevTools({ mode: 'right' });
  // }

  // get focus
  // opacity trick is to avoid flickering on Windows
  promptAnywhereWindow.on('show', () => {

    // macos can use app.focus
    if (process.platform === 'darwin') {
      app.focus({ steal: true });
    }

    // focus
    promptAnywhereWindow.moveTop();
    promptAnywhereWindow.focusOnWebView();

    // restore opacity (for windows)
    if (promptAnywhereWindow.getOpacity() !== 1) {
      setTimeout(() => {
        promptAnywhereWindow.setOpacity(1);
      }, 100);
    }
  });

  // opacity trick is to avoid flickering on Windows
  promptAnywhereWindow.on('hide', () => {
    if (process.platform === 'win32') {
      promptAnywhereWindow.setOpacity(0);
    } else {
      promptAnywhereWindow.setOpacity(1);
    }
  });

  // prevent close with keyboard shortcut
  promptAnywhereWindow.on('close', (event) => {
    closePromptAnywhere();
    event.preventDefault();
  });

}

export const openPromptAnywhere = (params: anyDict): void => {

  // if we don't have a window, create one
  if (!promptAnywhereWindow || promptAnywhereWindow.isDestroyed()) {
    preparePromptAnywhere(params);
  } else {
    promptAnywhereWindow.webContents.send('show', params);
  }

  // check prompt is on the right screen
  ensureOnCurrentScreen(promptAnywhereWindow);

  // adjust height to current screen
  const windowScreen = getWindowScreen(promptAnywhereWindow);
  promptAnywhereWindow.setBounds(getFullscreenBounds(windowScreen));

  // done
  promptAnywhereWindow.show();

};

export const closePromptAnywhere = async (sourceApp?: Application): Promise<void> => {

  // check
  if (promptAnywhereWindow === null || promptAnywhereWindow.isDestroyed() || promptAnywhereWindow.isVisible() === false) {
    return;
  }

  try {

    // hide from user as early as possible
    promptAnywhereWindow.setOpacity(0);

    // now release focus
    await releaseFocus({ sourceApp });

    // now hide (opacity will be restored on 'hide')
    promptAnywhereWindow.hide();

  } catch (error) {
    console.error('Error while hiding prompt anywhere', error);
    promptAnywhereWindow = null;
  }

}

export const resizePromptAnywhere = (deltaX: number, deltaY: number): void => {
  const bounds = promptAnywhereWindow.getBounds();
  bounds.width += deltaX;
  bounds.height += deltaY;
  promptAnywhereWindow.setBounds(bounds);
}
