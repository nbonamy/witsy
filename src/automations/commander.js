
import fs from 'fs'
import path from 'path'
import { clipboard, Notification } from 'electron'
import OpenAI from '../services/openai'
import Ollama from '../services/ollama'
import Message from '../models/message'
import Automator from './automator'
import * as window from '../window'

const loadConfig = (app) => {
  const userDataPath = app.getPath('userData')
  const settingsFilePath = path.join(userDataPath, 'settings.json')
  const settingsContents = fs.readFileSync(settingsFilePath, 'utf-8')
  return JSON.parse(settingsContents)
}

const buildLLm = (config, engine) => {

  // build llm
  if (engine === 'ollama') {
    return new Ollama(config)
  } else if (config.openai.apiKey) {
    return new OpenAI(config)
  } else {
    return null
  }

}

const promptLlm = (app, engine, model, prompt) => {

  // config
  const config = loadConfig(app)

  // get llm
  const llm = buildLLm(config, engine)

  // build messages
  let messages = [
    new Message('user', prompt)
  ]

  // now get it
  return llm.complete(messages, { model: model })

}

const finalizeCommand = async (command, text) => {
  
  // we need an automator
  const automator = new Automator();

  if (command.behavior === 'new_window') {

    return window.openChatWindow({
      prompt: text,
      engine: command.engine,
      model: command.model
    })
  
  } else if (command.behavior === 'insert_below') {

    await automator.moveCaretBelow()
    await automator.pasteText(text)

  } else if (command.behavior === 'replace_selection') {

    await automator.pasteText(text)

  } else if (command.behavior === 'copy_cliboard') {

    await clipboard.writeText(text)

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

  // notify if no text
  if (text == null || text.trim() === '') {
    new Notification({
      title: 'Witty AI',
      body: 'Please highlight the text you want to analyze'
    }).show()
    console.log('No text selected');
    window.restoreWindows();
    return;
  }

  // go on
  await window.openCommandPalette(text)

}

export const runCommand = async (app, text, command) => {

  //
  let result = {
    text: text,
    prompt: null,
    response: null,
    chatWindow: null,
  };


  try {

    // extract what we need
    const template = command.template;
    const behavior = command.behavior;
    const engine = command.engine;
    const model = command.model;
    // const temperature = command.temperature;

    // build prompt
    result.prompt = template.replace('{input}', result.text);

    // new window is different
    if (behavior === 'new_window') {
      
      result.chatWindow = await finalizeCommand(command, result.prompt);

    } else {
      
      // open waiting panel
      window.openWaitingPanel();

      // now prompt llm
      //console.log(`Prompting with ${result.prompt}`);
      const response = await promptLlm(app, engine, model, result.prompt);
      result.response = response.content;

      // done
      await window.closeWaitingPanel();
      await window.releaseFocus();

      // now paste
      //console.log(`Processing LLM output: ${result.response}`);
      await finalizeCommand(command, result.response);

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
