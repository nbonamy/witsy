
import { Configuration, EngineConfig } from 'types/config.d'
import { Anthropic, Ollama, MistralAI, Google, Groq, XAI, Cerebras, LlmEngine, loadAnthropicModels, loadCerebrasModels, loadGoogleModels, loadGroqModels, loadMistralAIModels, loadOllamaModels, loadOpenAIModels, loadXAIModels, hasVisionModels as _hasVisionModels, isVisionModel as _isVisionModel, ModelsList, Model } from 'multi-llm-ts'
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
    if (engine === 'anthropic') return Anthropic.isReady(this.config.engines.anthropic, this.config.engines.anthropic?.models)
    if (engine === 'cerebras') return Cerebras.isReady(this.config.engines.cerebras, this.config.engines.cerebras?.models)
    if (engine === 'google') return Google.isReady(this.config.engines.google, this.config.engines.google?.models)
    if (engine === 'groq') return Groq.isReady(this.config.engines.groq, this.config.engines.groq?.models)
    if (engine === 'mistralai') return MistralAI.isReady(this.config.engines.mistralai, this.config.engines.mistralai?.models)
    if (engine === 'ollama') return Ollama.isReady(this.config.engines.ollama, this.config.engines.ollama?.models) 
    if (engine === 'openai') return OpenAI.isReady(this.config.engines.openai, this.config.engines.openai?.models)
    if (engine === 'xai') return XAI.isReady(this.config.engines.xai, this.config.engines.xai?.models)
    return false
  }
  
  igniteEngine = (engine: string): LlmEngine => {
    
    // select
    if (engine === 'anthropic') return new Anthropic(this.config.engines.anthropic, getComputerInfo())
    if (engine === 'cerebras') return new Cerebras(this.config.engines.cerebras)
    if (engine === 'google') return new Google(this.config.engines.google)
    if (engine === 'groq') return new Groq(this.config.engines.groq)
    if (engine === 'mistralai') return new MistralAI(this.config.engines.mistralai)
    if (engine === 'ollama') return new Ollama(this.config.engines.ollama)
    if (engine === 'openai') return new OpenAI(this.config.engines.openai)
    if (engine === 'xai') return new XAI(this.config.engines.xai)

    // fallback
    console.warn(`Engine ${engine} unknown. Falling back to OpenAI`)
    return new OpenAI(this.config.engines.openai)

  }
  
  hasChatModels = (engine: string) => {
    return this.config.engines[engine].models?.chat?.length > 0
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
      return [...textFormats, 'csv'].includes(format.toLowerCase())
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

    // local function
    const getValidModelId = (engineConfig: EngineConfig, type: string, modelId: string) => {
      const models: Model[] = engineConfig?.models?.[type as keyof typeof engineConfig.models]
      const m = models?.find(m => m.id == modelId)
      return m ? modelId : (models?.[0]?.id || null)
    }
    
    // save in store
    engineConfig.models = models
    engineConfig.model = {
      chat: getValidModelId(engineConfig, 'chat', engineConfig.model?.chat),
      image: getValidModelId(engineConfig, 'image', engineConfig.model?.image)
    }
    
    // save
    if (this.config == store.config) {
      store.saveSettings()
    }

    // done
    return true
  
  }
  



}

