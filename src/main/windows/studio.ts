import { app, BrowserWindow } from 'electron';
import { electronStore, createWindow, ensureOnCurrentScreen, titleBarOptions } from './index';
import { useI18n } from '../i18n';

const storeBoundsId = 'create.bounds'

export let designStudioWindow: BrowserWindow = null;

export const openDesignStudioWindow = () => {

  // if we don't have a window, create one
  if (!designStudioWindow || designStudioWindow.isDestroyed()) {

    // get bounds from here
    const bounds: Electron.Rectangle = electronStore?.get(storeBoundsId) as Electron.Rectangle;

    designStudioWindow = createWindow({
      title: useI18n(app)('menu.file.designStudio'),
      hash: '/studio',
      x: bounds?.x,
      y: bounds?.y,
      width: bounds?.width || 1280,
      height: bounds?.height || 800,
      minWidth: 800,
      minHeight: 400,
      ...titleBarOptions(),
      showInDock: true,
    });

    designStudioWindow.on('close', () => {
      electronStore.set(storeBoundsId, designStudioWindow.getBounds());
    })

    // handle window close
    designStudioWindow.on('closed', () => {
      designStudioWindow = null;
    });

  }

  // check
  ensureOnCurrentScreen(designStudioWindow);

  // and focus
  app.focus({ steal: true });
  designStudioWindow.focus();

  // // open the DevTools
  // if (process.env.DEBUG) {
  //   designStudioWindow.webContents.openDevTools({ mode: 'right' });
  // }

  // done
  return designStudioWindow;

};