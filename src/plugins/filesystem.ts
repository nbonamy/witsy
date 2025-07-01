import { anyDict } from 'types/index'
import { PluginConfig } from './plugin'
import { MultiToolPlugin, LlmTool, PluginExecutionContext } from 'multi-llm-ts'
import { t } from '../services/i18n'

export interface FilesystemPluginConfig extends PluginConfig {
  allowedPaths: string[]
}

export default class extends MultiToolPlugin {

  config: FilesystemPluginConfig
  tools: LlmTool[]
  
  constructor(config: FilesystemPluginConfig) {
    super()
    this.config = config
    this.tools = [
      {
        type: 'function',
        function: {
          name: 'filesystem_list',
          description: 'List files and directories in a specified path',
          parameters: {
            type: 'object',
            properties: {
              path: {
                name: 'path',
                type: 'string',
                description: 'The directory path to list contents from'
              },
              includeHidden: {
                name: 'includeHidden',
                type: 'boolean',
                description: 'Whether to include hidden files and directories',
              }
            },
            required: ['path']
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'filesystem_read',
          description: 'Read the contents of a file',
          parameters: {
            type: 'object',
            properties: {
              path: {
                name: 'path',
                type: 'string',
                description: 'The file path to read'
              }
            },
            required: ['path']
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'filesystem_write',
          description: 'Write content to a new file (will not overwrite existing files)',
          parameters: {
            type: 'object',
            properties: {
              path: {
                name: 'path',
                type: 'string',
                description: 'The file path to write to'
              },
              content: {
                name: 'content',
                type: 'string',
                description: 'The content to write to the file'
              }
            },
            required: ['path', 'content']
          }
        }
      }
    ]
  }

  isEnabled(): boolean {
    return this.config?.enabled && Array.isArray(this.config?.allowedPaths) && this.config.allowedPaths.length > 0
  }

  getName(): string {
    return 'Filesystem Access'
  }

  getPreparationDescription(name: string): string {
    switch (name) {
      case 'filesystem_list':
        return t('plugins.filesystem.list.starting')
      case 'filesystem_read':
        return t('plugins.filesystem.read.starting')
      case 'filesystem_write':
        return t('plugins.filesystem.write.starting')
      default:
        return t('plugins.filesystem.default.starting')
    }
  }
  
  getRunningDescription(name: string, args: any): string {
    switch (name) {
      case 'filesystem_list':
        return t('plugins.filesystem.list.running', { path: args.path })
      case 'filesystem_read':
        return t('plugins.filesystem.read.running', { path: args.path })
      case 'filesystem_write':
        return t('plugins.filesystem.write.running', { path: args.path })
      default:
        return t('plugins.filesystem.default.running')
    }
  }

  getCompletedDescription(name: string, args: any, results: any): string | undefined {
    if (results.error) {
      return t('plugins.filesystem.error', { tool: name, error: results.error })
    }
    
    switch (name) {
      case 'filesystem_list':
        return t('plugins.filesystem.list.completed', { path: args.path, count: results.items?.length || 0 })
      case 'filesystem_read':
        return t('plugins.filesystem.read.completed', { path: args.path, size: results.contents?.length || 0 })
      case 'filesystem_write':
        return t('plugins.filesystem.write.completed', { path: args.path })
      default:
        return t('plugins.filesystem.default.completed')
    }
  }

  async getTools(): Promise<LlmTool[]> {
    if (this.toolsEnabled) {
      return this.tools.filter((tool: LlmTool) => {
        return this.toolsEnabled.includes(tool.function.name)
      })
    } else {
      return this.tools
    }
  }

  handlesTool(name: string): boolean {
    const handled = this.tools.find((tool: LlmTool) => tool.function.name === name) !== undefined
    return handled && (!this.toolsEnabled || this.toolsEnabled.includes(name))
  }

  private async isPathAllowed(targetPath: string): Promise<boolean> {
    if (!this.config.allowedPaths || this.config.allowedPaths.length === 0) {
      return false
    }

    const normalizedTarget = window.api.file.normalize(targetPath)
    
    return this.config.allowedPaths.some(allowedPath => {
      const normalizedAllowed = window.api.file.normalize(allowedPath)
      return normalizedTarget.startsWith(normalizedAllowed)
    })
  }

  async execute(context: PluginExecutionContext, parameters: anyDict): Promise<anyDict> {
    if (!this.handlesTool(parameters.tool)) {
      return { error: `Tool ${parameters.tool} is not handled by this plugin or has been disabled` }
    }

    const { tool, parameters: args } = parameters

    if (!(await this.isPathAllowed(args.path))) {
      return { error: `Access denied: Path "${args.path}" is not in the allowed directories` }
    }

    args.path = window.api.file.normalize(args.path)

    try {
      switch (tool) {
        case 'filesystem_list':
          return await this.listDirectory(args.path, args.includeHidden || false)
        
        case 'filesystem_read':
          return await this.readFile(args.path)
        
        case 'filesystem_write':
          return await this.writeFile(args.path, args.content)
        
        default:
          return { error: `Unknown tool: ${tool}` }
      }
    } catch (error) {
      console.error('Filesystem plugin error:', error)
      return { error: error.message }
    }
  }

  private async listDirectory(dirPath: string, includeHidden: boolean): Promise<anyDict> {
    try {
      const items = await window.api.file.listDirectory(dirPath, includeHidden)
      return { items }
    } catch (error) {
      return { error: `Failed to list directory: ${error.message}` }
    }
  }

  private async readFile(filePath: string): Promise<anyDict> {
    try {
      const content = await window.api.file.read(filePath)
      content.contents = atob(content.contents)
      return content
    } catch (error) {
      return { error: `Failed to read file: ${error.message}` }
    }
  }

  private async writeFile(filePath: string, content: string): Promise<anyDict> {
    try {
      const exists = await window.api.file.exists(filePath)
      if (exists) {
        return { error: `File already exists: ${filePath}. Overwriting existing files is not allowed.` }
      }
      await window.api.file.writeNew(filePath, content)
      return { success: true, path: filePath }
    } catch (error) {
      return { error: `Failed to write file: ${error.message}` }
    }
  }
}
