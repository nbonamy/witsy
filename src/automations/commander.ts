
import { Command } from '../index.d'
import { Configuration } from '../config.d'
import { App, BrowserWindow, Notification } from 'electron'
import { settingsFilePath, loadSettings } from '../main/config'
import * as window from '../main/window'
import OpenAI from '../services/openai'
import Ollama from '../services/ollama'
import Message from '../models/message'
import Automator from './automator'
import LlmEngine from '../services/engine'

const buildLLm = (config: Configuration, engine: string) => {

  // build llm
  if (engine === 'ollama') {
    return new Ollama(config)
  } else if (config.engines.openai.apiKey) {
    return new OpenAI(config)
  } else {
    return null
  }

}

const promptLlm = (llm: LlmEngine, model: string, prompt: string) => {

  // build messages
  const messages: Message[]  = [
    new Message('user', prompt)
  ]

  // now get it
  return llm.complete(messages, { model: model })

}

const finalizeCommand = async (command: Command, text: string, engine: string, model: string) => {
  
  // we need an automator
  const automator = new Automator();

  if (command.action === 'chat_window') {

    return window.openChatWindow({
      prompt: text,
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

export const prepareCommand = async () => {

  // hide active windows
  window.hideActiveWindows();
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

  // notify if no text
  if (text == null || text.trim() === '') {
    try {
      new Notification({
        title: 'Witty AI',
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
  console.debug('Text grabbed:', `${text.slice(0, 50)}...`);

  // go on
  await window.openCommandPalette(text)

}

export const runCommand = async (app: App, llm: LlmEngine, text: string, command: Command) => {

  //
  const result = {
    text: text,
    prompt: null as string | null,
    response: null as string | null,
    chatWindow: null as BrowserWindow | null,
  };


  try {

    // config
    const config = loadSettings(settingsFilePath(app));

    // extract what we need
    const template = command.template;
    const action = command.action;
    const engine = command.engine || config.llm.engine;
    const model = command.model || config.getActiveModel();
    // const temperature = command.temperature;

    // build prompt
    result.prompt = template.replace('{input}', result.text);

    // new window is different
    if (action === 'chat_window') {
      
      result.chatWindow = await finalizeCommand(command, result.prompt, engine, model);

    } else {
      
      // open waiting panel
      window.openWaitingPanel();

      // we need an llm
      if (!llm) {
        llm = buildLLm(config, engine);
        if (!llm) {
          throw new Error(`Invalid LLM engine: ${engine}`)
        }
      }

      // now prompt llm
      console.debug(`Prompting with ${result.prompt.slice(0, 50)}...`);
      const response = await promptLlm(llm, model, result.prompt);
      result.response = response.content;

      // done
      await window.closeWaitingPanel();
      await window.releaseFocus();

      // now paste
      console.debug(`Processing LLM output: ${result.response.slice(0, 50)}...`);
      await finalizeCommand(command, result.response, engine, model);

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
