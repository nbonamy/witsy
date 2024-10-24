
import { anyDict, Message } from 'types/index.d'
import { LlmResponse, LlmCompletionOpts, LLmCompletionPayload, LlmStream, LlmChunk, LlmEventCallback, LlmTool } from 'types/llm.d'
import { Configuration, Model } from 'types/config.d'
import { getFileContents } from '../services/download'
import Plugin from '../plugins/plugin'
import { availablePlugins } from '../plugins/plugins'
import { PluginParameter } from 'types/plugin.d'
import { minimatch } from 'minimatch'

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

  async getModels(): Promise<any[]> {
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

  isVisionModel(model: string): boolean {
    for (const filter of this.getVisionModels()) {
      if (minimatch(model, filter)) {
        return true
      }
    }
    return false
  }

  requiresVisionModelSwitch(thread: Message[], currentModel: string): boolean {
    
    // if we already have a vision or auto switch is disabled
    if (this.isVisionModel(currentModel) || !this.config.llm.autoVisionSwitch) {
      return false
    }

    // check if amy of the messages in the thread have an attachment
    return thread.some((msg) => msg.attachment && msg.attachment.isImage())

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

  buildPayload(thread: Message[] | string, model: string): LLmCompletionPayload[] {
    if (typeof thread === 'string') {
      return [{ role: 'user', content: thread }]
    } else {

      // we only want to upload the last image attachment
      // so build messages in reverse order
      // and then reverse the array

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
        if (msg.attachment.isText()) {
          payload.content += `\n\n${msg.attachment.contents}`
        }

        // image formats
        if (msg.attachment.isImage()) {
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

  async getAvailableTools(): Promise<LlmTool[]> {
    const tools = []
    for (const pluginName in this.plugins) {

      // some plugins are vendor specific and are handled
      // inside the LlmEngine concrete class
      const plugin = this.plugins[pluginName]
      if (!plugin.sezializeInTools()) {
        continue
      }

      // others
      if (plugin.isMultiTool()) {
        const pluginAsTool = await plugin.getTools()
        if (Array.isArray(pluginAsTool)) {
          tools.push(...pluginAsTool)
        } else if (pluginAsTool) {
          tools.push(pluginAsTool)
        }
      } else {
        tools.push(this.getPluginAsTool(plugin))
      }
    }
    return tools
  }

  // this is the default implementation as per OpenAI API
  // it is now almost a de facto standard and other providers
  // are following it such as MistralAI and others
  getPluginAsTool(plugin: Plugin): LlmTool {
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

    // get the plugin
    const plugin: Plugin = this.plugins[tool]
    if (plugin) {
      return await plugin.execute(args)
    }

    // try multi-tools
    for (const plugin of Object.values(this.plugins)) {
      if (plugin.isMultiTool() && plugin.handlesTool(tool)) {
        return await plugin.execute({ tool: tool, parameters: args })
      }
    }

    // too bad
    throw new Error(`Tool ${tool} not found`)
  }

}
