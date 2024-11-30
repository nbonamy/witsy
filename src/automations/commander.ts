
import { Command } from '../types/index.d'
import { Configuration } from '../types/config.d'
import { RunCommandResponse } from '../types/automation.d'
import { App, BrowserWindow, Notification } from 'electron'
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
    await window.openCommandPicker(textId)

  }

  execCommand = async (app: App, textId: string, command: Command): Promise<RunCommandResponse> => {

    //
    const result: RunCommandResponse = {
      text: getCachedText(textId),
      prompt: null as string | null,
      response: null as string | null,
      chatWindow: null as BrowserWindow | null,
      cancelled: false
    };

    try {

      // check
      if (!result.text) {
        throw new Error('No text to process');
      }

      // config
      const config: Configuration = loadSettings(app);
      const llmFactory = new LlmFactory(config);

      // extract what we need
      const template = command.template;
      //const action = command.action;
      let engine = command.engine || config.commands.engine;
      let model = command.model || config.commands.model;
      if (!engine?.length || !model?.length) {
        ({ engine, model } = llmFactory.getChatEngineModel(false));
      }
      // const temperature = command.temperature;

      // build prompt
      result.prompt = template.replace('{input}', result.text);

      // new window
      //if (action === 'chat_window') {
      if (command.id == askMeAnythingId) {
        
        result.chatWindow = await this.finishCommand(command, result.prompt, engine, model);

      } else {

        // store it
        const promptId = putCachedText(result.prompt);

        // build the params
        const params = {
          promptId: promptId,
          engine,
          model
        };

        // and open the window
        window.openCommandResult(params);
        return result;

        // // open waiting panel
        // window.openWaitingPanel();

        // // we need an llm
        // const llm = llmFactory.igniteEngine(engine);
        // if (!llm) {
        //   throw new Error(`Invalid LLM engine: ${engine}`)
        // }

        // // now prompt llm
        // console.debug(`Prompting with ${result.prompt.slice(0, 50)}…`);
        // const response = await this.promptLlm(llm, model, result.prompt);
        // result.response = removeMarkdown(response.content, {
        //   stripListLeaders: false,
        //   listUnicodeChar: ''
        // });

        // // if cancelled
        // if (this.cancelled) {
        //   console.debug('Discarding LLM output as command was cancelled');
        //   result.cancelled = true;
        //   return result;
        // }

        // // done
        // await window.closeWaitingPanel();
        // await window.releaseFocus();

        // // now paste
        // console.debug(`Processing LLM output: ${result.response.slice(0, 50)}…`);
        // await this.finishCommand(command, result.response, engine, model);

        // // done
        // await window.restoreWindows();
        // await window.releaseFocus();
        // return result;

      }

    } catch (error) {
      console.error('Error while testing', error);
    }

    // done waiting
    //await window.closeWaitingPanel();
    await window.restoreWindows();
    await window.releaseFocus();

    // done
    return result;

  }

  // private promptLlm = (llm: LlmEngine, model: string, prompt: string): Promise<LlmResponse> => {

  //   // build messages
  //   const messages: Message[]  = [
  //     new Message('user', prompt)
  //   ]

  //   // now get it
  //   return llm.complete(model, messages)

  // }

  private finishCommand = async (command: Command, text: string, engine: string, model: string): Promise<BrowserWindow|undefined> => {
    
    // log
    //console.log('Finishing command', command, text, engine, model);

    // we need an automator
    const automator = new Automator();

    if (command.action === 'chat_window') {

      return window.openPromptAnywhere({
        promptId: putCachedText(text),
        // execute: this.shouldExecutePrompt(command),
        engine: engine || command.engine,
        model: model || command.model
      })
    
    } else if (command.action === 'paste_below') {

      await automator.moveCaretBelow()
      await automator.pasteText(text)

    } else if (command.action === 'paste_in_place') {

      await automator.pasteText(text)

    } else if (command.action === 'clipboard_copy') {

      await automator.copyToClipboard(text)

    }

  }

  private shouldExecutePrompt = (command: Command): boolean => {
    return !([askMeAnythingId].includes(command.id))
  }

}
