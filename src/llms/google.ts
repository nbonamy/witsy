import { GenerateContentConfig } from '@google/genai'
import { ChatModel, Google, LlmCompletionOpts } from 'multi-llm-ts'
import { store } from '../services/store'
import ComputerGooglePlugin from '../plugins/computer_google'

const getComputerInfo = () => {
  if (!window.api.computerBrowser?.isAvailable()) return null
  const plugin = new ComputerGooglePlugin(store.config.plugins.computer, store.config.workspaceId)
  return {
    plugin: plugin,
    screenSize: () => ({ width: 1440, height: 900 }),
    screenNumber: () => 1,
  }
}

const isSpecializedModel = (model: string): boolean => {
  return model === 'google-computer-use'
}

const getFallbackModel = (): string => {
  return 'gemini-2.5-flash'
}

export default class GoogleEngine extends Google {

  protected async getGenerationConfig(model: ChatModel, opts?: LlmCompletionOpts): Promise<GenerateContentConfig|undefined> {

    // we need opts
    if (!opts) opts = {}

    // default thinking budget to automatic
    if (typeof opts.thinkingBudget === 'undefined') {
      opts.thinkingBudget = -1
    }

    // use default
    return await super.getGenerationConfig(model, opts)

  }

}

export { getComputerInfo, isSpecializedModel, getFallbackModel }
