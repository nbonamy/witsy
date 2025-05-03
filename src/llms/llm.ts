
import { Configuration } from '../types/config'
import { ToolSelection, type ILlmManager } from '../types/llm'
import LlmManager from './manager'

export const favoriteMockEngine = '__favorites__'

export { ILlmManager }

export const areToolsDisabled = (tools: ToolSelection): boolean => {
  return tools != null && Array.isArray(tools) && tools.length === 0
}

export const areAllToolsEnabled = (tools: ToolSelection): boolean => {
  return tools === null
}

export default class LlmFactory {

  static manager(config: Configuration) {
    return new LlmManager(config)
  }

}
