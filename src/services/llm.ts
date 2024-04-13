
import { Model, EngineConfig } from '../config.d'
import { store } from './store'
import OpenAI, { isOpenAIReady } from './openai'
import Ollama, { isOllamaReady } from './ollama'
import MistralAI, { isMistrailAIReady } from './mistralai'
import Anthropic, { isAnthropicReady } from './anthropic'

export const availableEngines = ['openai', 'ollama', 'anthropic', 'mistralai']

export const isEngineReady = (engine: string) => {
  if (engine === 'openai') return isOpenAIReady(store.config.engines.openai)
  if (engine === 'ollama') return isOllamaReady(store.config.engines.ollama)
  if (engine === 'mistralai') return isMistrailAIReady(store.config.engines.mistralai)
  if (engine === 'anthropic') return isAnthropicReady(store.config.engines.anthropic)
  return false
}

export const loadAllModels = async () => {
  await loadModels('openai')
  await loadModels('ollama')
  await loadModels('mistralai')
  await loadModels('anthropic')
}

export const loadModels = async (engine: string) => {
  if (engine === 'openai') {
    await loadOpenAIModels()
  } else if (engine === 'ollama') {
    await loadOllamaModels()
  } else if (engine === 'mistralai') {
    await loadMistralAIModels()
  } else if (engine === 'anthropic') {
    await loadAnthropicModels()
  }
}

const getValidModelId = (engine: string, type: string, modelId: string) => {
  const engineConfig: EngineConfig = store.config.engines[engine as keyof typeof store.config.engines]
  const models: Model[] = engineConfig?.models?.[type as keyof typeof engineConfig.models]
  const m = models?.find(m => m.id == modelId)
  return m ? modelId : (models?.[0]?.id || null)
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

  // store
  store.config.engines.mistralai.models = {
    chat: models
    .map(model => { return {
      id: model.id,
      name: model.id,
      meta: model
    }})
    .sort((a, b) => a.name.localeCompare(b.name))
  }

  // select valid model
  store.config.engines.mistralai.model.chat = getValidModelId('mistralai', 'chat', store.config.engines.mistralai.model.chat)

  // done
  return true

}

export const loadAnthropicModels = async () => {
  
  let models = []

  try {
    const anthropic = new Anthropic(store.config)
    models = await anthropic.getModels()
  } catch (error) {
    console.error('Error listing OpenAI models:', error);
  }
  if (!models) {
    store.config.engines.anthropic.models = { chat: [], image: [], }
    return false
  }

  // store
  store.config.engines.anthropic.models = {
    chat: models
    .map(model => { return {
      id: model.id,
      name: model.name,
      meta: model
    }})
    .sort((a, b) => a.name.localeCompare(b.name))
  }

  // select valid model
  store.config.engines.anthropic.model.chat = getValidModelId('anthropic', 'chat', store.config.engines.anthropic.model.chat)

  // done
  return true
}