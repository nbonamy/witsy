
import { anyDict } from '../../types/index';
import { BrowserWindow } from 'electron';
import { electronStore, createWindow, ensureOnCurrentScreen, enableClickThrough, undockWindow } from './index';

const storeBoundsId = 'settings.bounds'

export let settingsWindow: BrowserWindow = null;

export const isSettingsWindowPersistent = () => {
  // there used to be problems with keeping this window
  // persistent on Windows, but they seems to be fixed now
  // this can be removed in the future
  return true//process.platform === 'darwin'
}

export const prepareSettingsWindow = (queryParams?: anyDict): void => {

  // get bounds from here
  const bounds: Electron.Rectangle = electronStore?.get(storeBoundsId) as Electron.Rectangle;

  settingsWindow = createWindow({
    title: 'Settings',
    hash: '/settings',
    queryParams: queryParams,
    x: bounds?.x,
    y: bounds?.y,
    width: /*bounds?.width || */660,
    height: /*bounds?.height || */560,
    maximizable: false,
    frame: false,
    transparent: true,
    keepHidden: true,
    hasShadow: false,
    resizable: process.env.DEBUG ? true : false,
    movable: true,
    showInDock: true,
  });

  // // open the DevTools
  // if (process.env.DEBUG) {
  //   settingsWindow.webContents.openDevTools({ mode: 'right' });
  // }

  // opacity trick is to avoid flickering on Windows
  settingsWindow.on('show', () => {
    if (process.platform === 'win32') {
      setTimeout(() => {
        settingsWindow.setOpacity(1);
      }, 100);
    }
  });

  // save position on hide
  settingsWindow.on('hide', () => {
    electronStore.set(storeBoundsId, settingsWindow.getBounds());
    if (process.platform === 'win32') {
      settingsWindow.setOpacity(0);
    }
  })

  // prevent close with keyboard shortcut
  settingsWindow.on('close', (event) => {
    if (isSettingsWindowPersistent()) {
      closeSettingsWindow();
      event.preventDefault();
    }
  });

  // handle window close
  settingsWindow.on('closed', () => {
    settingsWindow = null;
  });

  // enable click through
  enableClickThrough(settingsWindow);

}

export const openSettingsWindow = (params?: anyDict): void => {

  // if we don't have a window, create one
  if (!settingsWindow || settingsWindow.isDestroyed()) {
    prepareSettingsWindow(params);
  } else {
    settingsWindow.webContents.send('show', params);
  }

  // check
  ensureOnCurrentScreen(settingsWindow);

  // and focus
  //app.focus({ steal: true });
  settingsWindow.focus();
  settingsWindow.show();

};

export const closeSettingsWindow = (): void => {

  // just hide so we reuse it
  try {
    if (settingsWindow && !settingsWindow.isDestroyed() && settingsWindow.isVisible()) {
      if (isSettingsWindowPersistent()) {
        settingsWindow.hide();
      } else {
        settingsWindow.close();
      }
    }
    undockWindow(settingsWindow, true);
  } catch (error) {
    console.error('Error while hiding settings window', error);
    settingsWindow = null;
  }

}
