
import { Notification } from 'electron'
import Automator from './automator'
import * as window from '../main/window'
import { putCachedText } from '../main/utils'

export default class ReadAloud {

  static read = async (): Promise<void> => {

    // not available in mas
    if (process.mas) {
      window.showMasLimitsDialog()
      return
    }

    // // hide active windows
    // if (!window.isMainWindowFocused()) {
    //   await window.hideWindows();
    //   await window.releaseFocus();
    // }

    // grab text
    const automator = new Automator();
    const text = await automator.getSelectedText();
    //console.log('Text grabbed', text);

    // // select all
    // if (text == null || text.trim() === '') {
    //   await automator.selectAll();
    //   text = await automator.getSelectedText();
    // }

    // error
    if (text == null) {
      try {
        new Notification({
          title: 'Witsy',
          body: 'An error occurred while trying to grab the text. Please check Privacy & Security settings.'
        }).show()
      } catch (error) {
        console.error('Error showing notification', error);
      }
      return;
    }

    // notify if no text
    if (text.trim() === '') {
      try {
        new Notification({
          title: 'Witsy',
          body: 'Please highlight the text you want to read aloud'
        }).show()
        console.log('No text selected');
      } catch (error) {
        console.error('Error showing notification', error);
      }
      return;
    }

    // log
    console.debug('Text grabbed:', `${text.slice(0, 50)}…`);

    // go on with a cached text id
    const textId = putCachedText(text);
    const sourceApp = await automator.getForemostApp();
    await window.openReadAloudPalette({ textId, sourceApp: JSON.stringify(sourceApp) });

  }

}