
import { Configuration, CustomEngineConfig, EngineConfig } from '../types/config'
import { Anthropic, Ollama, MistralAI, Google, Groq, XAI, OpenRouter, DeepSeek, Cerebras, LlmEngine, loadAnthropicModels, loadCerebrasModels, loadGoogleModels, loadGroqModels, loadMistralAIModels, loadOllamaModels, loadOpenAIModels, loadXAIModels, hasVisionModels as _hasVisionModels, isVisionModel as _isVisionModel, ModelsList, Model, loadOpenRouterModels, loadDeepSeekModels } from 'multi-llm-ts'
import { isSpecializedModel as isSpecialAnthropicModel, getFallbackModel as getAnthropicFallbackModel , getComputerInfo } from './anthropic'
import { imageFormats, textFormats } from '../models/attachment'
import { store } from '../services/store'
import OpenAI from './openai'

export const standardEngines = [ 'openai', 'anthropic', 'google', 'xai', 'ollama', 'mistralai', 'openrouter', 'deepseek', 'groq', 'cerebras' ]
export const staticModelsEngines = [ 'anthropic', 'google', 'xai', 'deepseek', 'groq', 'cerebras' ]
export const nonChatEngines = [ 'huggingface', 'replicate', 'elevenlabs' ]

export default class LlmFactory {

  config: Configuration

  constructor(config: Configuration) {
    this.config = config
  }

  getEngineName = (engine: string): string => {
    if (!this.config.engines[engine]) {
      return 'custom'
    } else if (this.isCustomEngine(engine)) {
      return (this.config.engines[engine] as CustomEngineConfig)?.label
    } else {
      return engine
    }
  }

  getChatEngines = (): string[] => {
    return [
      ...standardEngines,
      ...this.getCustomEngines()
    ]
  }

  getCustomEngines = (): string[] => {
    return Object.keys(this.config.engines).filter(e => !standardEngines.includes(e) && !nonChatEngines.includes(e))
  }

  isSpecializedModel = (engine: string, model: string): boolean => {
    if (engine === 'anthropic') return isSpecialAnthropicModel(model)
    return false
  }

  isCustomEngine = (engine: string): boolean => {
    return this.config.engines[engine] !== undefined && !standardEngines.includes(engine) && !nonChatEngines.includes(engine)
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

  getChatModels = (engine: string): Model[] => {
    return this.config.engines[engine].models.chat
  }
  
  getChatModel = (engine: string, acceptSpecializedModels: boolean = true): string => {
  
    // get from config
    const model = this.config.engines[engine]?.model?.chat
  
    // check
    if (!acceptSpecializedModels && this.isSpecializedModel(engine, model)) {  
      return this.getFallbackModel(engine)
    } else {
      return model
    }
  
  }

  setChatModel = (engine: string, model: string) => {
    this.config.engines[engine].model.chat = model
    store.saveSettings()
  }
  
  isEngineConfigured = (engine: string): boolean => {
    if (engine === 'anthropic') return Anthropic.isConfigured(this.config.engines.anthropic)
    if (engine === 'cerebras') return Cerebras.isConfigured(this.config.engines.cerebras)
    if (engine === 'deepseek') return DeepSeek.isConfigured(this.config.engines.deepseek)
    if (engine === 'google') return Google.isConfigured(this.config.engines.google)
    if (engine === 'groq') return Groq.isConfigured(this.config.engines.groq)
    if (engine === 'mistralai') return MistralAI.isConfigured(this.config.engines.mistralai)
    if (engine === 'ollama') return Ollama.isConfigured(this.config.engines.ollama)
    if (engine === 'openai') return OpenAI.isConfigured(this.config.engines.openai)
    if (engine === 'openrouter') return OpenRouter.isConfigured(this.config.engines.openrouter)
    if (engine === 'xai') return XAI.isConfigured(this.config.engines.xai)
    if (this.isCustomEngine(engine)) return true
    return false
  }  
  
  isEngineReady = (engine: string): boolean => {
    if (engine === 'anthropic') return Anthropic.isReady(this.config.engines.anthropic, this.config.engines.anthropic?.models)
    if (engine === 'cerebras') return Cerebras.isReady(this.config.engines.cerebras, this.config.engines.cerebras?.models)
    if (engine === 'deepseek') return DeepSeek.isReady(this.config.engines.deepseek, this.config.engines.deepseek?.models)
    if (engine === 'google') return Google.isReady(this.config.engines.google, this.config.engines.google?.models)
    if (engine === 'groq') return Groq.isReady(this.config.engines.groq, this.config.engines.groq?.models)
    if (engine === 'mistralai') return MistralAI.isReady(this.config.engines.mistralai, this.config.engines.mistralai?.models)
    if (engine === 'ollama') return Ollama.isReady(this.config.engines.ollama, this.config.engines.ollama?.models) 
    if (engine === 'openai') return OpenAI.isReady(this.config.engines.openai, this.config.engines.openai?.models)
    if (engine === 'openrouter') return OpenRouter.isReady(this.config.engines.openrouter, this.config.engines.openrouter?.models)
    if (engine === 'xai') return XAI.isReady(this.config.engines.xai, this.config.engines.xai?.models)
    if (this.isCustomEngine(engine)) return true
    return false
  }
  
  igniteEngine = (engine: string): LlmEngine => {
    
    // select
    if (engine === 'anthropic') return new Anthropic(this.config.engines.anthropic, getComputerInfo())
    if (engine === 'cerebras') return new Cerebras(this.config.engines.cerebras)
    if (engine === 'deepseek') return new DeepSeek(this.config.engines.deepseek)
    if (engine === 'google') return new Google(this.config.engines.google)
    if (engine === 'groq') return new Groq(this.config.engines.groq)
    if (engine === 'mistralai') return new MistralAI(this.config.engines.mistralai)
    if (engine === 'ollama') return new Ollama(this.config.engines.ollama)
    if (engine === 'openai') return new OpenAI(this.config.engines.openai)
    if (engine === 'openrouter') return new OpenRouter(this.config.engines.openrouter)
    if (engine === 'xai') return new XAI(this.config.engines.xai)

      // custom
    if (this.isCustomEngine(engine)) {
      const engineConfig = this.config.engines[engine] as CustomEngineConfig
      if (engineConfig.api === 'openai') {
        return new OpenAI({
          apiKey: engineConfig.apiKey,
          baseURL: engineConfig.baseURL
        })
      }
    }

    // fallback
    console.warn(`Engine ${engine} unknown. Falling back to OpenAI`)
    return new OpenAI(this.config.engines.openai)

  }
  
  hasChatModels = (engine: string) => {
    return this.config.engines[engine].models?.chat?.length > 0
  }
  
  hasVisionModels = (engine: string) => {
    if (this.isCustomEngine(engine)) return false
    return _hasVisionModels(engine, this.config.engines[engine])
  }
  
  isVisionModel = (engine: string, model: string) => {
    if (this.isCustomEngine(engine)) return false
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

    if (this.isCustomEngine(engine)) {
      return this.loadModelsCustom(engine)
    }
    
    console.log('Loading models for', engine)
    let models: ModelsList|null = null
    if (engine === 'openai') {
      models = await loadOpenAIModels(this.config.engines.openai)
    } else if (engine === 'ollama') {
      models = await loadOllamaModels(this.config.engines.ollama)
    } else if (engine === 'mistralai') {
      models = await loadMistralAIModels(this.config.engines.mistralai)
    } else if (engine === 'anthropic') {
      models = await loadAnthropicModels(this.config.engines.anthropic, getComputerInfo())
    } else if (engine === 'google') {
      models = await loadGoogleModels(this.config.engines.google)
    } else if (engine === 'groq') {
      models = await loadGroqModels(this.config.engines.groq)
    } else if (engine === 'cerebras') {
      models = await loadCerebrasModels(this.config.engines.cerebras)
    } else if (engine === 'xai') {
      models = await loadXAIModels(this.config.engines.xai)
    } else if (engine === 'openrouter') {
      models = await loadOpenRouterModels(this.config.engines.openrouter)
    } else if (engine === 'deepseek') {
      models = await loadDeepSeekModels(this.config.engines.deepseek)
    }

    // needed
    const engineConfig = store.config.engines[engine]

    // check
    if (typeof models !== 'object') {
      engineConfig.models = { chat: [], image: [] }
      return false
    }

    // openai names are not great
    if (engine === 'openai') {
      models.chat = models.chat.map(m => {
        let name = m.name
        name = name.replace(/^gpt-([^-]*)(-?)([a-z]?)/i, (_, l1, __, l3) => `GPT-${l1} ${l3?.toUpperCase()}`)
        name = name.replace('Mini', 'mini')
        return { id: m.id, name, meta: m.meta }
      })
      models.image = models.image.map(m => {
        let name = m.name
        name = name.replace(/^dall-e-/i, 'DALL-E ')
        return { id: m.id, name, meta: m.meta }
      })
    }

    // save in store
    engineConfig.models = models
    engineConfig.model = {
      chat: this.getValidModelId(engineConfig, 'chat', engineConfig.model?.chat),
      image: this.getValidModelId(engineConfig, 'image', engineConfig.model?.image)
    }
    
    // save
    if (this.config == store.config) {
      store.saveSettings()
    }

    // done
    return true
  
  }

  loadModelsCustom = async (engine: string): Promise<boolean> => {

    const engineConfig = store.config.engines[engine] as CustomEngineConfig
    console.log('Loading models for', engineConfig.label)
    let models: ModelsList|null = null

    // depends on base api
    if (engineConfig.api === 'openai') {
      const openaiConfig = {
        apiKey: engineConfig.apiKey,
        baseURL: engineConfig.baseURL,
        models: engineConfig.models
      }
      models = await loadOpenAIModels(openaiConfig)
    }

    // check
    if (typeof models !== 'object') {
      engineConfig.models = { chat: [], image: [] }
      return false
    }

    // save in store
    engineConfig.models = models
    engineConfig.model = {
      chat: this.getValidModelId(engineConfig, 'chat', engineConfig.model?.chat),
      image: this.getValidModelId(engineConfig, 'image', engineConfig.model?.image)
    }
    
    // save
    if (this.config == store.config) {
      store.saveSettings()
    }

    // done
    return true
  
  }
  
  getValidModelId = (engineConfig: EngineConfig, type: string, modelId: string) => {
    const models: Model[] = engineConfig?.models?.[type as keyof typeof engineConfig.models]
    const m = models?.find(m => m.id == modelId)
    return m ? modelId : (models?.[0]?.id || null)
  }

}

