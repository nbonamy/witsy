
import fs from 'fs'
import path from 'path'
import { clipboard, Notification } from 'electron'
import OpenAI from '../services/openai'
import Ollama from '../services/ollama'
import Message from '../models/message'
import Automator from './automator'
import { openChatWindow, openWaitingPanel, closeWaitingPanel, releaseFocus } from '../window'

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

const finalizeCommand = async (automator, command, text) => {

  if (command.behavior === 'new_window') {

    return openChatWindow({
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

export const runCommand = async (app, command) => {

  //
  let result = {
    text: null,
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

    // we need an automator
    const automator = new Automator();

    // first grab text
    result.text = await automator.getSelectedText();
    //console.log(`Grabbed [${result.text}]`);
    if (result.text.trim() === '') {
      new Notification({
        title: app.name,
        body: 'Please highlight the text you want to analyze'
      }).show()
      console.log('No text selected');
      return result;
    }

    // build prompt
    result.prompt = template.replace('{input}', result.text);

    // new window is different
    if (behavior === 'new_window') {
      
      result.chatWindow = await finalizeCommand(automator, command, result.prompt);

    } else {
      
      // open waiting panel
      openWaitingPanel();

      // now prompt llm
      //console.log(`Prompting with ${result.prompt}`);
      const response = await promptLlm(app, engine, model, result.prompt);
      result.response = response.content;

      // done
      await closeWaitingPanel();
      await releaseFocus();

      // now paste
      //console.log(`Processing ${result.response}`);
      await finalizeCommand(automator, command, result.response);

    }

  } catch (error) {
    console.error('Error while testing', error);
  }

  // done waiting
  console.log('Destroying waiting panel')
  await closeWaitingPanel(true);
  releaseFocus();

  // done
  return result;

}
