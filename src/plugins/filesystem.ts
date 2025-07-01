
import { anyDict } from '../types/index'
import { DeleteFileResponse, ListDirectoryResponse, ReadFileResponse, WriteFileResponse } from '../types/filesystem'
import { PluginConfig } from './plugin'
import { MultiToolPlugin, LlmTool, PluginExecutionContext } from 'multi-llm-ts'
import { t } from '../services/i18n'
import Dialog from '../composables/dialog'

export interface FilesystemPluginConfig extends PluginConfig {
  allowedPaths: string[]
  allowWrite: boolean
  skipConfirmation: boolean
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
          description: 'Write content to files',
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
      },
      {
        type: 'function',
        function: {
          name: 'filesystem_delete',
          description: 'Delete a file or directory',
          parameters: {
            type: 'object',
            properties: {
              path: {
                name: 'path',
                type: 'string',
                description: 'The file or directory path to delete'
              }
            },
            required: ['path']
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
      case 'filesystem_delete':
        return t('plugins.filesystem.delete.starting')
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
      case 'filesystem_delete':
        return t('plugins.filesystem.delete.running', { path: args.path })
      default:
        return t('plugins.filesystem.default.running')
    }
  }

  getCompletedDescription(name: string, args: any, results: any): string | undefined {
    
    switch (name) {
      
      case 'filesystem_list':
        if (!results.success) return t('plugins.filesystem.list.error', { path: args.path, error: results.error || 'Unknown error' })
        else return t('plugins.filesystem.list.completed', { path: args.path, count: results.items?.length || 0 })
      
      case 'filesystem_read':
        if (!results.success) return t('plugins.filesystem.read.error', { path: args.path, error: results.error || 'Unknown error' })
        else return t('plugins.filesystem.read.completed', { path: args.path, size: results.contents?.length || 0 })
      
      case 'filesystem_write':
        if (!results.success) return t('plugins.filesystem.write.error', { path: args.path, error: results.error || 'Unknown error' })
        else return t('plugins.filesystem.write.completed', { path: args.path })
      
      case 'filesystem_delete':
        if (!results.success) return t('plugins.filesystem.delete.error', { path: args.path, error: results.error || 'Unknown error' })
        else return t('plugins.filesystem.delete.completed', { path: args.path })
      
      default:
        if (results.error) return t('plugins.filesystem.default.error', { tool: name, error: results.error })
        return t('plugins.filesystem.default.completed')
    }
  }

  async getTools(): Promise<LlmTool[]> {
    let availableTools = this.tools
    
    // Filter out write operations if not allowed
    if (!this.config.allowWrite) {
      availableTools = availableTools.filter((tool: LlmTool) => {
        return !['filesystem_delete'].includes(tool.function.name)
      })
    }
    
    if (this.toolsEnabled) {
      return availableTools.filter((tool: LlmTool) => {
        return this.toolsEnabled.includes(tool.function.name)
      })
    } else {
      return availableTools
    }
  }

  handlesTool(name: string): boolean {
    const handled = this.tools.find((tool: LlmTool) => tool.function.name === name) !== undefined
    if (['filesystem_delete'].includes(name) && !this.config.allowWrite) {
      return false
    }
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
      return { error: t('plugins.filesystem.invalidPath', { path: args.path }) }
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
        
        case 'filesystem_delete':
          return await this.deleteFile(args.path)
        
        default:
          return { error: `Unknown tool: ${tool}` }
      }
    } catch (error) {
      console.error('Filesystem plugin error:', error)
      return { error: error.message }
    }
  }

  private async listDirectory(dirPath: string, includeHidden: boolean): Promise<ListDirectoryResponse> {
    try {
      return await window.api.file.listDirectory(dirPath, includeHidden)
    } catch (error) {
      return {
        success: false,
        error: t('plugins.filesystem.list.error', { path: dirPath, error: error.message })
      }
    }
  }

  private async readFile(filePath: string): Promise<ReadFileResponse> {
    try {
      const content = window.api.file.read(filePath)
      content.contents = atob(content.contents)
      return {
        success: true,
        path: filePath,
        contents: content.contents,
      }
    } catch (error) {
      return {
        success: false,
        error: t('plugins.filesystem.read.error', { path: filePath, error: error.message })
      }
    }
  }

  private async writeFile(filePath: string, content: string): Promise<WriteFileResponse> {
    try {

      // check if overwrite is allowed
      const exists = await window.api.file.exists(filePath)
      if (exists && !this.config.allowWrite) {
        return { success: false, error: `File already exists: ${filePath}. Overwriting existing files is not allowed.` }
      }

      // confirm if needed
      if (!this.config.skipConfirmation && !(await this.confirmWrite(filePath))) {
        return { success: false, error: t('plugins.filesystem.write.declined', { path: filePath }) }
      }

      // do it
      const rc = window.api.file.write(filePath, content)
      if (!rc) throw new Error('Failed to write file')
      return { success: true, path: filePath }

    } catch (error) {
      return { success: false, error: t('plugins.filesystem.write.error', { path: filePath, error: error.message }) }
    }
  }

  private async deleteFile(filePath: string): Promise<DeleteFileResponse> {
    try {

      // check if delete is allowed
      if (!this.config.allowWrite) {
        return { success: false, error: `Deletion is not allowed: ${filePath}` }
      }

      // confirm if needed
      if (!this.config.skipConfirmation && !(await this.confirmWrite(filePath))) {
        return { success: false, error: t('plugins.filesystem.delete.declined', { path: filePath }) }
      }

      // do it
      const rc = window.api.file.delete(filePath)
      if (!rc) throw new Error('Failed to delete file or directory')
      return { success: true, path: filePath }

    } catch (error) {
      return { success: false, error: t('plugins.filesystem.delete.error', { path: filePath, error: error.message }) }
    }
  }

  private async confirmWrite(filePath: string): Promise<boolean> {

    const result = await Dialog.show({
      title: t('plugins.filesystem.confirmWrite.title', { path: filePath }),
      text: t('plugins.filesystem.confirmWrite.text', { path: filePath }),
      showCancelButton: true,
      confirmButtonText: t('common.yes'),
      cancelButtonText: t('common.no'),
    })

    return result.isConfirmed
  }
}
