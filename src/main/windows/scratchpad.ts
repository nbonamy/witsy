
import { app } from 'electron';
import { createWindow, titleBarOptions } from './index';

export const openScratchPad = async () => {

  // get bounds
  const width = 800;
  const height = 600;

  // open a new one
  const scratchpadWindow = createWindow({
    hash: '/scratchpad',
    width: width,
    height: height,
    center: true,
    ...titleBarOptions,
  });

  // open the DevTools
  if (process.env.DEBUG) {
    scratchpadWindow.webContents.openDevTools();
  }

  // show in dock
  if (process.platform === 'darwin') {
    app.dock.show();
  }
  

}
