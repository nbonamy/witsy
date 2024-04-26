
import { anyDict } from '../types/index.d'
import { Configuration } from '../types/config.d'
import { PluginParameter } from '../types/plugin.d'
import Plugin from './plugin'
import Tavily from '../vendor/tavily'

export default class extends Plugin {

  constructor(config: Configuration) {
    super(config)
  }

  isEnabled(): boolean {
    return this.config.enabled && this.config.apiKey
  }

  getName(): string {
    return 'search_tavily'
  }

  getDescription(): string {
    return 'This tool allows you to search the web for information on a given topic'
  }

  getRunningDescription(): string {
    return 'Searching the internet…'
  }

  getParameters(): PluginParameter[] {
    return [
      {
        name: 'query',
        type: 'string',
        description: 'The query to search for',
        required: true
      }
    ]
  }

  async execute(parameters: anyDict): Promise<anyDict> {
    try {
      const tavily = new Tavily(this.config.apiKey)
      const response = await tavily.search(parameters.query, {
        include_answer: true,
        //include_raw_content: true,
      })
      return response
    } catch (error) {
      return { error: error.message }
    }
  }

}
