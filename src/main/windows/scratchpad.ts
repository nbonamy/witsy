
import { anyDict } from '../../types/index';
import { app } from 'electron';
import { createWindow, titleBarOptions, getCenteredCoordinates } from './index';
import { putCachedText } from '../../main/utils';
import { useI18n } from '../i18n';

export const openScratchPad = (text?: string|null): void => {

  // get bounds
  const width = 800;
  const height = 600;
  const { x, y } = getCenteredCoordinates(width, height);

  // query params
  const queryParams: anyDict = {};
  console.log('text', text);
  if (typeof text === 'string' && text.length > 0) {
    const textId = putCachedText(text);
    queryParams['textId'] = textId;
  }

  // open a new one
  const scratchpadWindow = createWindow({
    title: useI18n(app)('tray.menu.scratchpad'),
    hash: '/scratchpad',
    x, y, width, height,
    ...titleBarOptions(),
    showInDock: true,
    queryParams,
  });

  // open the DevTools
  if (process.env.DEBUG) {
    scratchpadWindow.webContents.openDevTools({ mode: 'right' });
  }

  // focus
  app.focus({ steal: true });
  scratchpadWindow.focus();

}
