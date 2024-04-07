
import fs from 'fs'
import path from 'path'
import { clipboard } from 'electron'
import OpenAI from '../services/openai'
import Ollama from '../services/ollama'
import Message from '../models/message'
import Automator from './automator'
import { openWaitingPanel, closeWaitingPanel, releaseFocus } from '../window'

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

const finalizeCommand = async (automator, behavior, text) => {

  if (behavior == 'new_window') {
  
  } else if (behavior == 'insert_below') {

    await automator.moveCaretBelow()
    await automator.pasteText(text)

  } else if (behavior == 'replace_selection') {

    await automator.pasteText(text)

  } else if (behavior == 'copy_cliboard') {

    await clipboard.writeText(text)

  }

}

export const runCommand = async (app, command) => {

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
    let text = await automator.getSelectedText();
    //console.log(`Grabbed [${text}]`);
    if (text.trim() === '') {
      console.log('No text selected');
      return;
    }

    // open waiting panel
    openWaitingPanel();

    // build prompt
    const prompt = template.replace('{input}', text);

    // now prompt llm
    //console.log(`Prompting with ${prompt}`);
    const response = await promptLlm(app, engine, model, prompt);

    // done
    await closeWaitingPanel();
    await releaseFocus();

    // now paste
    //console.log(`Processing ${response.content}`);
    await finalizeCommand(automator, behavior, response.content);

  } catch (error) {
    console.error('Error while testing', error);
  }

  // done
  console.log('Destroying waiting panel')
  await closeWaitingPanel(true);
  releaseFocus();

}
