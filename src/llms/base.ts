
import { Configuration, CustomEngineConfig, EngineConfig } from '../types/config'
import { GetChatEnginesOpts, ILlmManager, ToolSelection } from '../types/llm'
import { isSpecializedModel as isSpecialAnthropicModel, getFallbackModel as getAnthropicFallbackModel } from './anthropic'
import { areAllToolsEnabled, areToolsDisabled, favoriteMockEngine } from './llm'
import { imageFormats, textFormats } from '../models/attachment'
import { PluginInstance, PluginsList } from 'plugins/plugins'
import { store } from '../services/store'
import * as llm from 'multi-llm-ts'
import OpenAI from './openai'

export default class LlmManagerBase implements ILlmManager {

  config: Configuration

  constructor(config: Configuration) {
    this.config = config
  }

  getStandardEngines = (): string[] => {
    throw new Error('getStandardEngines not implemented')
  }

  getPriorityEngines(): string[] {
    throw new Error('getPriorityEngines not implemented')
  }

  getNonChatEngines = (): string[] => {
    throw new Error('getNonChatEngines not implemented')
  }

  getChatEngines = (opts?: GetChatEnginesOpts): string[] => {
    opts = { favorites: true, ...opts }
    return [
      ...(opts.favorites && this.config.llm.favorites.length ? [favoriteMockEngine] : []),
      ...this.getStandardEngines(),
      ...this.getCustomEngines()
    ]
  }

  getEngineName = (engine: string): string => {
    if (this.isFavoriteEngine(engine)) {
      return 'favorite'
    } else if (!this.config.engines[engine]) {
      return 'custom'
    } else if (this.isCustomEngine(engine)) {
      return (this.config.engines[engine] as CustomEngineConfig)?.label
    } else {
      return engine
    }
  }

  getCustomEngines = (): string[] => {
    return Object.keys(this.config.engines).filter(e => this.isCustomEngine(e))
  }

  isCustomEngine = (engine: string): boolean => {
    return this.config.engines[engine] !== undefined && engine != favoriteMockEngine && !this.getStandardEngines().includes(engine) && !this.getNonChatEngines().includes(engine)
  }
  
  isSpecializedModel = (engine: string, model: string): boolean => {
    if (engine === 'anthropic') return isSpecialAnthropicModel(model)
    return false
  }

  isFavoriteEngine = (engine: string): boolean => {
    return engine === favoriteMockEngine
  }

  getFavoriteId = (engine: string, model: string): string => {
    return `${engine}-${model}`
  }

  isFavoriteId = (id: string): boolean => {
    return this.config.llm.favorites.some(f => f.id === id)
  }

  isFavoriteModel = (engine: string, model: string): boolean => {
    return this.isFavoriteEngine(engine) || this.isFavoriteId(this.getFavoriteId(engine, model))
  }

  getFavoriteModel = (id: string): { engine: string, model: string }|null => {
    const favorite = this.config.llm.favorites.find(f => f.id === id)
    return favorite ? { engine: favorite.engine, model: favorite.model } : null
  }

  addFavoriteModel = (engine: string, model: string) => {
    const id = this.getFavoriteId(engine, model)
    this.config.llm.favorites.push({
      id: id,
      engine: engine,
      model: model,
    })
    store.saveSettings()
  }

  isComputerUseModel = (engine: string, model: string): boolean => {
    return (engine === 'anthropic' && model === 'computer-use')
  }

  removeFavoriteModel = (engine: string, model: string) => {

    // 1st remove
    let id = model
    if (!this.isFavoriteId(id)) {
      id = this.getFavoriteId(engine, model)
    }
    const favorite = this.config.llm.favorites.find(f => f.id === id)
    this.config.llm.favorites = this.config.llm.favorites.filter(f => f.id !== id)

    // if this is the current model then switch
    if (this.config.llm.engine === favoriteMockEngine) {
      if (favorite) {
        this.setChatModel(favorite.engine, favorite.model)
      } else if (!this.config.llm.favorites.length) {
        this.config.llm.engine = 'openai'
      }
    }
    store.saveSettings()
  }

  getFallbackModel = (engine: string): string => {
    if (engine === 'anthropic') return getAnthropicFallbackModel()
    return null
  }
  
  getChatEngineModel = (acceptSpecializedModels: boolean = true): { engine: string, model: string } => {
    const engine = this.config.llm.engine
    const model = this.getChatModel(engine, acceptSpecializedModels)
    if (!this.isFavoriteEngine(engine)) {
      return { engine, model }
    } else {
      const favorite = this.config.llm.favorites.find(f => f.id === model)
      return favorite ? { engine: favorite.engine, model: favorite.model } : { engine, model }
    }
  }

  getChatModels = (engine: string): llm.Model[] => {
    if (this.isFavoriteEngine(engine)) {
      return this.config.llm.favorites.map(f => ({ id: f.id, name: `${this.getEngineName(f.engine)}/${f.model}`, meta: {} })).sort((a, b) => a.name.localeCompare(b.name))
    } else {
      return this.config.engines[engine]?.models.chat || []
    }
  }
  
  getChatModel = (engine: string, acceptSpecializedModels: boolean = true): string => {
  
    // get from config
    const model = this.config.engines[engine]?.model?.chat
  
    // check specialized
    if (!acceptSpecializedModels && this.isSpecializedModel(engine, model)) {  
      return this.getFallbackModel(engine)
    }

    // check valid
    if (this.isFavoriteEngine(engine)) {
      const favorite = this.config.llm.favorites.find(f => f.id === model)
      return favorite ? model : this.config.llm.favorites.length ? this.config.llm.favorites[0]?.id : ''
    }

    // default
    return model
  
  }

  setChatModel = (engine: string, model: string) => {
    console.log('Setting chat model', engine, model)
    this.config.llm.engine = engine
    this.config.engines[engine].model.chat = model
    store.saveSettings()
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  isEngineConfigured = (engine: string): boolean => {
    throw new Error('isEngineConfigured not implemented')
  }  
  
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  isEngineReady = (engine: string): boolean => {
    throw new Error('isEngineReady not implemented')
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  igniteEngine(engine: string): llm.LlmEngine {
    throw new Error('igniteEngine not implemented')
  }
  
  igniteFavoriteEngine = (engine: string): llm.LlmEngine => {
    
    const modelId = this.config.engines[favoriteMockEngine].model.chat
    const favorite = this.config.llm.favorites.find(f => f.id === modelId)
    if (favorite) {
      return this.igniteEngine(favorite.engine)
    }
    
    // error
    throw new Error(`Cannot ignite favorite engine ${engine}`)

  }

  igniteCustomEngine = (engine: string): llm.LlmEngine => {
    
    const engineConfig = this.config.engines[engine] as CustomEngineConfig
    if (engineConfig.api === 'openai') {
      const engine: OpenAI = new OpenAI({
        apiKey: engineConfig.apiKey,
        baseURL: engineConfig.baseURL
      })
      engine.getName = () => engineConfig.label
      return engine
    } else if (engineConfig.api === 'azure') {
      const engine: llm.Azure = new llm.Azure({
        baseURL: engineConfig.baseURL,
        apiKey: engineConfig.apiKey,
        deployment: engineConfig.deployment,
        apiVersion: engineConfig.apiVersion,
      })
      engine.getName = () => engineConfig.label
      return engine
    }

    // error
    throw new Error(`Cannot ignite custom engine ${engine}`)

  }
  
  hasChatModels = (engine: string) => {
    if (this.isFavoriteEngine(engine)) return this.config.llm.favorites.length > 0
    else return this.config.engines[engine].models?.chat?.length > 0
  }
  
  hasVisionModels = (engine: string) => {
    if (this.isCustomEngine(engine)) return false
    if (this.isFavoriteEngine(engine)) throw new Error('This should not be called for favorite engines')
    return llm.hasVisionModels(engine, this.config.engines[engine])
  }
  
  isVisionModel = (engine: string, model: string) => {
    if (this.isCustomEngine(engine)) return false
    if (this.isFavoriteEngine(engine)) throw new Error('This should not be called for favorite engines')
    return llm.isVisionModel(engine, model, this.config.engines[engine])
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
    for (const engine of llm.staticModelsListEngines) {
      if (this.isEngineConfigured(engine)) {
        await this.loadModels(engine)
      }
    }
  }
  
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  loadModels = async (engine: string): Promise<boolean> => {
    throw new Error('loadModels not implemented')
  }

  loadModelsCustom = async (engine: string): Promise<boolean> => {

    const engineConfig = store.config.engines[engine] as CustomEngineConfig
    console.log('Loading models for', engineConfig.label)
    let models: llm.ModelsList|null = null

    // depends on base api
    if (engineConfig.api === 'openai') {
      const openaiConfig = {
        apiKey: engineConfig.apiKey,
        baseURL: engineConfig.baseURL,
        models: engineConfig.models
      }
      models = await llm.loadOpenAIModels(openaiConfig)
    } else if (engineConfig.api === 'azure') {
      const azureConfig = {
        baseURL: engineConfig.baseURL,
        apiKey: engineConfig.apiKey,
        deployment: engineConfig.deployment,
        apiVersion: engineConfig.apiVersion,
      }
      models = await llm.loadAzureModels(azureConfig)
    }

    // save
    return this.saveModels(engine, models)
  
  }

  saveModels = (engine: string, models: llm.ModelsList): boolean => {

    // error?
    if (!models) {
      return false
    }

    // needed
    const engineConfig = store.config.engines[engine]
    const initialConfig = JSON.stringify(engineConfig)

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
        name = name.replace(/^chatgpt-([^-]*)(-?)([a-z]?)/i, (_, l1, __, l3) => `ChatGPT-${l1} ${l3?.toUpperCase()}`)
        name = name.replace('Mini', 'mini')
        name = name.replace(/-(\d\d\d\d)$/i, (_ ,l1) => ` ${l1}`)
        name = name.replace(/-(\d\d\d\d-\d\d-\d\d)$/i, (_ ,l1) => ` ${l1}`)
        return { id: m.id, name, meta: m.meta }
      })
      models.image = models.image.map(m => {
        let name = m.name
        name = name.replace(/^dall-e-/i, 'DALL-E ')
        return { id: m.id, name, meta: m.meta }
      })
    }

    // save in store
    engineConfig.models = {
      chat: [],
      image: [],
      ...models
    }
    engineConfig.model = {
      chat: this.getValidModelId(engineConfig, 'chat', engineConfig.model?.chat) || '',
      image: this.getValidModelId(engineConfig, 'image', engineConfig.model?.image) || '',
    }
    
    // save only if modified
    const updatedConfig = JSON.stringify(engineConfig)
    if (this.config == store.config && updatedConfig !== initialConfig) {
      store.saveSettings()
    }

    // done
    return true
  
  }  
  
  getValidModelId = (engineConfig: EngineConfig, type: string, modelId: string) => {
    const models: llm.Model[] = engineConfig?.models?.[type as keyof typeof engineConfig.models]
    const m = models?.find(m => m.id == modelId)
    return m ? modelId : (models?.[0]?.id || null)
  }

  loadTools = async (engine: llm.LlmEngine, availablePlugins: PluginsList, toolSelection: ToolSelection): Promise<void> => {

    // clear
    engine.clearPlugins()

    // tools disabled?
    if (areToolsDisabled(toolSelection)) {
      return
    }

    // add plugins
    const customPluginsAdded: Record<string, PluginInstance> = {}
    for (const pluginName in availablePlugins) {
      
      const pluginClass = availablePlugins[pluginName]
      const plugin: PluginInstance = new pluginClass(this.config.plugins[pluginName])

      // if no filters add
      if (areAllToolsEnabled(toolSelection)) {
        engine.addPlugin(plugin)
        continue
      }

      // single-tool plugins is easy
      if (!('getTools' in plugin)) {
        if (toolSelection.includes(plugin.getName())) {
          engine.addPlugin(plugin)
        }
        continue
      }

      // multi-tool plugins are more complex
      const pluginTools = await plugin.getTools()
      for (const pluginTool of pluginTools) {
        if (toolSelection.includes(pluginTool.function.name)) {

          let instance: PluginInstance = customPluginsAdded[pluginName]
          if (!instance) {
            instance = plugin
            engine.addPlugin(instance)
            customPluginsAdded[pluginName] = instance
          }

          // multi-tool: enable this tool
          if (instance instanceof llm.MultiToolPlugin) {
            instance.enableTool(pluginTool.function.name)
          }
        }

      }

    }

  }

}
