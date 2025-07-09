
import { openMainWindow } from './main';

export const openAgentForgeWindow = (): void => {

  openMainWindow({
    queryParams: {
      view: 'agents',
    }
  });

};