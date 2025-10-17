
import { Anthropic, ChatModel, LlmCompletionOpts } from 'multi-llm-ts'
import { MessageCreateParamsBase } from '@anthropic-ai/sdk/resources/beta/messages/messages'
import { store } from '../services/store'
import ComputerPlugin from '../plugins/computer'

const getComputerInfo = () =>{
  if (!window.api.computer?.isAvailable()) return null
  const plugin = new ComputerPlugin(store.config.plugins.computer, store.config.workspaceId)
  return {
    plugin: plugin,
    screenSize: window.api.computer.getScaledScreenSize,
    screenNumber: window.api.computer.getScreenNumber,
  }
}

const isSpecializedModel = (model: string): boolean => {
  if (!store.config.engines.anthropic.apiKey) return false
  return new Anthropic(store.config.engines.anthropic).isComputerUseModel(model)
}

const getFallbackModel = (): string => {
  return 'claude-3-5-sonnet-20241022'
}

export default class AnthropicEngine extends Anthropic {

  getCompletionOpts(model: ChatModel, opts?: LlmCompletionOpts): Omit<MessageCreateParamsBase, 'model'|'messages'|'stream'|'tools'|'tool_choice'> {

    // we need opts
    if (!opts) opts = {} 

    // activate reasoning by default
    if (typeof opts.reasoning === 'undefined') {
      opts.reasoning = true
    }

    // use default
    return super.getCompletionOpts(model, opts)

  }
  
}

export { getComputerInfo, isSpecializedModel, getFallbackModel }
