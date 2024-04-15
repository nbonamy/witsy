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

  getDefinition(): anyDict {
    return {
      type: 'function',
      function: {
        name: this.getName(),
        description: this.getDescription(),
        parameters: {
          type: 'object',
          properties: this.getParameters().reduce((obj: anyDict, param: PluginParameter) => {
            obj[param.name] = {
              type: param.type,
              enum: param.enum,
              description: param.description,
            }
            return obj
          }, {}),
          required: this.getParameters().filter(param => param.required).map(param => param.name),
        },
      },
    }
  }

}