
import { anyDict } from '../../types/index';
import { app, BrowserWindow, screen } from 'electron';
import { createWindow, ensureOnCurrentScreen } from './index';

export let inplaceBubble: BrowserWindow = null;

const width = 300;
const height = 320;

let commanderStartTime: number|undefined

export const prepareBubble = (queryParams?: anyDict): BrowserWindow => {

  // open a new one
  inplaceBubble = createWindow({
    hash: '/bubble',
    x: 0, y: 0,
    width: width,
    height: height,
    frame: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    transparent: true,
    resizable: process.env.DEBUG ? true : false,
    hiddenInMissionControl: true,
    queryParams: queryParams,
    keepHidden: true,
    hasShadow: false,
  });

  inplaceBubble.on('show', () => {

    // focus
    app.focus({ steal: true });
    inplaceBubble.moveTop();
    inplaceBubble.focusOnWebView();

    // Log
    if (commanderStartTime) {
      console.log(`Command picker total time: ${Date.now() - commanderStartTime}ms`);
    }

  })

  inplaceBubble.on('blur', () => {
    closeBubble();
  });

  // done
  return inplaceBubble;
  
}

export const openBubble = (params: anyDict): BrowserWindow => {

  // save
  commanderStartTime = params.startTime;

  // if we don't have a window, create one
  if (!inplaceBubble || inplaceBubble.isDestroyed()) {
    prepareBubble(params);
  } else {
    inplaceBubble.webContents.send('show', params);
  }

  // check prompt is on the right screen
  ensureOnCurrentScreen(inplaceBubble);

  // and at right location
  const { x, y } = screen.getCursorScreenPoint();
  inplaceBubble.setBounds({
    x: x - width/2,
    y: y - (params.sourceApp ? 64 : 24),
    width: width,
    height: height,
  });

  // done
  inplaceBubble.show();
  return inplaceBubble;
  
}

export const closeBubble = async () => {

  // just hide so we reuse it
  try {
    if (inplaceBubble && !inplaceBubble.isDestroyed() && inplaceBubble.isVisible()) {
      inplaceBubble.hide();
    }
  } catch (error) {
    console.error('Error while hiding command picker', error);
    inplaceBubble = null;
  }

};
