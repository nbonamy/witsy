
import { anyDict } from '../types/index'
import { DocumentBase, DocRepoQueryResponseItem } from '../types/rag'
import { PluginConfig } from './plugin'
import { MultiToolPlugin, LlmTool, PluginExecutionContext } from 'multi-llm-ts'
import { t } from '../services/i18n'

export const kKnowledgePluginPrefix = 'search_knowledge_'

export interface KnowledgePluginConfig extends PluginConfig {
  enabled: boolean
}

export default class extends MultiToolPlugin {

  config: KnowledgePluginConfig
  workspaceId: string

  constructor(config: KnowledgePluginConfig, workspaceId: string) {
    super()
    this.config = config
    this.workspaceId = workspaceId
  }

  isEnabled(): boolean {
    return this.config?.enabled || false
  }

  getName(): string {
    return 'Knowledge Base Access'
  }

  getToolNamePrefix(): string {
    return kKnowledgePluginPrefix
  }

  getPreparationDescription(name: string): string {
    const repo = this.getDocRepoByTool(name)
    return t('plugins.knowledge.preparing', { docrepo: repo.name })
  }

  getRunningDescription(name: string, args: any): string {
    const repo = this.getDocRepoByTool(name)
    return t('plugins.knowledge.running', { query: args.query, docrepo: repo.name })
  }

  getCompletedDescription(name: string, args: any, results: any): string | undefined {
    const repo = this.getDocRepoByTool(name)
    if (results.error) {
      return t('plugins.knowledge.error', { error: results.error, docrepo: repo.name })
    }
    const count = results.items?.length || 0
    return t('plugins.knowledge.completed', { docrepo: repo.name, count })
  }

  async getTools(): Promise<LlmTool[]> {
    
    const allDocrepos = window.api.docrepo.list(this.workspaceId) as DocumentBase[]
    if (!allDocrepos?.length) {
      return []
    }

    // Filter to only docrepos from current workspace with valid descriptions
    const filteredDocrepos = allDocrepos.filter(repo => {
      return repo.workspaceId === this.workspaceId &&
             repo.description &&
             repo.description.trim().length > 0
    })

    const tools: LlmTool[] = filteredDocrepos.map(repo => ({
      type: 'function' as const,
      function: {
        name: `${kKnowledgePluginPrefix}${repo.uuid}`,
        description: `Allows to search: ${repo.description}`,
        parameters: {
          type: 'object',
          properties: {
            query: {
              name: 'query',
              type: 'string',
              description: 'The search query to find relevant information',
            }
          },
          required: ['query']
        }
      }
    }))

    // Filter by toolsEnabled if set
    if (this.toolsEnabled) {
      return tools.filter(tool => this.toolsEnabled.includes(tool.function.name))
    }

    return tools
  }

  handlesTool(name: string): boolean {
    const handled = this.getDocRepoByTool(name)?.description?.trim()?.length > 0
    return handled && (!this.toolsEnabled || this.toolsEnabled.includes(name))
  }

  async execute(context: PluginExecutionContext, parameters: anyDict): Promise<anyDict> {

    if (!this.handlesTool(parameters.tool)) {
      return { error: `Tool ${parameters.tool} is not handled by this plugin` }
    }

    const { tool, parameters: args } = parameters
    const uuid = this.getDocRepoUuidByTool(tool)

    try {
      const results: DocRepoQueryResponseItem[] = await window.api.docrepo.query(uuid, args.query)
      return {
        items: results.map(item => ({
          content: item.content,
          score: item.score,
          source: item.metadata.title || item.metadata.url || item.metadata.origin
        }))
      }
    } catch (error) {
      console.error('Knowledge plugin error:', error)
      return { error: error.message || 'Unknown error occurred' }
    }
  }

  getDocRepoUuidByTool(tool: string): string | undefined {
    if (!tool.startsWith(kKnowledgePluginPrefix)) return undefined
    return tool.substring(kKnowledgePluginPrefix.length)
  }

  private getDocRepoByTool(tool: string): DocumentBase | undefined {
    const uuid = this.getDocRepoUuidByTool(tool)
    const allDocrepos = window.api.docrepo.list(this.workspaceId) as DocumentBase[]
    return allDocrepos.find(r => r.uuid === uuid && r.workspaceId === this.workspaceId)
  }

}
