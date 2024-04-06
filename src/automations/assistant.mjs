
import fs from 'fs'
import path from 'path'
import OpenAI from '../services/openai'
import Ollama from '../services/ollama'
import Message from '../models/message'

const loadConfig = (app) => {
  const userDataPath = app.getPath('userData')
  const settingsFilePath = path.join(userDataPath, 'settings.json')
  const settingsContents = fs.readFileSync(settingsFilePath, 'utf-8')
  return JSON.parse(settingsContents)
}

const buildLLm = (app) => {

  // config
  const config = loadConfig(app)

  // build llm
  if (config.llm.engine === 'ollama') {
    return new Ollama(config)
  } else if (config.openai.apiKey) {
    return new OpenAI(config)
  } else {
    return null
  }

}

const promptLlm = (app, system, user) => {

  // get llm
  const llm = buildLLm(app)

  // build messages
  let messages = [
    new Message('system', system),
    new Message('user', user)
  ]

  // now get it
  return llm.complete(messages)

}

export default promptLlm

