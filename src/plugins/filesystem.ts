
import { PluginExecutionContext, PluginParameter } from 'multi-llm-ts'
import Dialog from '../composables/dialog'
import { t } from '../services/i18n'
import { DeleteFileResponse, FindFilesResponse, ListDirectoryResponse, ReadFileResponse, WriteFileResponse } from '../types/filesystem'
import { anyDict } from '../types/index'
import Plugin, { PluginConfig } from './plugin'

export const kFilesystemPluginName = 'filesystem'

export interface FilesystemPluginConfig extends PluginConfig {
  allowedPaths: string[]
  allowWrite: boolean
  skipConfirmation: boolean
}

type FileSystemArgs = {
  action: 'list' | 'read' | 'write' | 'delete' | 'find'
  path: string
  content?: string
  includeHidden?: boolean
  pattern?: string
  maxResults?: number
}

export default class extends Plugin {

   
  constructor(config: FilesystemPluginConfig, workspaceId: string) {
    super(config, workspaceId)
    this.config = config
  }

  isEnabled(): boolean {
    return this.config?.enabled && Array.isArray(this.config?.allowedPaths) && this.config.allowedPaths.length > 0
  }

  getName(): string {
    return kFilesystemPluginName
  }

  getDescription(): string {
    return t('plugins.filesystem.description')
  }

  getParameters(): PluginParameter[] {

    return [{
      name: 'action',
      type: 'string',
      enum: ['list', 'read', 'write', 'find', ...(this.config.allowWrite ? ['delete'] : [])],
      description: 'The filesystem tool to use',
      required: true,
    }, {
      name: 'path',
      type: 'string',
      description: `The file or directory path to operate on. Always use an absolute path given that the paths allowed are:\n${this.config.allowedPaths.join('\n')}.`,
      required: true,
    }, {
      name: 'content',
      type: 'string',
      description: 'The content to write to the file (only for write action)',
      required: false,
    }, {
      name: 'pattern',
      type: 'string',
      description: 'Glob pattern to match files (e.g., "*.ts", "**/*.json") (only for find action)',
      required: false,
    }, {
      name: 'maxResults',
      type: 'number',
      description: 'Maximum number of results to return (default: 10) (only for find action)',
      required: false,
    }, {
      name: 'includeHidden',
      type: 'boolean',
      description: 'Whether to include hidden files and directories',
      required: false
    }]

  }

  getPreparationDescription(): string {
    return t('plugins.filesystem.starting')
  }
  
  getRunningDescription(name: string, args: FileSystemArgs): string {
    switch (args.action) {
      case 'list':
        return t('plugins.filesystem.list.running', { path: args.path })
      case 'read':
        return t('plugins.filesystem.read.running', { path: args.path })
      case 'write':
        return t('plugins.filesystem.write.running', { path: args.path })
      case 'delete':
        return t('plugins.filesystem.delete.running', { path: args.path })
      case 'find':
        return t('plugins.filesystem.find.running', { path: args.path, pattern: args.pattern })
      default:
        return t('plugins.filesystem.default.running')
    }
  }

  getCompletedDescription(name: string, args: FileSystemArgs, results: any): string | undefined {

    switch (args.action) {

      case 'list':
        if (!results.success) return t('plugins.filesystem.list.error', { path: args.path, error: results.error || 'Unknown error' })
        else return t('plugins.filesystem.list.completed', { path: args.path, count: results.items?.length || 0 })

      case 'read':
        if (!results.success) return t('plugins.filesystem.read.error', { path: args.path, error: results.error || 'Unknown error' })
        else return t('plugins.filesystem.read.completed', { path: args.path, size: results.contents?.length || 0 })

      case 'write':
        if (!results.success) return t('plugins.filesystem.write.error', { path: args.path, error: results.error || 'Unknown error' })
        else return t('plugins.filesystem.write.completed', { path: args.path })

      case 'delete':
        if (!results.success) return t('plugins.filesystem.delete.error', { path: args.path, error: results.error || 'Unknown error' })
        else return t('plugins.filesystem.delete.completed', { path: args.path })

      case 'find':
        if (!results.success) return t('plugins.filesystem.find.error', { path: args.path, error: results.error || 'Unknown error' })
        else return t('plugins.filesystem.find.completed', { path: args.path, count: results.count || 0 })

      default:
        if (results.error) return t('plugins.filesystem.default.error', { tool: name, error: results.error })
        return t('plugins.filesystem.default.completed')
    }
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

  async execute(context: PluginExecutionContext, parameters: FileSystemArgs): Promise<anyDict> {

    const path = await this.mapToAllowedPaths(parameters.path)
    if (!path) {
      return { error: t('plugins.filesystem.invalidPath', { path: parameters.path }) }
    }

    try {
      switch (parameters.action) {
        case 'list':
          return await this.listDirectory(path, parameters.includeHidden || false)

        case 'read':
          return await this.readFile(path)

        case 'write':
          return await this.writeFile(path, parameters.content)

        case 'delete':
          return await this.deleteFile(path)

        case 'find':
          return await this.findFiles(path, parameters.pattern, parameters.maxResults)

        default:
          return { error: `Unknown action: ${parameters.action}` }
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

      // Determine file format from extension
      const ext = filePath.split('.').pop()?.toLowerCase() || ''
      const extractableFormats = ['pdf', 'docx', 'pptx', 'xlsx', 'txt']

      let textContent: string
      if (extractableFormats.includes(ext)) {
        // Extract text from documents
        textContent = window.api.file.extractText(content.contents, ext)
      } else {
        // For other files, just decode base64
        textContent = atob(content.contents)
      }

      return {
        success: true,
        path: filePath,
        contents: textContent,
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

  private async findFiles(basePath: string, pattern: string, maxResults?: number): Promise<FindFilesResponse> {
    try {
      // Validate pattern
      if (!pattern) {
        return {
          success: false,
          error: t('plugins.filesystem.find.noPattern')
        }
      }

      // Set default maxResults if not provided
      const limit = maxResults || 10

      // Call the file API (now async)
      const files = await window.api.file.findFiles(basePath, pattern, limit)

      return {
        success: true,
        files,
        count: files.length,
        truncated: files.length >= limit
      }
    } catch (error) {
      return {
        success: false,
        error: t('plugins.filesystem.find.error', { path: basePath, error: error.message })
      }
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
