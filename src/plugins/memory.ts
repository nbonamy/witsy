
import { anyDict } from 'types/index'
import { PluginExecutionContext, PluginParameter } from 'multi-llm-ts'
import Plugin, { PluginConfig } from './plugin'
import { i18nInstructions } from '../services/i18n'

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
    // https://python.langchain.com/docs/versions/migrating_memory/long_term_memory_agent/
    return i18nInstructions({ plugins: { memory: this.config } }, 'plugins.memory.description')
  }

  getPreparationDescription(): string {
    return this.getRunningDescription()
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
        type: 'array',
        description: 'The list of information to store',
        items: { type: 'string' },
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

  async execute(context: PluginExecutionContext, parameters: anyDict): Promise<anyDict> {

    try {
      if (parameters.action === 'store') {
        console.log('[memory] storing:', parameters.content)
        if (window.api.memory.store(parameters.content)) {
          return { success: true }
        } else {
          return { error: 'Failed to store information' }
        }
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
