
import * as window from '../window'
import Automator from './automator'

export default class Transcriber {

  static initTranscription = async (): Promise<void> => {

    // if dictation window is already open, tell it to stop and transcribe
    if (window.dictationWindow && !window.dictationWindow.isDestroyed()) {
      window.dictationWindow.webContents.send('stop-and-transcribe');
      return;
    }

    // capture the foremost app before opening the window
    const automator = new Automator();
    let sourceApp = null;
    try {
      sourceApp = await automator.getForemostApp();
    } catch (error) {
      console.error('Error getting foremost app', error);
    }

    // open the mini dictation window
    window.openDictationWindow({ sourceApp });

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
