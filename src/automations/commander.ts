
import { Command, strDict } from '../types/index.d'
import { Configuration } from '../types/config.d'
import { RunCommandResponse } from '../types/automation.d'
import { LlmResponse } from '../types/llm.d'
import { App, BrowserWindow, Notification } from 'electron'
import { loadSettings } from '../main/config'
import { igniteEngine } from '../services/llm' 
import * as window from '../main/window'

import Message from '../models/message'
import Automator from './automator'
import LlmEngine from '../services/engine'
import { v4 as uuidv4 } from 'uuid'

const textCache: strDict = {}

export default class Commander {

  private llm: LlmEngine
  private cancelled: boolean
  
  constructor(llm?: LlmEngine) {
    this.llm = llm
    this.cancelled = false
  }

  cancelCommand = async (): Promise<void> => {

    // close stuff
    await window.closeWaitingPanel();
    await window.releaseFocus();

    // record
    this.cancelled = true;

  }
  
  static initCommand = async (): Promise<void> => {

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
    const textId = Commander.putCachedText(text);
    await window.openCommandPalette(textId)

  }

  execCommand = async (app: App, textId: string, command: Command): Promise<RunCommandResponse> => {

    //
    const result: RunCommandResponse = {
      text: Commander.getCachedText(textId),
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

      // extract what we need
      const template = command.template;
      const action = command.action;
      const engine = command.engine || config.commands.engine || config.llm.engine;
      const model = command.model || config.commands.model || config.getActiveModel();
      // const temperature = command.temperature;

      // build prompt
      result.prompt = template.replace('{input}', result.text);

      // new window is different
      if (action === 'chat_window') {
        
        result.chatWindow = await this.finishCommand(command, result.prompt, engine, model);

      } else {
        
        // open waiting panel
        window.openWaitingPanel();

        // we need an llm
        if (!this.llm) {
          this.llm = igniteEngine(engine, config);
          if (!this.llm) {
            throw new Error(`Invalid LLM engine: ${engine}`)
          }
        }

        // now prompt llm
        console.debug(`Prompting with ${result.prompt.slice(0, 50)}…`);
        const response = await this.promptLlm(model, result.prompt);
        result.response = response.content;

        // if cancelled
        if (this.cancelled) {
          console.debug('Discarding LLM output as command was cancelled');
          result.cancelled = true;
          return result;
        }

        // done
        await window.closeWaitingPanel();
        await window.releaseFocus();

        // now paste
        console.debug(`Processing LLM output: ${result.response.slice(0, 50)}…`);
        await this.finishCommand(command, result.response, engine, model);

      }

    } catch (error) {
      console.error('Error while testing', error);
    }

    // done waiting
    console.log('Destroying waiting panel')
    await window.closeWaitingPanel(true);
    window.releaseFocus();

    // done
    return result;

  }

  private promptLlm = (model: string, prompt: string): Promise<LlmResponse> => {

    // build messages
    const messages: Message[]  = [
      new Message('user', prompt)
    ]

    // now get it
    return this.llm.complete(messages, { model: model })

  }

  private finishCommand = async (command: Command, text: string, engine: string, model: string): Promise<BrowserWindow|undefined> => {
    
    // we need an automator
    const automator = new Automator();

    if (command.action === 'chat_window') {

      return window.openChatWindow({
        promptId: Commander.putCachedText(text),
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
