
import { BrowserWindow } from 'electron';
import Automator from './automator'
import * as window from '../main/window'

export default class PromptAnywhere {

  static hadFocus = false;

  static open = async (): Promise<void> => {

    // check if we have focus
    PromptAnywhere.hadFocus = !!BrowserWindow.getFocusedWindow();

    // get foremost app
    let foremostApp = '';
    if (process.platform === 'darwin') {
      const automator = new Automator();
      foremostApp = await automator.getForemostAppId();
    }

    // open prompt
    //await window.hideWindows([ window.promptAnywhereWindow ]);
    await window.openPromptAnywhere({
      foremostApp: foremostApp
    });
  }

  static close = async (): Promise<void> => {

    // close
    await window.closePromptAnywhere();
    //await window.restoreWindows();
    if (!PromptAnywhere.hadFocus) {
      await window.releaseFocus();
    }

  }
  
}
