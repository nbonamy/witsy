
import { anyDict } from '../../types/index';
import { Application } from '../../types/automation';
import { app, BrowserWindow, screen } from 'electron';
import { createWindow, ensureOnCurrentScreen, releaseFocus } from './index';
import MacosAutomator from '../../automations/macos';
import WindowsAutomator from '../../automations/windows';

export let commandPicker: BrowserWindow = null;

const width = 300;
const height = 320;

let commanderStartTime: number|undefined
let sourceApp: Application|undefined;

export const prepareCommandPicker = (queryParams?: anyDict): void => {

  // open a new one
  commandPicker = createWindow({
    hash: '/commands',
    title: 'WitsyCommandPicker',
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

  // focus tricks
  commandPicker.on('show', () => {

    // focus
    app.focus({ steal: true });
    commandPicker.moveTop();
    commandPicker.focusOnWebView();

    // try to activate (make foremost)
    //activateCommandPicker();
    //setTimeout(activateCommandPicker, 250);
    setTimeout(activateCommandPicker, 500);
    //setTimeout(activateCommandPicker, 1000);
    
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

    // remove blur handler
    //console.log('Removing blur handler from command picker');
    commandPicker.removeAllListeners('blur');

    // now hide (and restore opacity)
    commandPicker.hide();
    
    // now release focus
    await releaseFocus({ sourceApp });

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

  // check
  if (!isThere()) {
    console.log('Command picker is not visible, not activating');
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

    // for windows: this works in debug or when run from the terminal
    // suspicion is that in these cases, this is called from another process
    // when in release mode, this is called from the same process
    // if (process.platform === 'win32') {
    //   const automator = new WindowsAutomator();
    //   await automator.activateApp(commandPicker.getTitle());
    // }

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
