import { app, BrowserWindow } from 'electron';
import { electronStore, createWindow, ensureOnCurrentScreen, titleBarOptions } from './index';
import { useI18n } from '../i18n';

const storeBoundsId = 'create.bounds'

export let createMediaWindow: BrowserWindow = null;

export const openCreateMediaWindow = () => {

  // if we don't have a window, create one
  if (!createMediaWindow || createMediaWindow.isDestroyed()) {

    // get bounds from here
    const bounds: Electron.Rectangle = electronStore?.get(storeBoundsId) as Electron.Rectangle;

    createMediaWindow = createWindow({
      title: useI18n(app)('menu.file.createMedia'),
      hash: '/create',
      x: bounds?.x,
      y: bounds?.y,
      width: bounds?.width || 1280,
      height: bounds?.height || 800,
      minWidth: 800,
      minHeight: 400,
      ...titleBarOptions(),
    });

    createMediaWindow.on('close', () => {
      electronStore.set(storeBoundsId, createMediaWindow.getBounds());
    })

    // handle window close
    createMediaWindow.on('closed', () => {
      createMediaWindow = null;
    });

  }

  // check
  ensureOnCurrentScreen(createMediaWindow);

  // and focus
  app.focus({ steal: true });
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