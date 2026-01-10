
import { Application } from 'types/automation';
import { anyDict } from 'types/index';
import { app, BrowserWindow } from 'electron';
import { createWindow, getCurrentScreen, releaseFocus } from './index';
import { loadSettings } from '../config';
import process from 'node:process';

export let dictationWindow: BrowserWindow = null;

// Detect if current Mac has a notch (menu bar height > 30px indicates notch)
export const hasNotch = (): boolean => {
  if (process.platform !== 'darwin') return false;
  const display = getCurrentScreen();
  const menuBarHeight = display.workArea.y - display.bounds.y;
  return menuBarHeight > 30;
};

export const closeDictationWindow = async (sourceApp?: Application): Promise<void> => {
  try {
    if (dictationWindow && !dictationWindow.isDestroyed()) {
      dictationWindow?.close();
    }
  } catch (error) {
    console.error('Error while closing dictation window', error);
  }
  dictationWindow = null;
  if (sourceApp) {
    await releaseFocus({ sourceApp });
  }
};

export const openDictationWindow = (params: anyDict): void => {

  // close any existing one
  closeDictationWindow();

  // get settings for appearance mode
  const settings = loadSettings(app);
  const appearance = settings.stt.quickDictation?.appearance || 'panel';

  // get current screen
  const currentScreen = getCurrentScreen();
  const useNotch = appearance === 'notch' && hasNotch();
  const width = useNotch ? 320 : 320;
  const notchPadding = 16;
  
  let height = 64;

  // calculate position based on appearance mode
  let x: number;
  let y: number;

  if (useNotch) {
    // Position at very top of screen, overlapping the menu bar
    // The window content will have padding to appear below the notch
    // Use a fixed small padding since we just need to clear the notch camera area
    x = currentScreen.bounds.x + Math.round((currentScreen.bounds.width - width) / 2);
    y = currentScreen.bounds.y - 1; // Start at very top
    height = height + notchPadding; // Make window taller to include notch area
  } else {
    // Position at bottom center, above dock/taskbar
    x = currentScreen.bounds.x + Math.round((currentScreen.workArea.width - width) / 2);
    // workArea.y + workArea.height gives us the bottom of the usable screen area
    // (above the dock on macOS, above taskbar on Windows)
    y = currentScreen.workArea.y + currentScreen.workArea.height - height - 16; // 16px margin from bottom
  }

  // open a new one
  dictationWindow = createWindow({
    hash: '/dictation',
    x, y, width, height,
    frame: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    resizable: false,
    hiddenInMissionControl: true,
    transparent: useNotch,
    enableLargerThanScreen: useNotch,
    roundedCorners: !useNotch,
    queryParams: {
      sourceApp: JSON.stringify(params.sourceApp),
      appearance: useNotch ? 'notch' : 'panel',
      notchHeight: useNotch ? notchPadding : 0
    }
  });

  // for notch appearance, use screen-saver level to appear above menu bar
  if (useNotch) {
    dictationWindow.setAlwaysOnTop(true, 'screen-saver');
  }

  // focus
  dictationWindow.focus();

};
