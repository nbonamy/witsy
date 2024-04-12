
import { Model, EngineConfig } from '../config.d'
import { store } from './store'
import OpenAI from './openai'
import Ollama from './ollama'
import MistralAI from './mistralai'

export const availableEngines = ['openai', 'ollama']//, 'mistralai']

export const isEngineReady = (engine: string) => {
  const engineConfig: EngineConfig = store.config.engines[engine as keyof typeof store.config.engines]
  return engineConfig?.models?.chat?.length > 0
}

export const getEngineChatModels = (engine: string) => {
  const engineConfig: EngineConfig = store.config.engines[engine as keyof typeof store.config.engines]
  return engineConfig?.models?.chat
}

export const getValidModelId = (engine: string, type: string, modelId: string) => {
  const engineConfig: EngineConfig = store.config.engines[engine as keyof typeof store.config.engines]
  const models: Model[] = engineConfig?.models?.[type as keyof typeof engineConfig.models]
  const m = models?.find(m => m.id == modelId)
  return m ? modelId : (models?.[0]?.id || null)
}

export const loadAllModels = async () => {
  await loadModels('openai')
  await loadModels('ollama')
  await loadModels('mistralai')
}

export const loadModels = async (engine: string) => {
  if (engine === 'openai') {
    await loadOpenAIModels()
  } else if (engine === 'ollama') {
    await loadOllamaModels()
  } else if (engine === 'mistralai') {
    await loadMistralAIModels()
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
    store.config.engines.openai.models = { chat: [], image: [], }
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
  store.config.engines.openai.models = {
    chat: models.filter(model => model.id.startsWith('gpt-')),
    image: models.filter(model => model.id.startsWith('dall-e-'))
  }

  // select valid model
  store.config.engines.openai.model.chat = getValidModelId('openai', 'chat', store.config.engines.openai.model.chat)
  store.config.engines.openai.model.image = getValidModelId('openai', 'image', store.config.engines.openai.model.image)

  // done
  return true

}

export const loadOllamaModels = async () => {

  // load
  let models: any[] = null
  try {
    const ollama = new Ollama(store.config)
    models = await ollama.getModels()
  } catch (error) {
    console.error('Error listing OpenAI models:', error);
  }
  if (!models) {
    store.config.engines.ollama.models = { chat: [], image: [], }
    return false
  }

  // store
  store.config.engines.ollama.models = {
    chat: models
    .map(model => { return {
      id: model.model,
      name: model.name,
      meta: model
    }})
    .sort((a, b) => a.name.localeCompare(b.name))
  }

  // select valid model
  store.config.engines.ollama.model.chat = getValidModelId('ollama', 'chat', store.config.engines.ollama.model.chat)

  // done
  return true

}

export const loadMistralAIModels = async () => {

  // load
  let models: any[] = null
  try {
    const mistralai = new MistralAI(store.config)
    models = await mistralai.getModels()
  } catch (error) {
    console.error('Error listing OpenAI models:', error);
  }
  if (!models) {
    store.config.engines.mistralai.models = { chat: [], image: [], }
    return false
  }

  console.log(models)

  // store
  store.config.engines.mistralai.models = {
    chat: models
    .map(model => { return {
      id: model.model,
      name: model.name,
      meta: model
    }})
    .sort((a, b) => a.name.localeCompare(b.name))
  }

  // select valid model
  store.config.engines.mistralai.model.chat = getValidModelId('mistralai', 'chat', store.config.engines.mistralai.model.chat)

  // done
  return true

}
