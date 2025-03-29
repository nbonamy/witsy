
import { anyDict } from '../../types/index';
import { Application } from '../../types/automation';
import { app, BrowserWindow, screen } from 'electron';
import { createWindow, ensureOnCurrentScreen, releaseFocus } from './index';

export let commandPicker: BrowserWindow = null;

const width = 300;
const height = 320;

let commanderStartTime: number|undefined

export const prepareCommandPicker = (queryParams?: anyDict): void => {

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

  // try to focus
  commandPicker.on('show', () => {

    // focus
    app.focus({ steal: true });
    commandPicker.moveTop();
    commandPicker.focusOnWebView();

    // Log
    if (commanderStartTime) {
      console.log(`Command picker total time: ${Date.now() - commanderStartTime}ms`);
    }

  })

  // close on blue
  commandPicker.on('blur', () => {
    closeCommandPicker();
  });

  // prevent close with keyboard shortcut
  commandPicker.on('close', (event) => {
    closeCommandPicker();
    event.preventDefault();
  });

}

export const openCommandPicker = (params: anyDict): void => {

  // save
  commanderStartTime = params.startTime;

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
  
}

export const closeCommandPicker = async (sourceApp?: Application): Promise<void> => {

  // check
  if (commandPicker === null || commandPicker.isDestroyed()) {
    return;
  }

  try {

    // hide from user as early as possible
    commandPicker.setOpacity(0);

    // now release focus
    if (sourceApp) {
      await releaseFocus({ sourceApp });
    }

    // now hide (and restore opacity)
    commandPicker.hide();
    commandPicker.setOpacity(1);

  } catch (error) {
    console.error('Error while hiding command picker', error);
    commandPicker = null;
  }  

};
