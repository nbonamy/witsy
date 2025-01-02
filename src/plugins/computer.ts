
import { ComputerAction, anyDict } from 'types/index'
import { PluginParameter } from 'multi-llm-ts'
import Plugin, { PluginConfig } from './plugin'

export default class extends Plugin {

  constructor(config: PluginConfig) {
    super(config)
  }

  sezializeInTools(): boolean {
    return false
  }

  isEnabled(): boolean {
    return true
  }

  getName(): string {
    return 'computer'
  }

  getDescription(): string {
    return ''
  }

  getPreparationDescription(): string {
    return this.getRunningDescription()
  }

  getRunningDescription(): string {
    return 'Using your computer…'
  }

  getParameters(): PluginParameter[] {
    return []
  }

  async execute(parameters: anyDict): Promise<anyDict> {

    // if not screenshot run it first
    if (parameters.action !== 'screenshot') {
      const result = window.api.computer.executeAction(parameters as ComputerAction)
      if (result === false) {
        return { content: 'An error occured while executing this action' }
      }
    }

    // screenshot 
    const sshot = window.api.computer.takeScreenshot()
    return { content: [
      { type: 'image',
        source: {
          type: 'base64',
          media_type: 'image/jpeg',
          data: sshot
        }
      }
    ]}

  }  

}
