
import { anyDict } from 'types/index';
import { Application } from 'types/automation';
import { app, BrowserWindow, screen } from 'electron';
import { createWindow, ensureOnCurrentScreen, releaseFocus } from './index';
//import MacosAutomator from '@main/automations/macos';
//import WindowsAutomator from '@main/automations/windows';
//import Computer from '@main/automations/computer_nut';
import autolib from 'autolib';
import { wait } from '../utils';

export let commandPicker: BrowserWindow = null;

const width = 300;
const height = 320;

let commanderStartTime: number|undefined
let sourceApp: Application|undefined;
let cursorAtOpen: { x: number, y: number }|undefined;

export const prepareCommandPicker = (queryParams?: anyDict): void => {

  const macOS = process.platform === 'darwin';

  // open a new one
  commandPicker = createWindow({
    hash: '/commands',
    title: 'Command Picker',
    x: 0, y: 0,
    width: width,
    height: height,
    frame: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    transparent: macOS,
    resizable: process.env.DEBUG ? true : false,
    hiddenInMissionControl: true,
    queryParams: queryParams,
    keepHidden: true,
    hasShadow: macOS,
  });

  // focus tricks
  commandPicker.on('show', () => {

    // macos can use app.focus which is more elegant
    // windows will use activateCommandPicker
    if (macOS) {
      app.focus({ steal: true});
    }

    // focus
    commandPicker.moveTop();
    commandPicker.focusOnWebView();

    // try to activate (make foremost)
    activateCommandPicker();
    
    // log
    if (commanderStartTime) {
      console.log(`Command picker total time: ${Date.now() - commanderStartTime}ms`);
    }

  })

  // prevent close with keyboard shortcut
  commandPicker.on('close', (event) => {
    closeCommandPicker(sourceApp);
    event.preventDefault();
  });

}

export const openCommandPicker = (params: anyDict): void => {

  // save
  sourceApp = params.sourceApp;
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
  cursorAtOpen = screen.getCursorScreenPoint();
  commandPicker.setBounds({
    x: cursorAtOpen.x - width/2,
    y: cursorAtOpen.y - (params.sourceApp ? 64 : 24),
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

    // remove blur handler
    //console.log('Removing blur handler from command picker');
    commandPicker.removeAllListeners('blur');
    commandPicker.setOpacity(0);

    // now release focus
    await releaseFocus({ sourceApp });

    // now hide
    commandPicker.hide();
    commandPicker.setOpacity(1);
    
  } catch (error) {
    console.error('Error while hiding command picker', error);
    commandPicker = null;
  }  

};

const activateCommandPicker = async () => {
  
  const isThere = () =>
    commandPicker &&
    !commandPicker.isDestroyed() &&
    commandPicker.isVisible() &&
    commandPicker.getOpacity() > 0;

  // wait for command picker to be visible
  const start = Date.now();
  const totalWait = 1000;
  while (!isThere() && Date.now() - start < totalWait) {
    await wait(50);
  } 

  if (!isThere()) {
    console.log('Command picker is not visible after 1 second, not activating');
    return;
  }

  try {

    // clear blur handlers
    commandPicker.removeAllListeners('blur');

    // // macos
    // if (process.platform === 'darwin') {
    //   const automator = new MacosAutomator();
    //   await automator.focusApp({
    //     id: process.env.DEBUG ? 'com.github.Electron' : 'com.nabocorp.witsy',
    //     name: 'Witsy',
    //     path: '',
    //     window: null//commandPicker.getTitle(),
    //   })
    // }

    // windows: click at the top-center of the command picker
    // this is a workaround to make the command picker
    // become the active window. but we don't want to click
    // if the user is moving the mouse so first we need to check
    // that the user did not move even though autolib is
    // explicitely asking to click at specific coordinates...
    try {
      const { x, y } = screen.getCursorScreenPoint();
      if (cursorAtOpen.x === x && cursorAtOpen.y === y) {
        const [winX, winY] = commandPicker.getPosition()
        const [winW] = commandPicker.getSize()
        const x = winX + winW / 2;
        const y = winY + 2;
        if (process.platform === 'win32') {
          const pt = screen.dipToScreenPoint({ x, y });
          await autolib.mouseClick(pt.x, pt.y);
        }/* else if (await Computer.isAvailable()) {
          const currPt = await Computer.getCursorPosition();
          await Computer.mouseMove(x, y);
          await Computer.leftClick();
          await Computer.mouseMove(currPt.x, currPt.y);
        }*/
      } else {
        console.warn('Mouse moved, not clicking on command picker');
      }
    } catch (err) {
      console.warn('mouseClick failed', err);
    }

  } finally {

    // now add blur handler
    if (isThere()) {
      //console.log('Adding blur handler to command picker');
      commandPicker.removeAllListeners('blur');
      commandPicker.on('blur', () => {
        closeCommandPicker(sourceApp);
      });
    } else {
      //console.log('Command picker is not visible, not adding blur handler');
    }
    
  }

}
