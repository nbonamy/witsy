
import { Application } from '../types/automation';
import Automator from './automator'
import * as window from '../main/window'

export default class PromptAnywhere {

  static open = async (): Promise<void> => {

    // get foremost app
    let sourceApp = null;
    if (process.platform !== 'linux') {
      const automator = new Automator();
      sourceApp = await automator.getForemostApp();
    }

    // open prompt
    window.openPromptAnywhere({ sourceApp });
  }

  static close = async (sourceApp?: Application): Promise<void> => {
    await window.closePromptAnywhere(sourceApp);
  }
  
}
