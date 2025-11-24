
import * as llm from 'multi-llm-ts'
import { CodeExecutionMode, Configuration, CustomEngineConfig, EngineConfig } from 'types/config'
import { GetChatEnginesOpts, ILlmManager, ToolSelection } from 'types/llm'
import defaults from '@root/defaults/settings.json'
import { imageFormats, textFormats } from '@models/attachment'
import { PluginInstance, PluginsList } from '../plugins/plugins'
import { store } from '../store'
import { getFallbackModel as getAnthropicFallbackModel, isSpecializedModel as isSpecialAnthropicModel } from './anthropic'
import { favoriteMockEngine } from './consts'
import { areAllToolsEnabled, areToolsDisabled } from './llm'

export { engineNames } from './consts'

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
    
    let engine = this.config.llm.engine
    let model = this.getDefaultChatModel(engine, acceptSpecializedModels)

    // check it is a valid model for this workspace
    const workspaceModels = store.workspace?.models || []
    if (workspaceModels.length) {
      const workspaceModel = workspaceModels.find(m => m.engine === engine && m.model === model) 
      if (!workspaceModel) {
        const workspaceEngineModels = workspaceModels.filter(m => m.engine === engine)
        if (workspaceEngineModels.length) {
          model = workspaceEngineModels[0].model
          this.setChatModel(engine, model)
        } else {
          const firstModel = workspaceModels[0]
          engine = firstModel.engine
          model = firstModel.model
          this.setChatModel(engine, model)
        }
      }
    }

    if (!this.isFavoriteEngine(engine)) {
      return { engine, model }
    } else {
      const favorite = this.config.llm.favorites.find(f => f.id === model)
      return favorite ? { engine: favorite.engine, model: favorite.model } : { engine, model }
    }
  }

  getChatModels = (engine: string): llm.ChatModel[] => {
    if (this.isFavoriteEngine(engine)) {
      return this.config.llm.favorites.map(f => {
        const model = this.getChatModel(f.engine, f.model)
        return {
          id: f.id,
          name: `${this.getEngineName(f.engine)}/${f.model}`,
          capabilities: model?.capabilities ?? llm.defaultCapabilities.capabilities,
          meta: model?.meta ?? { id: f.model, name: f.model },
        }
      }).sort((a, b) => a.name.localeCompare(b.name))
    } else {
      return this.config.engines[engine]?.models?.chat || []
    }
  }

  getChatModel = (engine: string, model: string): llm.ChatModel => {
    if (this.isFavoriteEngine(engine)) {
      const favorite = this.config.llm.favorites.find(f => f.id === model)
      return this.getChatModel(favorite.engine, favorite.model)
    } else {
      const models = this.getChatModels(engine)
      return models.find(m => m.id === model) || null
    }
  }
  
  getDefaultChatModel = (engine: string, acceptSpecializedModels: boolean = true): string => {
  
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

  setChatModel = (engine: string, model: string): void => {
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

  igniteCustomEngine = (engineId: string): llm.LlmEngine => {
    
    const engineConfig = this.config.engines[engineId] as CustomEngineConfig
    if (engineConfig.api === 'openai') {
      const engine: llm.OpenAI = new llm.OpenAI({ 
        apiKey: engineConfig.apiKey,
        baseURL: engineConfig.baseURL
      })
      engine.getId = () => engineId
      engine.getName = () => engineConfig.label
      return engine
    } else if (engineConfig.api === 'azure') {
      const engine: llm.Azure = new llm.Azure({
        baseURL: engineConfig.baseURL,
        apiKey: engineConfig.apiKey,
        deployment: engineConfig.deployment,
        apiVersion: engineConfig.apiVersion,
      })
      engine.getId = () => engineId
      engine.getName = () => engineConfig.label
      return engine
    }

    // error
    throw new Error(`Cannot ignite custom engine ${engineId}`)

  }
  
  hasChatModels = (engine: string): boolean => {
    if (this.isFavoriteEngine(engine)) return this.config.llm.favorites.length > 0
    else return this.config.engines[engine].models?.chat?.length > 0
  }
  
  canProcessFormat = (engine: string, model: string, format: string) => {
    if (imageFormats.includes(format.toLowerCase())) {
      const m = this.getChatModel(engine, model)
      if (m.capabilities.vision) return true
      return !!this.config.engines[engine].model?.vision
    } else {
      return textFormats.includes(format.toLowerCase())
    }
  }

  initModels = async (): Promise<void> => {
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
    if (!engineConfig) return false
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

  checkModelsCapabilities(): void {

    // iterate on all engines
    let updated = false
    for (const engine of this.getChatEngines({ favorites: false })) {

      try {
      
        if (!this.isEngineConfigured(engine)) {
          continue
        }

        const llm = this.igniteEngine(engine)
        for (const model of this.getChatModels(engine)) {
          if (!model.capabilities) {
            try {
              model.capabilities = llm.getModelCapabilities(model.meta)
              // console.log(`[${engine}] Model ${model.id} capabilities updated`, JSON.stringify(model.capabilities))
              updated = true
            } catch { /* empty */}
          }
        }

      } catch (e) {
        console.error(`[${engine}] Error checking model lists version`, e)
      }
    }

    // save if needed
    if (updated) {
      store.saveSettings()
    }

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


      // filter
      if (store.config.engines.openai.hideDatedModels) {
        models.chat = models.chat.filter(m => !m.id.match(/\d{4}-\d{2}-\d{2}$/i))
      }

      // names
      models.chat = models.chat.map(m => {
        let name = m.name
        name = name.replace(/^gpt-([^-]*)(-?)([a-z]?)/i, (_, l1, __, l3) => `GPT-${l1} ${l3?.toUpperCase()}`)
        name = name.replace(/^chatgpt-([^-]*)(-?)([a-z]?)/i, (_, l1, __, l3) => `ChatGPT-${l1} ${l3?.toUpperCase()}`)
        name = name.replace('Mini', 'mini')
        name = name.replace(/-(\d\d\d\d)$/i, (_ ,l1) => ` ${l1}`)
        name = name.replace(/-(\d\d\d\d-\d\d-\d\d)$/i, (_ ,l1) => ` ${l1}`)
        return { id: m.id, name, capabilities: m.capabilities, meta: m.meta }
      })
      models.image = models.image?.map(m => {
        let name = m.name
        name = name.replace(/^dall-e-/i, 'DALL-E ')
        name = name.replace(/^gpt-image-/i, 'GPT Image ')
        return { id: m.id, name, meta: m.meta }
      })
      models.video = models.video?.map(m => {
        let name = m.name
        name = name.replace(/^sora-/i, 'Sora ')
        name = name.replace(/-pro$/i, ' Pro')
        return { id: m.id, name, meta: m.meta }
      })
    }

    // google are worse
    if (engine === 'google') {
      models.chat = models.chat.filter(m => !m.id.includes('-1.5-') && !m.id.includes('-2.0-') && m.id !== 'gemini-exp-1206')
      models.chat = models.chat.sort((a, b) => {
        if (a.id.includes('gemini') && !b.id.includes('gemini')) return -1
        if (!a.id.includes('gemini') && b.id.includes('gemini')) return 1
        if (a.id.includes('preview') && !b.id.includes('preview')) return 1
        if (!a.id.includes('preview') && b.id.includes('preview')) return -1
        return 0
      })
    }

    // save in store
    engineConfig.models = {
      chat: [],
      image: [],
      ...models
    }

    // now select valid models
    this.selectValidModel(engine, engineConfig, 'chat')
    this.selectValidModel(engine, engineConfig, 'image')
    
    // save only if modified
    const updatedConfig = JSON.stringify(engineConfig)
    if (this.config == store.config && updatedConfig !== initialConfig) {
      store.saveSettings()
    }

    // done
    return true
  
  }  
  
  selectValidModel = (engine: string, engineConfig: EngineConfig, type: 'chat'|'image'): void => {

    // get models
    const models: llm.Model[] = engineConfig?.models?.[type]
    if (!models || !models.length) {
      return null
    }

    // we try models in that order: currently configured then app defaults
    for (const modelId of [
      engineConfig?.model?.[type],
      (defaults as unknown as Configuration).engines[engine]?.model?.[type]
    ]) {
      if (models.find(m => m.id == modelId)) {
        engineConfig.model[type] = modelId
        return
      }
    }

    // if not found, return the first one
    engineConfig.model[type] = models[0].id
  }

   
  loadTools = async (engine: llm.LlmEngine, workspaceId: string, availablePlugins: PluginsList, toolSelection: ToolSelection, opts?: {
    codeExecutionMode?: CodeExecutionMode
  }): Promise<void> => {

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
      const plugin: PluginInstance = new pluginClass(this.config.plugins[pluginName], workspaceId)

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

    // code exec
    if (engine.plugins.length) {
      if (opts?.codeExecutionMode === 'proxy') {
        const { default: CodeExecutionProxyPlugin } = await import('../plugins/code_exec_proxy')
        const codeExecPlugin = new CodeExecutionProxyPlugin()
        await codeExecPlugin.install(engine)
      } else if (opts?.codeExecutionMode === 'program') {
        const { default: CodeExecutionProgramPlugin } = await import('../plugins/code_exec_program')
        const codeExecPlugin = new CodeExecutionProgramPlugin()
        await codeExecPlugin.install(engine)
      }
    }
  }

}
