
import { BrowserWindow } from 'electron';
import { createWindow } from './index';
import { promptAnywhereWindow } from './anywhere'; 
import { wait } from '../utils';

export let expertsPalette: BrowserWindow = null;

export const showExpertsPalette = () => {

  // try to close existig one
  closeExpertsPalette();

  // get bounds
  const width = 282;
  const height = 412;
  const position = promptAnywhereWindow.getPosition();
  const x = position[0];
  const y = position[1] + promptAnywhereWindow.getBounds().height + 8;

  // open a new one
  expertsPalette = createWindow({
    hash: '/experts',
    x: x,
    y: y,
    width: width,
    height: height,
    frame: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    hiddenInMissionControl: true,
  });

  expertsPalette.on('blur', () => {
    closeExpertsPalette();
  });
  
}

export const closeExpertsPalette = async () => {

  // close it
  try {

    if (expertsPalette && !expertsPalette.isDestroyed()) {

      // console.log('Closing experts palette')
      expertsPalette?.close()
      expertsPalette = null;
      await wait();

      // focus prompt anywhere
      //console.log('Focusing prompt anywhere window')
      promptAnywhereWindow.focus();
      await wait();

    }

  } catch (error) {
    console.error('Error while closing experts palette', error)
  }

  // reset it here to be sure
  //console.log('Done closing experts palette')
  expertsPalette = null;

}

export const isExpertsPaletteOpen = () => {
  return (expertsPalette != null && !expertsPalette.isDestroyed());
}

export const toggleExpertsPalette = async () => {
  showExpertsPalette();
}
