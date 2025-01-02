
import { anyDict } from 'types/index'
import { PluginParameter } from 'multi-llm-ts'
import Plugin, { PluginConfig } from './plugin'

export default class extends Plugin {

  constructor(config: PluginConfig) {
    super(config)
  }

  isEnabled(): boolean {
    return this.config?.enabled
  }

  getName(): string {
    return 'long_term_memory'
  }

  getDescription(): string {
    return `Stores and retrieves significant facts about the user.
            Use this tool to save and get user information, preferences, tastes and make your answers more personalized.
            When you save information, make sure the content includes enough description to be easily retrieved later.
            For instance don't just store "User likes U2" but "User musical tastes includes U2".
            Avoid storing unrelated facts together: split them into different facts and store them separately.
            Don't be shy about storing information, the more you store, the more you can personalize the user experience.
            When user asks for suggestions, make sure you retrieve any preferences stored in memory and use them to filter the suggestions.
            `
  }

  getRunningDescription(): string {
    return 'Personnalizing…'
  }

  getParameters(): PluginParameter[] {
    return [
      {
        name: 'action',
        type: 'string',
        description: 'action to perform',
        enum: ['store', 'retrieve'],
        required: true
      },
      {
        name: 'content',
        type: 'string',
        description: 'The information to store',
        required: false
      },
      {
        name: 'query',
        type: 'string',
        description: 'A query to retrieve information',
        required: false
      }
    ]
  }

  async execute(parameters: anyDict): Promise<anyDict> {

    try {
      if (parameters.action === 'store') {
        console.log('[memory] storing:', parameters.content)
        window.api.memory.store(parameters.content)
        return { success: true }
      } else if (parameters.action === 'retrieve') {
        console.log('[memory] retrieving:', parameters.query)
        const content = window.api.memory.retrieve(parameters.query)
        if (content.length > 0) {
          return { content: content }
        } else {
          return { error: 'No relevant information found' }
        }
      }
    } catch (error) {
      return error
    }

  }  

}
