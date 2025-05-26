
import { openMainWindow } from './main';

export const openTranscribePalette = (): void => {

  openMainWindow({
    queryParams: {
      view: 'dictation',
    }
  });
  
}
