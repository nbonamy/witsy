
import { app, BrowserWindow, Rectangle, WillResizeDetails } from 'electron';
import { electronStore, createWindow, getCenteredCoordinates } from './index';
import { wait } from '../utils';
import { useI18n } from '../i18n';

const storeBoundsId = 'transcribe.bounds'

export let transcribePalette: BrowserWindow = null;

export const closeTranscribePalette = async () => {
  try {
    if (transcribePalette && !transcribePalette.isDestroyed()) {
      // console.log('Closing read aloud picker')
      transcribePalette?.close()
      await wait();
    }
  } catch (error) {
    console.error('Error while closing read aloud picker', error);
  }
  transcribePalette = null;
};

export const openTranscribePalette = async () => {

  // try to show existig one
  closeTranscribePalette();

  // get bounds from here
  const bounds: Electron.Rectangle = electronStore?.get(storeBoundsId) as Electron.Rectangle;

  // get bounds
  const minWidth = 460
  const minHeight = 300
  const width = bounds?.width ?? minWidth;
  const height = bounds?.height ?? minHeight;
  const center = getCenteredCoordinates(width, height);

  // open a new one
  transcribePalette = createWindow({
    title: useI18n(app)('transcribe.title'),
    hash: '/transcribe',
    x: bounds?.x || center.x,
    y: bounds?.y || center.y,
    width: width,
    height: height,
    minWidth: minWidth,
    minHeight: minHeight,
    center: true,
    frame: false,
    resizable: true,
    showInDock: true,
  });

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  transcribePalette.on('will-resize', function (event: Event, newBounds: Rectangle, details: WillResizeDetails) {
    if (!process.env.DEBUG) {
      transcribePalette.setSize(newBounds.width, minHeight);
      event.preventDefault();
    }
  });

  transcribePalette.on('close', () => {
    electronStore.set(storeBoundsId, transcribePalette.getBounds());
  })

  // handle window close
  transcribePalette.on('closed', () => {
    transcribePalette = null;
  });

}