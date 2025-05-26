
import { openMainWindow } from './main';

export const openRealtimeChatWindow = (): void => {

  openMainWindow({
    queryParams: {
      view: 'voice-mode',
    }
  });

};
