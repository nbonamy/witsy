
import { openMainWindow } from './main';

export const openDesignStudioWindow = (): void => {

  openMainWindow({
    queryParams: {
      view: 'studio',
    }
  });

};