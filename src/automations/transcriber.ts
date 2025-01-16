
import * as window from '../main/window'
import Automator from './automator'

export default class Transcriber {

  static initTranscription = async (): Promise<void> => {

    // // hide active windows
    // if (!window.isMainWindowFocused()) {
    //   await window.hideWindows();
    //   await window.releaseFocus();
    // }

    // go on with a cached text id
    await window.openTranscribePalette()

  }

  static insertTranscription = async (text: string): Promise<void> => {
      
      // done
      await window.closeTranscribePalette();
      await window.releaseFocus();

      // now paste
      console.debug(`Processing transcription output: ${text.slice(0, 50)}…`);

      // we need an automator
      const automator = new Automator();
      await automator.pasteText(text)

      // done
      // await window.restoreWindows();
      // await window.releaseFocus();
      return;

  }
}