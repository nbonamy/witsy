
import Automator from './automator'
import * as window from '../main/window'

export default class PromptAnywhere {

  constructor() {
  }

  static open = async (): Promise<void> => {

    // get foremost app
    let foremostApp = '';
    if (process.platform === 'darwin') {
      const automator = new Automator();
      foremostApp = await automator.getForemostApp();
    }

    // open prompt
    await window.hideWindows();
    await window.openPromptAnywhere({
      foremostApp: foremostApp
    });
  }

  static close = async (): Promise<void> => {

    // close
    await window.closePromptAnywhere();
    await window.restoreWindows();
    //await window.releaseFocus();

  }
  
}
