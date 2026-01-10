
import { openMainWindow } from './main';

export const openAudioBooth = (): void => {

  openMainWindow({
    queryParams: {
      view: 'booth',
    }
  });
  
}
