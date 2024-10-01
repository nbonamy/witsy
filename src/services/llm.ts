
import { anyDict } from 'types/index.d'
import { Model, EngineConfig, Configuration } from 'types/config.d'
import { imageFormats, textFormats } from '../models/attachment'
import { store } from './store'
import OpenAI, { isOpenAIReady } from './openai'
import Ollama, { isOllamaReady } from './ollama'
import MistralAI, { isMistrailAIReady } from './mistralai'
import Anthropic, { isAnthropicReady } from './anthropic'
import Google, { isGoogleReady } from './google'
import Groq, { isGroqReady } from './groq'
import Cerebreas,{ isCerebeasReady } from './cerebras'
import LlmEngine from './engine'

export const availableEngines = [ 'openai', 'ollama', 'anthropic', 'mistralai', 'google', 'groq', 'cerebras' ]
export const staticModelsEngines = [ 'anthropic', 'google', 'groq', 'cerebras' ]

export const isEngineReady = (engine: string) => {
  if (engine === 'openai') return isOpenAIReady(store.config.engines.openai)
  if (engine === 'ollama') return isOllamaReady(store.config.engines.ollama)
  if (engine === 'mistralai') return isMistrailAIReady(store.config.engines.mistralai)
  if (engine === 'anthropic') return isAnthropicReady(store.config.engines.anthropic)
  if (engine === 'google') return isGoogleReady(store.config.engines.google)
  if (engine === 'groq') return isGroqReady(store.config.engines.groq)
  if (engine === 'cerebras') return isCerebeasReady(store.config.engines.cerebras)
  return false
}

export const igniteEngine = (engine: string, config: Configuration, fallback = 'openai'): LlmEngine => {
  if (engine === 'openai') return new OpenAI(config)
  if (engine === 'ollama') return new Ollama(config)
  if (engine === 'mistralai') return new MistralAI(config)
  if (engine === 'anthropic') return new Anthropic(config)
  if (engine === 'google') return new Google(config)
  if (engine === 'groq') return new Groq(config)
  if (engine === 'cerebras') return new Cerebreas(config)
  if (isEngineReady(fallback)) {
    console.log(`Engine ${engine} unknown. Falling back to ${fallback}`)
    return igniteEngine(fallback, config)
  }
  return null
}

export const hasChatModels = (engine: string) => {
  return store.config.engines[engine].models.chat.length > 0
}

export const hasVisionModels = (engine: string) => {
  const instance = igniteEngine(engine, store.config)
  return instance.getVisionModels().length > 0
}

export const isVisionModel = (engine: string, model: string) => {
  const instance = igniteEngine(engine, store.config)
  return instance.isVisionModel(model)
}

export const canProcessFormat = (engine: string, model: string, format: string) => {
  if (imageFormats.includes(format.toLowerCase())) {
    const autoSwitch = store.config.llm.autoVisionSwitch
    if (autoSwitch) {
      return hasVisionModels(engine) || isVisionModel(engine, model)
    } else {
      return isVisionModel(engine, model)
    }
  } else {
    return textFormats.includes(format.toLowerCase())
  }
}

export const initModels = async () => {
  for (const engine of staticModelsEngines) {
    if (isEngineReady(engine)) {
      await loadModels(engine)
    }
  }
}

export const loadModels = async (engine: string) => {
  console.log('Loading models for', engine)
  if (engine === 'openai') {
    await loadOpenAIModels()
  } else if (engine === 'ollama') {
    await loadOllamaModels()
  } else if (engine === 'mistralai') {
    await loadMistralAIModels()
  } else if (engine === 'anthropic') {
    await loadAnthropicModels()
  } else if (engine === 'google') {
    await loadGoogleModels()
  } else if (engine === 'groq') {
    await loadGroqModels()
  } else if (engine === 'cerebras') {
    await loadCerebrasModels()
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
    console.error('Error listing OpenAI models:', error);
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
    chat: models.filter(model => model.id.startsWith('gpt-') || model.id.startsWith('o1-')),
    image: models.filter(model => model.id.startsWith('dall-e-'))
  }

  // select valid model
  store.config.engines.openai.model.chat = getValidModelId('openai', 'chat', store.config.engines.openai.model.chat)
  store.config.engines.openai.model.image = getValidModelId('openai', 'image', store.config.engines.openai.model.image)

  // save
  store.saveSettings()

  // done
  return true

}

export const loadOllamaModels = async () => {

  // needed
  const ollama = new Ollama(store.config)

  // load
  let models: any[] = null
  try {
    models = await ollama.getModels()
  } catch (error) {
    console.error('Error listing Ollama models:', error);
  }
  if (!models) {
    store.config.engines.ollama.models = { chat: [], image: [], }
    return false
  }

  // get info
  const modelInfo: anyDict = {}
  for (const model of models) {
    const info = await ollama.getModelInfo(model.model)
    modelInfo[model.model] = {
      ...info.details,
      ...info.model_info,
    }
  }

  // needed
  const ollamaModelMapper = (model: any) => {
    return {
      id: model.model,
      name: model.name,
      meta: model
    }
  }

  // store
  store.config.engines.ollama.models = {
    chat: models
      .filter(model => modelInfo[model.model].family.includes('bert') === false)
      .map(ollamaModelMapper)
      .sort((a, b) => a.name.localeCompare(b.name)),
    embedding: models
      .filter(model => modelInfo[model.model].family.includes('bert') === true)
      .map(ollamaModelMapper)
      .sort((a, b) => a.name.localeCompare(b.name)),
  }

  // select valid model
  store.config.engines.ollama.model.chat = getValidModelId('ollama', 'chat', store.config.engines.ollama.model.chat)

  // save
  store.saveSettings()

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
    console.error('Error listing MistralAI models:', error);
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

  // save
  store.saveSettings()

  // done
  return true

}

export const loadAnthropicModels = async () => {
  
  let models = []

  try {
    const anthropic = new Anthropic(store.config)
    models = await anthropic.getModels()
  } catch (error) {
    console.error('Error listing Anthropic models:', error);
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

  // save
  store.saveSettings()

  // done
  return true
}

export const loadGoogleModels = async () => {
  
  let models = []

  try {
    const google = new Google(store.config)
    models = await google.getModels()
  } catch (error) {
    console.error('Error listing Google models:', error);
  }
  if (!models) {
    store.config.engines.google.models = { chat: [], image: [], }
    return false
  }

  // store
  store.config.engines.google.models = {
    chat: models
    .map(model => { return {
      id: model.id,
      name: model.name,
      meta: model
    }})
    //.sort((a, b) => a.name.localeCompare(b.name))
  }

  // select valid model
  store.config.engines.google.model.chat = getValidModelId('google', 'chat', store.config.engines.google.model.chat)

  // save
  store.saveSettings()

  // done
  return true
}

export const loadGroqModels = async () => {
  
  let models = []

  try {
    const groq = new Groq(store.config)
    models = await groq.getModels()
  } catch (error) {
    console.error('Error listing Groq models:', error);
  }
  if (!models) {
    store.config.engines.groq.models = { chat: [], image: [], }
    return false
  }

  // store
  store.config.engines.groq.models = {
    chat: models
    .map(model => { return {
      id: model.id,
      name: model.name,
      meta: model
    }})
    //.sort((a, b) => a.name.localeCompare(b.name))
  }

  // select valid model
  store.config.engines.groq.model.chat = getValidModelId('groq', 'chat', store.config.engines.groq.model.chat)

  // save
  store.saveSettings()

  // done
  return true
}

export const loadCerebrasModels = async () => {
  
  let models = []

  try {
    const cerebras = new Cerebreas(store.config)
    models = await cerebras.getModels()
  } catch (error) {
    console.error('Error listing Cerebras models:', error);
  }
  if (!models) {
    store.config.engines.cerebras.models = { chat: [], image: [], }
    return false
  }

  // store
  store.config.engines.cerebras.models = {
    chat: models
    .map(model => { return {
      id: model.id,
      name: model.name,
      meta: model
    }})
    //.sort((a, b) => a.name.localeCompare(b.name))
  }

  // select valid model
  store.config.engines.cerebras.model.chat = getValidModelId('cerebras', 'chat', store.config.engines.cerebras.model.chat)

  // save
  store.saveSettings()

  // done
  return true
}
