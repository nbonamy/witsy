
import { BrowserWindow, screen } from 'electron';
import { createWindow } from './index';
import { wait } from '../utils';

export let waitingPanel: BrowserWindow = null;

export const closeWaitingPanel = async () => {
  try {
    if (waitingPanel && !waitingPanel.isDestroyed()) {
      // console.log('Closing waiting panel')
      waitingPanel?.close()
      await wait();
    }
  } catch (error) {
    console.error('Error while closing waiting panel', error);
  }
  waitingPanel = null;
}

export const openWaitingPanel = () => {

  // try to close existig one
  // console.log('Opening waiting panel')
  closeWaitingPanel();

  // get bounds
  const width = 100;
  const height = 20;
  const { x, y } = screen.getCursorScreenPoint();

  // open a new one
  waitingPanel = createWindow({
    hash: '/wait',
    x: x - width/2,
    y: y - height*1.5,
    width: width,
    height: height,
    frame: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    resizable: false,
    hiddenInMissionControl: true,
    hasShadow: false,
  });

}
