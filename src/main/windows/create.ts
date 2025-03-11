import { app, BrowserWindow } from 'electron';
import { createWindow, ensureOnCurrentScreen, titleBarOptions } from './index';

export let createMediaWindow: BrowserWindow = null;

export const openCreateMediaWindow = () => {
  
  // if we don't have a window, create one
  if (!createMediaWindow || createMediaWindow.isDestroyed()) {
    
    createMediaWindow = createWindow({
      hash: '/create',
      width: 1280,
      height: 800,
      minWidth: 800,
      minHeight: 400,
    ...titleBarOptions(),
      title: 'Media Creation'
    });

    // handle window close
    createMediaWindow.on('closed', () => {
      createMediaWindow = null;
    });
  
  }

  // ensure it's on the right screen and show it
  ensureOnCurrentScreen(createMediaWindow);
  createMediaWindow.show();
  createMediaWindow.focus();
  
  // open the DevTools
  if (process.env.DEBUG) {
    createMediaWindow.webContents.openDevTools({ mode: 'right' });
  }

  // show in dock
  if (process.platform === 'darwin') {
    app.dock.show();
  }

  // done
  return createMediaWindow;

};