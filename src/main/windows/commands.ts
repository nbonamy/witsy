
import { anyDict } from '../../types/index';
import { BrowserWindow, screen } from 'electron';
import { createWindow, ensureOnCurrentScreen } from './index';

export let commandPicker: BrowserWindow = null;

const width = 300;
const height = 320;

export const prepareCommandPicker = (queryParams?: anyDict): BrowserWindow => {

  // open a new one
  commandPicker = createWindow({
    hash: '/commands',
    x: 0, y: 0,
    width: width,
    height: height,
    frame: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    resizable: process.env.DEBUG ? true : false,
    hiddenInMissionControl: true,
    queryParams: queryParams,
    keepHidden: true,
    hasShadow: false,
  });

  commandPicker.setOpacity(0);

  // open the DevTools
  // if (process.env.DEBUG) {
  //   commandPicker.webContents.openDevTools({ mode: 'right' });
  // }

  commandPicker.on('show', () => {

    // ugly trick to get focus in window
    // we added the opacity trick to hide the animation
    // https://github.com/electron/electron/issues/2867
    commandPicker.minimize();
    commandPicker.restore();
    commandPicker.focus();

    setTimeout(() => {
      commandPicker.setOpacity(1);
      commandPicker.on('blur', closeCommandPicker);
    }, process.platform === 'win32' ? 250 : 0);

  });

  // done
  return commandPicker;
  
}

export const openCommandPicker = (params: anyDict): BrowserWindow => {

  // if we don't have a window, create one
  if (!commandPicker || commandPicker.isDestroyed()) {
    prepareCommandPicker(params);
  } else {
    commandPicker.webContents.send('show', params);
  }

  // check prompt is on the right screen
  ensureOnCurrentScreen(commandPicker);

  // and at right location
  const { x, y } = screen.getCursorScreenPoint();
  commandPicker.setBounds({
    x: x - width/2,
    y: y - (params.sourceApp ? 64 : 24),
    width: width,
    height: height,
  });

  // done
  commandPicker.show();
  return commandPicker;
  
}

export const closeCommandPicker = async () => {

  // just hide so we reuse it
  try {
    if (commandPicker && !commandPicker.isDestroyed() && commandPicker.isVisible()) {
      commandPicker.off('blur', closeCommandPicker);
      commandPicker.setOpacity(0);
      commandPicker.hide();
    }
  } catch (error) {
    console.error('Error while hiding command picker', error);
    commandPicker = null;
  }

};

