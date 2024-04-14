
import { PluginParameter, anyDict } from '../index.d'
import { Configuration } from '../config.d'
import Plugin from './plugin'

export default class extends Plugin {

  constructor(config: Configuration) {
    super(config)
  }

  isEnabled(): boolean {
    return true
  }

  getName(): string {
    return 'get_current_temperature'
  }

  getDescription(): string {
    return 'Get the current temperature in celsius in a given location'
  }

  getParameters(): PluginParameter[] {
    return [
      {
        name: 'location',
        type: 'string',
        description: 'The location to get the temperature for',
        required: true
      }
    ]
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async execute(parameters: anyDict): Promise<anyDict> {
    return {
      location: parameters.location,
      temperature: 25
    }
  }  

}
