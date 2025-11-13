
import * as window from '../window'
import Automator from './automator'

export default class Transcriber {

  static initTranscription = async (): Promise<void> => {

    // open
    await window.openTranscribePalette()

  }

  static insertTranscription = async (text: string): Promise<void> => {
      
      // done
      window.mainWindow.minimize();
      await window.releaseFocus();

      // now paste
      console.debug(`Processing transcription output: ${text.slice(0, 50)}…`);

      // we need an automator
      const automator = new Automator();
      await automator.pasteText(text)

      // done
      return;

  }
}
