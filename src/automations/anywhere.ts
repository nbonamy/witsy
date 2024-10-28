
import { App } from 'electron'
import { removeMarkdown } from '@excalidraw/markdown-to-text'
import Automator from './automator'
import * as window from '../main/window'

export default class PromptAnywhere {

  constructor() {
  }

  static initPrompt = async (): Promise<void> => {

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
  
  static insert = async (app: App, response: string): Promise<void> => {

    try {

      const result = removeMarkdown(response, {
        stripListLeaders: false,
        listUnicodeChar: ''
      });

      // done
      await window.closePromptAnywhere();
      await window.releaseFocus();

      // now paste
      console.debug(`Processing LLM output: ${result.slice(0, 50)}…`);

      // we need an automator
      const automator = new Automator();
      await automator.pasteText(result)

      // done
      await window.restoreWindows();
      await window.releaseFocus();
      return;

    } catch (error) {
      console.error('Error while testing', error);
    }

    // done waiting
    await window.closeWaitingPanel();
    await window.restoreWindows();
    await window.releaseFocus();

  }

  static continueAsChat = async (app: App, chatId: string): Promise<void> => {

    // done with this
    await window.closePromptAnywhere();
    await window.restoreWindows();
    await window.releaseFocus();

    // now open main
    await window.openMainWindow({ queryParams: { chatId: chatId } });
  
  }

}
