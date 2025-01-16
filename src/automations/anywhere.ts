
import { Application } from '../types/automation';
import { BrowserWindow } from 'electron';
import Automator from './automator'
import * as window from '../main/window'

export default class PromptAnywhere {

  static hadFocus = true;

  static open = async (): Promise<void> => {

    // check if we have focus
    // console.log('PromptAnywhere.open', BrowserWindow.getFocusedWindow());
    PromptAnywhere.hadFocus = !!BrowserWindow.getFocusedWindow();

    // get foremost app
    let sourceApp = null;
    if (process.platform === 'darwin') {
      const automator = new Automator();
      sourceApp = await automator.getForemostApp();
    }

    // open prompt
    //await window.hideWindows([ window.promptAnywhereWindow ]);
    await window.openPromptAnywhere({ sourceApp });
  }

  static close = async (sourceApp?: Application): Promise<void> => {

    // close
    await window.closePromptAnywhere();
    //await window.restoreWindows();
    if (!PromptAnywhere.hadFocus) {
      await window.releaseFocus({ sourceApp });
      PromptAnywhere.hadFocus = true;
    }

  }
  
}
