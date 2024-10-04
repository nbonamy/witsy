
import { createWindow, titleBarOptions } from './index';

export const openScratchPad = async () => {

  // get bounds
  const width = 800;
  const height = 600;

  // open a new one
  createWindow({
    hash: '/scratchpad',
    width: width,
    height: height,
    center: true,
    ...titleBarOptions,
  });


}
