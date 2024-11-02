
import { Configuration } from 'types/config'
import { Anthropic, Ollama, MistralAI, Google, Groq, XAI, Cerebras, LlmEngine , loadAnthropicModels, loadCerebrasModels, loadGoogleModels, loadGroqModels, loadMistralAIModels, loadOllamaModels, loadOpenAIModels, loadXAIModels, hasVisionModels as _hasVisionModels, isVisionModel as _isVisionModel } from 'multi-llm-ts'
import { isSpecializedModel as isSpecialAnthropicModel, getFallbackModel as getAnthropicFallbackModel , getComputerInfo } from './anthropic'
import { imageFormats, textFormats } from '../models/attachment'
import { store } from '../services/store'
import OpenAI from './openai'

export const availableEngines = [ 'openai', 'ollama', 'anthropic', 'mistralai', 'google', 'xai', 'groq', 'cerebras' ]
export const staticModelsEngines = [ 'anthropic', 'google', 'xai', 'groq', 'cerebras' ]

export default class LlmFactory {

  config: Configuration

  constructor(config: Configuration) {
    this.config = config
  }

  isSpecializedModel = (engine: string, model: string): boolean => {
    if (engine === 'anthropic') return isSpecialAnthropicModel(model)
    return false
  }
  
  getFallbackModel = (engine: string): string => {
    if (engine === 'anthropic') return getAnthropicFallbackModel()
    return null
  }
  
  getChatEngineModel = (acceptSpecializedModels: boolean = true): { engine: string, model: string } => {
    const engine = this.config.llm.engine
    const model = this.getChatModel(engine, acceptSpecializedModels)
    return { engine, model }
  }
  
  getChatModel = (engine: string, acceptSpecializedModels: boolean = true): string => {
  
    // get from config
    const model = this.config.engines[engine].model.chat
  
    // check
    if (!acceptSpecializedModels && this.isSpecializedModel(engine, model)) {  
      return this.getFallbackModel(engine)
    } else {
      return model
    }
  
  }
  
  isEngineConfigured = (engine: string): boolean => {
    if (engine === 'anthropic') return Anthropic.isConfigured(this.config.engines.anthropic)
    if (engine === 'cerebras') return Cerebras.isConfigured(this.config.engines.cerebras)
    if (engine === 'google') return Google.isConfigured(this.config.engines.google)
    if (engine === 'groq') return Groq.isConfigured(this.config.engines.groq)
    if (engine === 'mistralai') return MistralAI.isConfigured(this.config.engines.mistralai)
    if (engine === 'ollama') return Ollama.isConfigured(this.config.engines.ollama)
    if (engine === 'openai') return OpenAI.isConfigured(this.config.engines.openai)
    if (engine === 'xai') return XAI.isConfigured(this.config.engines.xai)
    return false
  }  
  
  isEngineReady = (engine: string): boolean => {
    if (engine === 'anthropic') return Anthropic.isReady(this.config.engines.anthropic)
    if (engine === 'cerebras') return Cerebras.isReady(this.config.engines.cerebras)
    if (engine === 'google') return Google.isReady(this.config.engines.google)
    if (engine === 'groq') return Groq.isReady(this.config.engines.groq)
    if (engine === 'mistralai') return MistralAI.isReady(this.config.engines.mistralai)
    if (engine === 'ollama') return Ollama.isReady(this.config.engines.ollama)
    if (engine === 'openai') return OpenAI.isReady(this.config.engines.openai)
    if (engine === 'xai') return XAI.isReady(this.config.engines.xai)
    return false
  }
  
  igniteEngine = (engine: string, fallback = 'openai'): LlmEngine => {
    if (engine === 'anthropic') return new Anthropic(this.config.engines.anthropic, getComputerInfo())
    if (engine === 'cerebras') return new Cerebras(this.config.engines.cerebras)
    if (engine === 'google') return new Google(this.config.engines.google)
    if (engine === 'groq') return new Groq(this.config.engines.groq)
    if (engine === 'mistralai') return new MistralAI(this.config.engines.mistralai)
    if (engine === 'ollama') return new Ollama(this.config.engines.ollama)
    if (engine === 'openai') return new OpenAI(this.config.engines.openai)
    if (engine === 'xai') return new XAI(this.config.engines.xai)
    if (this.isEngineReady(fallback)) {
      console.warn(`Engine ${engine} unknown. Falling back to ${fallback}`)
      return this.igniteEngine(fallback, this.config.engines[fallback])
    }
    return null
  }
  
  hasChatModels = (engine: string) => {
    return this.config.engines[engine].models.chat.length > 0
  }
  
  hasVisionModels = (engine: string) => {
    return _hasVisionModels(engine, this.config.engines[engine])
  }
  
  isVisionModel = (engine: string, model: string) => {
    return _isVisionModel(engine, model, this.config.engines[engine])
  }
  
  canProcessFormat = (engine: string, model: string, format: string) => {
    if (imageFormats.includes(format.toLowerCase())) {
      const autoSwitch = this.config.llm.autoVisionSwitch
      if (autoSwitch) {
        return this.hasVisionModels(engine) || this.isVisionModel(engine, model)
      } else {
        return this.isVisionModel(engine, model)
      }
    } else {
      return textFormats.includes(format.toLowerCase())
    }
  }
  
  initModels = async () => {
    for (const engine of staticModelsEngines) {
      if (this.isEngineConfigured(engine)) {
        await this.loadModels(engine)
      }
    }
  }
  
  loadModels = async (engine: string): Promise<boolean> => {
    
    console.log('Loading models for', engine)
    let rc = false
    if (engine === 'openai') {
      rc = await loadOpenAIModels(this.config.engines.openai)
    } else if (engine === 'ollama') {
      rc = await loadOllamaModels(this.config.engines.ollama)
    } else if (engine === 'mistralai') {
      rc = await loadMistralAIModels(this.config.engines.mistralai)
    } else if (engine === 'anthropic') {
      rc = await loadAnthropicModels(this.config.engines.anthropic, getComputerInfo())
    } else if (engine === 'google') {
      rc = await loadGoogleModels(this.config.engines.google)
    } else if (engine === 'groq') {
      rc = await loadGroqModels(this.config.engines.groq)
    } else if (engine === 'cerebras') {
      rc = await loadCerebrasModels(this.config.engines.cerebras)
    } else if (engine === 'xai') {
      rc = await loadXAIModels(this.config.engines.xai)
    }
  
    // save
    if (this.config == store.config) {
      store.saveSettings()
    }
  
    // done
    return rc
  
  }
  



}

