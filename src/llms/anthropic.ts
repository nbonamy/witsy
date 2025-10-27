
import { Anthropic, ChatModel, LlmCompletionOpts } from 'multi-llm-ts'
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
  return model === 'computer-use'
}

const getFallbackModel = (): string => {
  return 'claude-3-5-sonnet-20241022'
}

export default class AnthropicEngine extends Anthropic {

  getCompletionOpts(model: ChatModel, opts?: LlmCompletionOpts): any {

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
