
import { Configuration } from '../types/config.d'
import { RunCommandParams } from '../types/automation.d'
import { App, Notification } from 'electron'
import { getCachedText, putCachedText } from '../main/utils'
import { loadSettings } from '../main/config'
import LlmFactory from '../llms/llm'
import Automator from './automator'
import * as window from '../main/window'

const askMeAnythingId = '00000000-0000-0000-0000-000000000000'

export const notEditablePrompts = [
  askMeAnythingId
]

export default class Commander {

  static initCommand = async (): Promise<void> => {

    // not available in mas
    if (process.mas) {
      window.showMasLimitsDialog()
      return
    }

    // hide active windows
    await window.hideWindows();
    await window.releaseFocus();

    // grab text
    const automator = new Automator();
    const text = await automator.getSelectedText();
    const sourceApp = await automator.getForemostAppPath();

    // error
    if (text == null) {
      try {
        new Notification({
          title: 'Witsy',
          body: 'An error occurred while trying to grab the text. Please check Privacy & Security settings.'
        }).show()
        window.restoreWindows();
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
          body: 'Please highlight the text you want to analyze'
        }).show()
        console.log('No text selected');
        window.restoreWindows();
      } catch (error) {
        console.error('Error showing notification', error);
      }
      return;
    }

    // log
    console.debug('Text grabbed:', `${text.slice(0, 50)}…`);

    // go on with a cached text id
    const textId = putCachedText(text);
    await window.openCommandPicker({ textId, sourceApp });

  }

  execCommand = async (app: App, params: RunCommandParams): Promise<boolean> => {

    // deconstruct
    const { textId, sourceApp, command } = params;
    
    // get text
    const text = getCachedText(textId);

    try {

      // check
      if (!text) {
        console.error('No text to process');
        return false;
      }

      // config
      const config: Configuration = loadSettings(app);
      const llmFactory = new LlmFactory(config);

      // extract what we need
      const template = command.template;
      let engine = command.engine || config.commands.engine;
      let model = command.model || config.commands.model;
      if (!engine?.length || !model?.length) {
        ({ engine, model } = llmFactory.getChatEngineModel(false));
      }

      // build prompt
      const prompt = template.replace('{input}', text);
      const promptId = putCachedText(prompt);

      // ask me anything is special
      if (command.id == askMeAnythingId) {

        // build the params
        const params = {
          promptId: putCachedText(prompt),
          sourceApp: sourceApp,
          engine: engine || command.engine,
          model: model || command.model
        };          
          
        // and open the window
        window.openPromptAnywhere(params);
        return true;

      } else {

        // build the params
        const params = {
          promptId: promptId,
          engine,
          model
        };

        // and open the window
        window.openCommandResult(params);
        return true;

      }

    } catch (error) {
      console.error('Error while executing command', error);
    }

    // error
    await window.restoreWindows();
    await window.releaseFocus();

    // done
    return false;

  }

}
