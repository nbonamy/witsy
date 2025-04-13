
import { Configuration } from '../types/config'
import { getComputerInfo } from './anthropic'
import LlmManagerBase from './base'
import * as llm from 'multi-llm-ts'
import OpenAI from './openai'

export default class LlmManager extends LlmManagerBase {

  constructor(config: Configuration) {
    super(config)
  }

  getStandardEngines = (): string[] => {
    return [ 'openai', 'anthropic', 'google', 'xai', 'ollama', 'mistralai', 'deepseek', 'openrouter', 'groq', 'cerebras' ]
  }

  getPriorityEngines = (): string[] => {
    return [ 'openai', 'anthropic', 'google', 'ollama' ]
  }

  getNonChatEngines = (): string[] => {
    return [ 'huggingface', 'replicate', 'elevenlabs', 'sdwebui', 'falai', 'gladia' ]
  }

  isEngineConfigured = (engine: string): boolean => {
    if (engine === 'anthropic') return llm.Anthropic.isConfigured(this.config.engines.anthropic)
    if (engine === 'cerebras') return llm.Cerebras.isConfigured(this.config.engines.cerebras)
    if (engine === 'deepseek') return llm.DeepSeek.isConfigured(this.config.engines.deepseek)
    if (engine === 'google') return llm.Google.isConfigured(this.config.engines.google)
    if (engine === 'groq') return llm.Groq.isConfigured(this.config.engines.groq)
    if (engine === 'mistralai') return llm.MistralAI.isConfigured(this.config.engines.mistralai)
    if (engine === 'ollama') return llm.Ollama.isConfigured(this.config.engines.ollama)
    if (engine === 'openai') return OpenAI.isConfigured(this.config.engines.openai)
    if (engine === 'openrouter') return llm.OpenRouter.isConfigured(this.config.engines.openrouter)
    if (engine === 'xai') return llm.XAI.isConfigured(this.config.engines.xai)
    if (this.isFavoriteEngine(engine)) return true
    if (this.isCustomEngine(engine)) return true
    return false
  }  
  
  isEngineReady = (engine: string): boolean => {
    if (engine === 'anthropic') return llm.Anthropic.isReady(this.config.engines.anthropic, this.config.engines.anthropic?.models)
    if (engine === 'cerebras') return llm.Cerebras.isReady(this.config.engines.cerebras, this.config.engines.cerebras?.models)
    if (engine === 'deepseek') return llm.DeepSeek.isReady(this.config.engines.deepseek, this.config.engines.deepseek?.models)
    if (engine === 'google') return llm.Google.isReady(this.config.engines.google, this.config.engines.google?.models)
    if (engine === 'groq') return llm.Groq.isReady(this.config.engines.groq, this.config.engines.groq?.models)
    if (engine === 'mistralai') return llm.MistralAI.isReady(this.config.engines.mistralai, this.config.engines.mistralai?.models)
    if (engine === 'ollama') return llm.Ollama.isReady(this.config.engines.ollama, this.config.engines.ollama?.models) 
    if (engine === 'openai') return OpenAI.isReady(this.config.engines.openai, this.config.engines.openai?.models)
    if (engine === 'openrouter') return llm.OpenRouter.isReady(this.config.engines.openrouter, this.config.engines.openrouter?.models)
    if (engine === 'xai') return llm.XAI.isReady(this.config.engines.xai, this.config.engines.xai?.models)
    if (this.isFavoriteEngine(engine)) return true
    if (this.isCustomEngine(engine)) return true
    return false
  }
  
  igniteEngine = (engine: string): llm.LlmEngine => {

    try {

      // super
      if (this.isFavoriteEngine(engine)) {
        return this.igniteFavoriteEngine(engine)
      } else if (this.isCustomEngine(engine)) {
        return this.igniteCustomEngine(engine)
      }

      // select
      if (engine === 'anthropic') return new llm.Anthropic(this.config.engines.anthropic, getComputerInfo())
      if (engine === 'cerebras') return new llm.Cerebras(this.config.engines.cerebras)
      if (engine === 'deepseek') return new llm.DeepSeek(this.config.engines.deepseek)
      if (engine === 'google') return new llm.Google(this.config.engines.google)
      if (engine === 'groq') return new llm.Groq({ ...this.config.engines.groq, maxRetries: 0 })
      if (engine === 'mistralai') return new llm.MistralAI(this.config.engines.mistralai)
      if (engine === 'ollama') return new llm.Ollama(this.config.engines.ollama)
      if (engine === 'openai') return new OpenAI(this.config.engines.openai)
      if (engine === 'openrouter') return new llm.OpenRouter(this.config.engines.openrouter)
      if (engine === 'xai') return new llm.XAI(this.config.engines.xai)

    } catch { /* empty */ }

    // fallback
    console.warn(`Engine ${engine} unknown. Falling back to OpenAI`)
    return new OpenAI(this.config.engines.openai)

  }
  
  loadModels = async (engine: string): Promise<boolean> => {

    if (this.isCustomEngine(engine)) {
      return this.loadModelsCustom(engine)
    }
    
    console.log('Loading models for', engine)
    let models: llm.ModelsList|null = null
    if (engine === 'openai') {
      models = await llm.loadOpenAIModels(this.config.engines.openai)
    } else if (engine === 'ollama') {
      models = await llm.loadOllamaModels(this.config.engines.ollama)
    } else if (engine === 'mistralai') {
      models = await llm.loadMistralAIModels(this.config.engines.mistralai)
    } else if (engine === 'anthropic') {
      models = await llm.loadAnthropicModels(this.config.engines.anthropic, getComputerInfo())
    } else if (engine === 'google') {
      models = await llm.loadGoogleModels(this.config.engines.google)
    } else if (engine === 'groq') {
      models = await llm.loadGroqModels(this.config.engines.groq)
    } else if (engine === 'cerebras') {
      models = await llm.loadCerebrasModels(this.config.engines.cerebras)
    } else if (engine === 'xai') {
      models = await llm.loadXAIModels(this.config.engines.xai)
    } else if (engine === 'openrouter') {
      models = await llm.loadOpenRouterModels(this.config.engines.openrouter)
    } else if (engine === 'deepseek') {
      models = await llm.loadDeepSeekModels(this.config.engines.deepseek)
    }

    // save
    return this.saveModels(engine, models)
    
  }

}

