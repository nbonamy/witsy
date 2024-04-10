
import { store } from './store'
import OpenAI from './openai'
import Ollama from './ollama'

export const availableEngines = ['openai', 'ollama']

export const isEngineReady = (engine) => {
  return store.config?.[engine]?.models?.chat?.length > 0
}

export const getEngineChatModels = (engine) => {
  return store.config?.[engine]?.models?.chat
}

export const getValidModelId = (engine, type, modelId) => {
  let models = store.config?.[engine]?.models?.[type]
  let m = models?.find(m => m.id == modelId)
  return m ? modelId : (models?.[0]?.id || null)
}

export const loadAllModels = async () => {
  await loadModels('openai')
  await loadModels('ollama')
}

export const loadModels = async (engine) => {
  if (engine === 'openai') {
    await loadOpenAIModels()
  } else if (engine === 'ollama') {
    await loadOllamaModels()
  }
}

export const loadOpenAIModels = async () => {

  // load
  let models = null
  try {
    const openAI = new OpenAI(store.config)
    models = await openAI.getModels()
  } catch (error) {
    console.error('Error listing Ollama models:', error);
  }
  if (!models) {
    store.config.openai.models = { chat: [], image: [], }
    return false
  }

  // xform
  models = models
    .map(model => { return {
      id: model.id,
      name: model.id,
      meta: model
    }})
    .sort((a, b) => a.name.localeCompare(b.name))

  // store
  store.config.openai.models = {
    chat: models.filter(model => model.id.startsWith('gpt-')),
    image: models.filter(model => model.id.startsWith('dall-e-'))
  }

  // select valid model
  store.config.openai.model.chat = getValidModelId('openai', 'chat', store.config.openai.model.chat)
  store.config.openai.model.image = getValidModelId('openai', 'image', store.config.openai.model.image)

  // done
  return true

}

export const loadOllamaModels = async () => {

  // load
  let models = null
  try {
    const ollama = new Ollama(store.config)
    models = await ollama.getModels()
  } catch (error) {
    console.error('Error listing OpenAI models:', error);
  }
  if (!models) {
    store.config.ollama.models = { chat: [], image: [], }
    return false
  }

  // store
  store.config.ollama.models = {
    chat: models
    .map(model => { return {
      id: model.model,
      name: model.name,
      meta: model
    }})
    .sort((a, b) => a.name.localeCompare(b.name))
  }

  // select valid model
  store.config.ollama.model.chat = getValidModelId('ollama', 'chat', store.config.ollama.model.chat)

  // done
  return true

}