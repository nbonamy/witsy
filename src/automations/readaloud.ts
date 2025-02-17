
import { Notification } from 'electron'
import Automator from './automator'
import Automation from './automation'
import * as window from '../main/window'
import { putCachedText } from '../main/utils'

export default class ReadAloud {

  static read = async (timeout?: number): Promise<void> => {

    // not available in mas
    if (process.mas) {
      window.showMasLimitsDialog()
      return
    }

    // get selected text
    const automator = new Automator();
    const text = await Automation.grabSelectedText(automator, timeout);

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

    // go on with a cached text id
    const textId = putCachedText(text);
    const sourceApp = await automator.getForemostApp();
    await window.openReadAloudPalette({ textId, sourceApp: JSON.stringify(sourceApp) });

  }

}