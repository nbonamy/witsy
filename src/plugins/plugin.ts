import { PluginParameter, anyDict } from '../index.d'
import { PluginConfig } from '../config.d'

export default class {

  config: PluginConfig
  
  constructor(config: PluginConfig) {
    this.config = config
  }

  isEnabled(): boolean {
    return false
  }

  getName(): string {
    throw new Error('Not implemented')
  }

  getDescription(): string {
    throw new Error('Not implemented')
  }

  getPreparationDescription(): string {
    return null
  }

  getRunningDescription(): string {
    throw new Error('Not implemented')
  }

  getParameters(): PluginParameter[] {
    throw new Error('Not implemented')
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async execute(parameters: anyDict): Promise<anyDict> {
    throw new Error('Not implemented')
  }

}