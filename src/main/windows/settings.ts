
import { anyDict } from '../../types/index';
import { app, BrowserWindow } from 'electron';
import { electronStore, createWindow, ensureOnCurrentScreen, enableClickThrough, undockWindow } from './index';

const storeBoundsId = 'settings.bounds'

export let settingsWindow: BrowserWindow = null;

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

  // save position on hide
  settingsWindow.on('hide', () => {
    electronStore.set(storeBoundsId, settingsWindow.getBounds());
  })

  // prevent close with keyboard shortcut
  settingsWindow.on('close', (event) => {
    closeSettingsWindow();
    event.preventDefault();
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
  app.focus({ steal: true });
  settingsWindow.focus();
  settingsWindow.show();
  
};

export const closeSettingsWindow = (): void => {

  // just hide so we reuse it
  try {
    if (settingsWindow && !settingsWindow.isDestroyed() && settingsWindow.isVisible()) {
      settingsWindow.hide();
    }
    undockWindow(settingsWindow);
  } catch (error) {
    console.error('Error while hiding settings window', error);
    settingsWindow = null;
  }

}
