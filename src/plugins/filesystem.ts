
import { anyDict } from '../types/index'
import { DeleteFileResponse, ListDirectoryResponse, ReadFileResponse, WriteFileResponse } from '../types/filesystem'
import { PluginConfig } from './plugin'
import { MultiToolPlugin, LlmTool, PluginExecutionContext } from 'multi-llm-ts'
import { t } from '../services/i18n'
import Dialog from '../composables/dialog'

export const kFilesystemPluginPrefix = 'filesystem_'

export interface FilesystemPluginConfig extends PluginConfig {
  allowedPaths: string[]
  allowWrite: boolean
  skipConfirmation: boolean
}

export default class extends MultiToolPlugin {

  config: FilesystemPluginConfig
  tools: LlmTool[]

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  constructor(config: FilesystemPluginConfig, workspaceId: string) {
    super()
    this.config = config
    this.tools = [
      {
        type: 'function',
        function: {
          name: `${kFilesystemPluginPrefix}list`,
          description: 'List files and directories in a specified path. Avoid using absolute paths unless you know it from a previous call or provided by the user.',
          parameters: {
            type: 'object',
            properties: {
              path: {
                name: 'path',
                type: 'string',
                description: 'The directory path to list contents from.',
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
          name: `${kFilesystemPluginPrefix}read`,
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
          name: `${kFilesystemPluginPrefix}write`,
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
          name: `${kFilesystemPluginPrefix}delete`,
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

  getToolNamePrefix(): string {
    return kFilesystemPluginPrefix
  }

  getPreparationDescription(name: string): string {
    switch (name) {
      case `${kFilesystemPluginPrefix}list`:
        return t('plugins.filesystem.list.starting')
      case `${kFilesystemPluginPrefix}read`:
        return t('plugins.filesystem.read.starting')
      case `${kFilesystemPluginPrefix}write`:
        return t('plugins.filesystem.write.starting')
      case `${kFilesystemPluginPrefix}delete`:
        return t('plugins.filesystem.delete.starting')
      default:
        return t('plugins.filesystem.default.starting')
    }
  }
  
  getRunningDescription(name: string, args: any): string {
    switch (name) {
      case `${kFilesystemPluginPrefix}list`:
        return t('plugins.filesystem.list.running', { path: args.path })
      case `${kFilesystemPluginPrefix}read`:
        return t('plugins.filesystem.read.running', { path: args.path })
      case `${kFilesystemPluginPrefix}write`:
        return t('plugins.filesystem.write.running', { path: args.path })
      case `${kFilesystemPluginPrefix}delete`:
        return t('plugins.filesystem.delete.running', { path: args.path })
      default:
        return t('plugins.filesystem.default.running')
    }
  }

  getCompletedDescription(name: string, args: any, results: any): string | undefined {
    
    switch (name) {

      case `${kFilesystemPluginPrefix}list`:
        if (!results.success) return t('plugins.filesystem.list.error', { path: args.path, error: results.error || 'Unknown error' })
        else return t('plugins.filesystem.list.completed', { path: args.path, count: results.items?.length || 0 })

      case `${kFilesystemPluginPrefix}read`:
        if (!results.success) return t('plugins.filesystem.read.error', { path: args.path, error: results.error || 'Unknown error' })
        else return t('plugins.filesystem.read.completed', { path: args.path, size: results.contents?.length || 0 })

      case `${kFilesystemPluginPrefix}write`:
        if (!results.success) return t('plugins.filesystem.write.error', { path: args.path, error: results.error || 'Unknown error' })
        else return t('plugins.filesystem.write.completed', { path: args.path })

      case `${kFilesystemPluginPrefix}delete`:
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
        return ![`${kFilesystemPluginPrefix}delete`].includes(tool.function.name)
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
    if ([`${kFilesystemPluginPrefix}delete`].includes(name) && !this.config.allowWrite) {
      return false
    }
    return handled && (!this.toolsEnabled || this.toolsEnabled.includes(name))
  }

  mapToAllowedPaths(targetPath: string): string|null {

    // if no allowed paths are configured, return null
    if (!this.config.allowedPaths || this.config.allowedPaths.length === 0) {
      return null
    }

    // try to find the target path in the allowed paths
    const normalizedTarget = window.api.file.normalize(targetPath)
    for (const allowedPath of this.config.allowedPaths) {
      const normalizedAllowed = window.api.file.normalize(allowedPath)
      if (normalizedTarget.startsWith(normalizedAllowed)) {
        return normalizedTarget
      }
    }

    // else let's try to see if the target path is a subdirectory of any allowed path
    for (const allowedPath of this.config.allowedPaths) {
      const normalizedAllowed = window.api.file.normalize(allowedPath)
      const path = window.api.file.normalize(`${normalizedAllowed}/./${targetPath}`)
      if (window.api.file.exists(path)) {
        return path
      }
    }

    // else we can handle this case:
    // - allowed = /Documents
    // - target = ./Documents/folder/test.txt
    const dirSep = window.api.platform === 'win32' ? '\\' : '/'
    const path = targetPath.startsWith('./') ? targetPath.slice(2) : targetPath
    const targetParts = path.split(dirSep)
    for (const allowedPath of this.config.allowedPaths) {
      const normalizedAllowed = window.api.file.normalize(allowedPath)
      const allowedParts = normalizedAllowed.split(dirSep)
      if (allowedParts.length && allowedParts[allowedParts.length - 1] === targetParts[0]) {
        const targetPath = allowedParts.slice(0, -1).join(dirSep) + dirSep + path
        if (window.api.file.exists(targetPath)) {
          return targetPath
        }
      }
    }

    // if we reach here, it means the path is not allowed
    return null
  }

  async execute(context: PluginExecutionContext, parameters: anyDict): Promise<anyDict> {
    
    if (!this.handlesTool(parameters.tool)) {
      return { error: `Tool ${parameters.tool} is not handled by this plugin or has been disabled` }
    }

    const { tool, parameters: args } = parameters

    const path = await this.mapToAllowedPaths(args.path)
    if (!path) {
      return { error: t('plugins.filesystem.invalidPath', { path: args.path }) }
    }

    try {
      switch (tool) {
        case `${kFilesystemPluginPrefix}list`:
          return await this.listDirectory(path, args.includeHidden || false)

        case `${kFilesystemPluginPrefix}read`:
          return await this.readFile(path)

        case `${kFilesystemPluginPrefix}write`:
          return await this.writeFile(path, args.content)

        case `${kFilesystemPluginPrefix}delete`:
          return await this.deleteFile(path)
        
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
