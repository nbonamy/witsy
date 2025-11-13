
import { anyDict } from 'types/index';
import { openMainWindow } from './main';

export const openSettingsWindow = (payload?: anyDict): void => {

  openMainWindow({
    queryParams: {
      view: 'settings',
      ...payload
    }
  });

};
