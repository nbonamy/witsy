
import { anyDict } from 'types/index'
import { PluginExecutionContext, PluginParameter } from 'multi-llm-ts'
import Plugin, { PluginConfig } from './plugin'
import { i18nInstructions, t } from '../services/i18n'

export default class extends Plugin {

  constructor(config: PluginConfig) {
    super(config)
  }

  isEnabled(): boolean {
    return this.config?.enabled && this.config?.engine && this.config?.model
  }

  getName(): string {
    return 'long_term_memory'
  }

  getDescription(): string {
    // https://python.langchain.com/docs/versions/migrating_memory/long_term_memory_agent/
    return i18nInstructions({ plugins: { memory: this.config } }, 'plugins.memory.description')
  }

  getPreparationDescription(): string {
    return t('plugins.memory.starting')
  }

  getRunningDescription(tool: string, args: any): string {
    if (args.action === 'store') {
      return t('plugins.memory.storing', { content: args.content })
    } else if (args.action === 'retrieve') {
      return t('plugins.memory.retrieving', { query: args.query })
    }
  }

  getCompletedDescription(tool: string, args: any, results: any): string | undefined {
    if (results.error) {
      return t('plugins.memory.error')
    } else if (args.action === 'store') {
      return t('plugins.memory.stored')
    } else if (args.action === 'retrieve') {
      return t('plugins.memory.retrieved', { count: results.content.length })
    }
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
