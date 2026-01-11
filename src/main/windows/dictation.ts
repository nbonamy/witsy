
import { Application } from 'types/automation';
import { anyDict } from 'types/index';
import { app, BrowserWindow, Notification } from 'electron';
import { createWindow, getCurrentScreen, releaseFocus } from './index';
import { loadSettings } from '../config';
import { useI18n } from '../i18n';
import Automator from '../automations/automator';
import process from 'node:process';

export let dictationWindow: BrowserWindow = null;
let currentAppearance: 'panel' | 'notch' = 'panel';

// Detect if current Mac has a notch (menu bar height > 30px indicates notch)
export const hasNotch = (): boolean => {
  if (process.platform !== 'darwin') return false;
  const display = getCurrentScreen();
  const menuBarHeight = display.workArea.y - display.bounds.y;
  return menuBarHeight > 30;
};

const getWindowBounds = (appearance: 'panel' | 'notch') => {
  const currentScreen = getCurrentScreen();
  const useNotch = appearance === 'notch' && hasNotch();
  const width = 320;
  const notchPadding = 16;
  let height = useNotch ? 80 : 64;

  let x: number;
  let y: number;

  if (useNotch) {
    x = currentScreen.bounds.x + Math.round((currentScreen.bounds.width - width) / 2);
    y = currentScreen.bounds.y - 1;
    height = height + notchPadding;
  } else {
    x = currentScreen.bounds.x + Math.round((currentScreen.workArea.width - width) / 2);
    y = currentScreen.workArea.y + currentScreen.workArea.height - height - 16;
  }

  return { x, y, width, height, useNotch, notchPadding };
};

export const prepareDictationWindow = (): void => {

  // don't create if already exists
  if (dictationWindow && !dictationWindow.isDestroyed()) {
    return;
  }

  // get settings for appearance mode
  const settings = loadSettings(app);
  const appearance = settings.stt.quickDictation?.appearance || 'panel';
  const { x, y, width, height, useNotch, notchPadding } = getWindowBounds(appearance);

  // track appearance mode
  currentAppearance = useNotch ? 'notch' : 'panel';

  // create the window but keep it hidden
  dictationWindow = createWindow({
    hash: '/dictation',
    x, y, width, height,
    frame: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    resizable: true,
    hiddenInMissionControl: true,
    transparent: useNotch,
    enableLargerThanScreen: useNotch,
    roundedCorners: !useNotch,
    keepHidden: true,
    queryParams: {
      appearance: currentAppearance,
      notchHeight: useNotch ? notchPadding : 0
    }
  });

  // for notch appearance, use screen-saver level to appear above menu bar
  if (useNotch) {
    dictationWindow.setAlwaysOnTop(true, 'screen-saver');
  }

  // on show, focus the window
  dictationWindow.on('show', () => {
    if (process.platform === 'darwin') {
      app.focus({ steal: true });
    }
    dictationWindow.moveTop();
    dictationWindow.focus();
  });

  // intercept close to hide instead
  dictationWindow.on('close', (event) => {
    if (!dictationWindow.isDestroyed()) {
      event.preventDefault();
      dictationWindow.hide();
    }
  });

};

export const closeDictationWindow = async (text: string, sourceApp?: Application): Promise<void> => {
  try {
    if (dictationWindow && !dictationWindow.isDestroyed() && dictationWindow.isVisible()) {
      dictationWindow.hide();
    }

    if (sourceApp) {
      await releaseFocus({ sourceApp });
    }

  } catch (error) {
    console.error('Error while hiding dictation window', error);
  }

  // paste text after window is hidden and focus is released
  if (text.trim().length > 0) {
    const automator = new Automator();
    await automator.pasteText(text);
  }
};

export const openDictationWindow = (params: anyDict): void => {

  // get settings to check clipboard option
  const settings = loadSettings(app);
  const copyToClipboard = settings.stt.quickDictation?.copyToClipboard || false;

  // if no source app and no clipboard option, show notification instead
  if (!params.sourceApp && !copyToClipboard) {
    const t = useI18n(app);
    try {
      new Notification({
        title: t('common.appName'),
        body: t('dictation.noTargetError')
      }).show();
    } catch (error) {
      console.error('Error showing notification', error);
    }
    return;
  }

  // if window doesn't exist, create it
  if (!dictationWindow || dictationWindow.isDestroyed()) {
    prepareDictationWindow();
  }

  // get appearance mode
  const appearance = settings.stt.quickDictation?.appearance || 'panel';
  const { x, y, width, height, useNotch, notchPadding } = getWindowBounds(appearance);

  // check if appearance mode changed (requires window recreation for transparency)
  const newAppearance = useNotch ? 'notch' : 'panel';
  if (newAppearance !== currentAppearance) {
    // need to recreate window with different transparency
    dictationWindow.destroy();
    dictationWindow = null;
    prepareDictationWindow();
  }

  // update window bounds and properties for current appearance
  dictationWindow.setBounds({ x, y, width, height });

  // for notch appearance, use screen-saver level
  if (useNotch) {
    dictationWindow.setAlwaysOnTop(true, 'screen-saver');
  } else {
    dictationWindow.setAlwaysOnTop(true, 'floating');
  }

  // show the window
  dictationWindow.show();

  // send show event with params to renderer
  // use setImmediate to ensure the event is sent after the window is fully shown
  const showParams = {
    sourceApp: params.sourceApp ? JSON.stringify(params.sourceApp) : null,
    appearance: newAppearance,
    notchHeight: useNotch ? notchPadding : 0
  };

  if (dictationWindow.webContents.isLoading()) {
    dictationWindow.webContents.once('did-finish-load', () => {
      dictationWindow.webContents.send('show', showParams);
    });
  } else {
    dictationWindow.webContents.send('show', showParams);
  }

};
