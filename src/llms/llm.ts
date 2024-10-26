
import { Anthropic, Ollama, MistralAI, Google, Groq, XAI, Cerebras, LlmEngine , loadAnthropicModels, loadCerebrasModels, loadGoogleModels, loadGroqModels, loadMistralAIModels, loadOllamaModels, loadOpenAIModels, loadXAIModels, hasVisionModels as _hasVisionModels, isVisionModel as _isVisionModel } from 'multi-llm-ts'
import { imageFormats, textFormats } from '../models/attachment'
import { store } from '../services/store'
import { getComputerInfo } from './anthropic'
import OpenAI from './openai'

export const availableEngines = [ 'openai', 'ollama', 'anthropic', 'mistralai', 'google', 'xai', 'groq', 'cerebras' ]
export const staticModelsEngines = [ 'anthropic', 'google', 'xai', 'groq', 'cerebras' ]

export const isEngineConfigured = (engine: string) => {
  if (engine === 'anthropic') return Anthropic.isConfigured(store.config.engines.anthropic)
  if (engine === 'cerebras') return Cerebras.isConfigured(store.config.engines.cerebras)
  if (engine === 'google') return Google.isConfigured(store.config.engines.google)
  if (engine === 'groq') return Groq.isConfigured(store.config.engines.groq)
  if (engine === 'mistralai') return MistralAI.isConfigured(store.config.engines.mistralai)
  if (engine === 'ollama') return Ollama.isConfigured(store.config.engines.ollama)
  if (engine === 'openai') return OpenAI.isConfigured(store.config.engines.openai)
  if (engine === 'xai') return XAI.isConfigured(store.config.engines.xai)
  return false
}  

export const isEngineReady = (engine: string) => {
  if (engine === 'anthropic') return Anthropic.isReady(store.config.engines.anthropic)
  if (engine === 'cerebras') return Cerebras.isReady(store.config.engines.cerebras)
  if (engine === 'google') return Google.isReady(store.config.engines.google)
  if (engine === 'groq') return Groq.isReady(store.config.engines.groq)
  if (engine === 'mistralai') return MistralAI.isReady(store.config.engines.mistralai)
  if (engine === 'ollama') return Ollama.isReady(store.config.engines.ollama)
  if (engine === 'openai') return OpenAI.isReady(store.config.engines.openai)
  if (engine === 'xai') return XAI.isReady(store.config.engines.xai)
  return false
}

export const igniteEngine = (engine: string, fallback = 'openai'): LlmEngine => {
  if (engine === 'anthropic') return new Anthropic(store.config.engines.anthropic, getComputerInfo())
  if (engine === 'cerebras') return new Cerebras(store.config.engines.cerebras)
  if (engine === 'google') return new Google(store.config.engines.google)
  if (engine === 'groq') return new Groq(store.config.engines.groq)
  if (engine === 'mistralai') return new MistralAI(store.config.engines.mistralai)
  if (engine === 'ollama') return new Ollama(store.config.engines.ollama)
  if (engine === 'openai') return new OpenAI(store.config.engines.openai)
  if (engine === 'xai') return new XAI(store.config.engines.xai)
  if (isEngineReady(fallback)) {
    console.log(`Engine ${engine} unknown. Falling back to ${fallback}`)
    return igniteEngine(fallback, store.config.engines[fallback])
  }
  return null
}

export const hasChatModels = (engine: string) => {
  return store.config.engines[engine].models.chat.length > 0
}

export const hasVisionModels = (engine: string) => {
  return _hasVisionModels(engine, store.config.engines[engine])
}

export const isVisionModel = (engine: string, model: string) => {
  return _isVisionModel(engine, model, store.config.engines[engine])
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
    if (isEngineConfigured(engine)) {
      await loadModels(engine)
    }
  }
}

export const loadModels = async (engine: string): Promise<boolean> => {
  
  console.log('Loading models for', engine)
  let rc = false
  if (engine === 'openai') {
    rc = await loadOpenAIModels(store.config.engines.openai)
    console.log('OpenAI models loaded', rc)
  } else if (engine === 'ollama') {
    rc = await loadOllamaModels(store.config.engines.ollama)
  } else if (engine === 'mistralai') {
    rc = await loadMistralAIModels(store.config.engines.mistralai)
  } else if (engine === 'anthropic') {
    rc = await loadAnthropicModels(store.config.engines.anthropic, getComputerInfo())
  } else if (engine === 'google') {
    rc = await loadGoogleModels(store.config.engines.google)
  } else if (engine === 'groq') {
    rc = await loadGroqModels(store.config.engines.groq)
  } else if (engine === 'cerebras') {
    rc = await loadCerebrasModels(store.config.engines.cerebras)
  } else if (engine === 'xai') {
    rc = await loadXAIModels(store.config.engines.xai)
  }

  // save
  store.saveSettings()

  // done
  return rc

}
