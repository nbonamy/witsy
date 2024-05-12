
import { anyDict, Message } from '../types/index.d'
import { LlmResponse, LlmCompletionOpts, LLmCompletionPayload, LlmStream, LlmChunk, LlmEventCallback } from '../types/llm.d'
import { Configuration, Model } from '../types/config.d'
import { getFileContents } from './download'
import Plugin from '../plugins/plugin'
import BrowsePlugin from '../plugins/browse'
import TavilyPlugin from '../plugins/tavily'
import PythonPlugin from '../plugins/python'
import { textFormats, imageFormats } from './llm'
import { PluginParameter } from '../types/plugin.d'
import { minimatch } from 'minimatch'

export const availablePlugins: anyDict = {
  browse: BrowsePlugin, 
  python:  PythonPlugin,
  tavily: TavilyPlugin,
}

export default class LlmEngine {

  config: Configuration
  plugins: { [key: string]: Plugin }

  constructor(config: Configuration) {
    this.config = config
    this.loadPlugins()
  }

  getName(): string {
    throw new Error('Not implemented')
  }

  getVisionModels(): string[] {
    throw new Error('Not implemented')
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  isVisionModel(model: string): boolean {
    return false
  }

  async getModels(): Promise<any[]> {
    throw new Error('Not implemented')
  }
  
  getRountingModel(): string|null {
    throw new Error('Not implemented')
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async complete(thread: Message[], opts: LlmCompletionOpts): Promise<LlmResponse> {
    throw new Error('Not implemented')
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async stream(thread: Message[], opts: LlmCompletionOpts): Promise<LlmStream> {
    throw new Error('Not implemented')
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async image(prompt: string, opts: LlmCompletionOpts): Promise<LlmResponse> {
    throw new Error('Not implemented')
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  addImageToPayload(message: Message, payload: LLmCompletionPayload) {
    throw new Error('Not implemented')
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async stop(stream: any): Promise<void> {
    throw new Error('Not implemented')
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async streamChunkToLlmChunk(chunk: any, eventCallback: LlmEventCallback): Promise<LlmChunk|null> {
    throw new Error('Not implemented')
  }

  getChatModel(): string {
    return this.config.engines[this.getName()].model.chat
  }

  getChatModels(): Model[] {
    return this.config.engines[this.getName()].models.chat
  }

  requiresVisionModelSwitch(thread: Message[], currentModel: string): boolean {
    
    // if we already have a vision or auto switch is disabled
    if (this.isVisionModel(currentModel) || !this.config.llm.autoVisionSwitch) {
      return false
    }

    // check if amy of the messages in the thread have an attachment
    return thread.some((msg) => msg.attachment && imageFormats.includes(msg.attachment.format))

  }

  findModel(models: Model[], filters: string[]): Model|null {
    for (const filter of filters) {
      for (const model of models) {
        if (minimatch(model.id, filter)) {
          return model
        }
      }
    }
    return null
  }

  selectModel(thread: Message[], currentModel: string): string {

    // if we need to switch to vision
    if (this.requiresVisionModelSwitch(thread, currentModel)) {

      // find the vision model
      const visionModel = this.findModel(this.getChatModels(), this.getVisionModels())
      if (visionModel) {
        return visionModel.id
      }
    }

    // no need to switch
    return currentModel

  }

  buildPayload(thread: Message[], model: string): LLmCompletionPayload[] {
    if (typeof thread === 'string') {
      return [{ role: 'user', content: thread }]
    } else {

      // we only want to upload the last image attachment
      // so build messages in reverse order
      // and then rerse the array

      let imageAttached = false
      return thread.toReversed().filter((msg) => msg.type === 'text' && msg.content !== null).map((msg): LLmCompletionPayload => {
        const payload: LLmCompletionPayload = { role: msg.role, content: msg.content }
        
        // if there is no attachment, return
        if (!msg.attachment) return payload

        // this can be a loaded chat where contents is not present
        if (!msg.attachment.contents) {
          msg.attachment.contents = getFileContents(msg.attachment.url).contents
        }

        // text formats
        if (textFormats.includes(msg.attachment.format)) {
          payload.content += `\n\n${msg.attachment.contents}`
        }

        // image formats
        if (imageFormats.includes(msg.attachment.format)) {
          if (!imageAttached && this.isVisionModel(model)) {
            this.addImageToPayload(msg, payload)
            imageAttached = true
          }
        }

        // done
        return payload
      
      }).reverse()
    }
  }

  loadPlugins() {
    this.plugins = {}
    for (const pluginName in availablePlugins) {
      const pluginClass = availablePlugins[pluginName]
      const instance = new pluginClass(this.config.plugins[pluginName])
      if (instance.isEnabled()) {
        this.plugins[instance.getName()] = instance
      }
    }
  }

  getAvailableTools(): any[] {
    return Object.values(this.plugins).map((plugin: Plugin) => this.getPluginAsTool(plugin))
  }

  // this is the default implementation as per OpenAI API
  // it is now almost a de facto standard and other providers
  // are following it such as MistralAI
  getPluginAsTool(plugin: Plugin): anyDict {
    return {
      type: 'function',
      function: {
        name: plugin.getName(),
        description: plugin.getDescription(),
        parameters: {
          type: 'object',
          properties: plugin.getParameters().reduce((obj: anyDict, param: PluginParameter) => {
            obj[param.name] = {
              type: param.type,
              enum: param.enum,
              description: param.description,
            }
            return obj
          }, {}),
          required: plugin.getParameters().filter(param => param.required).map(param => param.name),
        },
      },
    }
  }

  getToolPreparationDescription(tool: string): string {
    const plugin = this.plugins[tool]
    return plugin?.getPreparationDescription()
  }
  
  getToolRunningDescription(tool: string): string {
    const plugin = this.plugins[tool]
    return plugin?.getRunningDescription()
  }

  async callTool(tool: string, args: any): Promise<any> {
    const plugin = this.plugins[tool]
    if (plugin) {
      return await plugin.execute(args)
    } else {
      throw new Error(`Tool ${tool} not found`)
    }
  }

}
