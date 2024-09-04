
import { strDict } from '../types/index.d'
import { Notification } from 'electron'
import Automator from './automator'
import { v4 as uuidv4 } from 'uuid'
import * as window from '../main/window'

const textCache: strDict = {}

export default class ReadAloud {

  static read = async (): Promise<void> => {

    // hide active windows
    if (!window.isMainWindowFocused()) {
      await window.hideWindows();
      await window.releaseFocus();
    }

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
    const textId = ReadAloud.putCachedText(text);
    await window.openReadAloudPalette(textId)

  }

  static getCachedText = (id: string): string => {
    const prompt = textCache[id]
    delete textCache[id]
    return prompt
  }

  static putCachedText = (text: string): string => {
    const id = uuidv4()
    textCache[id] = text
    return id
  }

}