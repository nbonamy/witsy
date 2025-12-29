// CLI Plugin - Main process filesystem and shell plugin for CLI
// Uses Node.js fs/path directly (not window.api)

import * as fs from 'fs'
import { Plugin, PluginExecutionContext, PluginParameter } from 'multi-llm-ts'
import * as path from 'path'
import { analyzeCommand, executeCommand as shellExecuteCommand } from './shell'

// Maximum file size for AI read operations (10,000 tokens × 4 characters per token)
const MAX_READ_FILE_CHARACTERS = 40000

export type WorkDirAccess = 'none' | 'ro' | 'rw'

export interface CliPluginConfig {
  workDirPath: string
  workDirAccess: WorkDirAccess
}

type CliAction =
  | 'read_file'
  | 'edit_file'
  | 'write_file'
  | 'create_file'
  | 'create_directory'
  | 'delete_file'
  | 'move_file'
  | 'run_command'

type CliArgs = {
  action: CliAction
  path?: string
  start?: number
  end?: number
  content?: string
  lastModified?: number
  newPath?: string
  command?: string
  cwd?: string
  timeout?: number
}

type CliResponse = {
  success: boolean
  error?: string
  content?: string
  lastModified?: number
  totalLines?: number
  linesRead?: number
  linesModified?: number
  stdout?: string
  stderr?: string
  exitCode?: number
}

export default class CliPlugin extends Plugin {
  config: CliPluginConfig

  constructor(config: CliPluginConfig) {
    super()
    this.config = config
  }

  isEnabled(): boolean {
    return this.config.workDirAccess !== 'none' && !!this.config.workDirPath
  }

  getName(): string {
    return 'cli'
  }

  getDescription(): string {
    const access = this.config.workDirAccess === 'rw' ? 'read and write' : 'read'
    return `Filesystem operations to ${access} files and run shell commands in the working directory: ${this.config.workDirPath}`
  }

  getParameters(): PluginParameter[] {
    const writeActions: CliAction[] = this.config.workDirAccess === 'rw'
      ? ['edit_file', 'write_file', 'create_file', 'create_directory', 'delete_file', 'move_file']
      : []

    return [{
      name: 'action',
      type: 'string',
      enum: ['read_file', 'run_command', ...writeActions],
      description: 'The operation to perform',
      required: true,
    }, {
      name: 'path',
      type: 'string',
      description: `File or directory path (absolute or relative to working directory: ${this.config.workDirPath})`,
      required: false,
    }, {
      name: 'start',
      type: 'number',
      description: '1-indexed start line number (for read_file/edit_file)',
      required: false,
    }, {
      name: 'end',
      type: 'number',
      description: '1-indexed end line number (for read_file/edit_file)',
      required: false,
    }, {
      name: 'content',
      type: 'string',
      description: 'File content (for write_file/create_file/edit_file)',
      required: false,
    }, {
      name: 'lastModified',
      type: 'number',
      description: 'File lastModified timestamp in milliseconds (for edit_file/write_file - validates file hasn\'t changed)',
      required: false,
    }, {
      name: 'newPath',
      type: 'string',
      description: 'New file path (for move_file)',
      required: false,
    }, {
      name: 'command',
      type: 'string',
      description: 'Shell command to execute (for run_command). Note: rm, mv, and command chaining (&&, ||, ;) are blocked for safety.',
      required: false,
    }, {
      name: 'cwd',
      type: 'string',
      description: 'Working directory for command (for run_command, defaults to workDir)',
      required: false,
    }, {
      name: 'timeout',
      type: 'number',
      description: 'Timeout in milliseconds for run_command (default: 15000, max: 60000)',
      required: false,
    }]
  }

  getPreparationDescription(): string {
    return 'Accessing filesystem...'
  }

  getRunningDescription(_tool: string, args: CliArgs): string {
    switch (args.action) {
      case 'read_file':
        return `Read(${args.path})`
      case 'edit_file':
        return `Edit(${args.path})`
      case 'write_file':
        return `Write(${args.path})`
      case 'create_file':
        return `Create(${args.path})`
      case 'create_directory':
        return `CreateDir(${args.path})`
      case 'delete_file':
        return `Delete(${args.path})`
      case 'move_file':
        return `Move(${args.path} → ${args.newPath})`
      case 'run_command':
        return `Bash(${this.truncateCommand(args.command || '', 50)})`
      default:
        return 'Working...'
    }
  }

  getCompletedDescription(_tool: string, args: CliArgs, results: CliResponse): string | undefined {
    const header = this.getRunningDescription(_tool, args)

    switch (args.action) {
      case 'read_file':
        if (results.success) {
          return `${header}\n  └ Read ${results.linesRead} lines`
        } else {
          return `${header}\n  └ Failed to read file`
        }

      case 'edit_file':
        if (results.success) {
          return `${header}\n  └ Edited ${results.linesModified} lines`
        } else {
          return `${header}\n  └ Failed to edit file`
        }

      case 'write_file':
        if (results.success) {
          return `${header}\n  └ Wrote ${results.totalLines} lines`
        } else {
          return `${header}\n  └ Failed to write file`
        }

      case 'create_file':
        if (results.success) {
          return `${header}\n  └ File created`
        } else {
          return `${header}\n  └ Failed to create file`
        }

      case 'create_directory':
        if (results.success) {
          return `${header}\n  └ Directory created`
        } else {
          return `${header}\n  └ Failed to create directory`
        }

      case 'delete_file':
        if (results.success) {
          return `${header}\n  └ File deleted`
        } else {
          return `${header}\n  └ Failed to delete file`
        }

      case 'move_file':
        if (results.success) {
          return `${header}\n  └ File moved`
        } else {
          return `${header}\n  └ Failed to move file`
        }

      case 'run_command': {
        if (results.success) {
          const formattedOutput = this.formatOutput(results.stdout || '')
          if (formattedOutput) {
            return `${header}\n  └${formattedOutput.substring(1)}` // Remove leading space since └ adds spacing
          } else {
            return `${header}\n  └ Command completed (no output)`
          }
        } else {
          const errorHeader = `Command failed with exit code ${results.exitCode}`
          const formattedError = this.formatOutput(results.stderr || '')
          if (formattedError) {
            return `${header}\n  └ ${errorHeader}\n   ${formattedError.substring(1)}` // Align error output
          } else {
            return `${header}\n  └ ${errorHeader}`
          }
        }
      }

      default:
        return results.success
          ? `${header}\n  └ Operation completed`
          : `${header}\n  └ Operation failed`
    }
  }

  private truncateCommand(command: string, maxLength: number = 50): string {
    if (command.length <= maxLength) {
      return command
    }
    return command.slice(0, maxLength - 3) + '...'
  }

  private formatOutput(output: string, maxLines: number = 3): string {
    if (!output) {
      return ''
    }

    const lines = output.split('\n').filter(line => line.length > 0)

    if (lines.length === 0) {
      return ''
    }

    if (lines.length <= maxLines) {
      return lines.map((line, i) => {
        // First line: 2 spaces (will be used after "└ ")
        // Subsequent lines: 4 spaces (to align with content after "└ ")
        const indent = i === 0 ? '  ' : '    '
        return `${indent}${line}`
      }).join('\n')
    }

    // More than maxLines - show first maxLines with truncation
    const firstLines = lines
      .slice(0, maxLines)
      .map((line, i) => {
        const indent = i === 0 ? '  ' : '    '
        return `${indent}${line}`
      })
      .join('\n')
    const remainingCount = lines.length - maxLines
    const pluralSuffix = remainingCount === 1 ? 'line' : 'lines'
    const truncationMessage = `    ... +${remainingCount} more ${pluralSuffix}` // 4 spaces to align

    return `${firstLines}\n${truncationMessage}`
  }

  validatePath(targetPath: string): string | null {
    const workDirPath = path.normalize(this.config.workDirPath)

    // Handle relative paths
    let fullPath: string
    if (path.isAbsolute(targetPath)) {
      fullPath = path.normalize(targetPath)
    } else {
      fullPath = path.normalize(path.join(workDirPath, targetPath))
    }

    // Security check: ensure path is within working directory
    if (!fullPath.startsWith(workDirPath)) {
      return null
    }

    return fullPath
  }

  formatLineNumbered(lines: string[], startLine: number = 1): string {
    return lines.map((line, index) => {
      const lineNum = startLine + index
      const paddedNum = lineNum.toString().padStart(4, ' ')
      return `${paddedNum}→${line}`
    }).join('\n')
  }

  async execute(_context: PluginExecutionContext, parameters: CliArgs): Promise<CliResponse> {
    try {
      switch (parameters.action) {
        case 'read_file':
          if (!parameters.path) {
            return { success: false, error: 'Missing path parameter' }
          }
          return this.readFile(parameters.path, parameters.start, parameters.end)

        case 'edit_file':
          if (this.config.workDirAccess !== 'rw') {
            return { success: false, error: 'Write access not granted' }
          }
          if (!parameters.path) {
            return { success: false, error: 'Missing path parameter' }
          }
          if (parameters.start === undefined || parameters.end === undefined) {
            return { success: false, error: 'Missing start/end line parameters' }
          }
          return this.editFile(
            parameters.path,
            parameters.start,
            parameters.end,
            parameters.content || '',
            parameters.lastModified
          )

        case 'write_file':
          if (this.config.workDirAccess !== 'rw') {
            return { success: false, error: 'Write access not granted' }
          }
          if (!parameters.path) {
            return { success: false, error: 'Missing path parameter' }
          }
          return this.writeFile(parameters.path, parameters.content || '', parameters.lastModified)

        case 'create_file':
          if (this.config.workDirAccess !== 'rw') {
            return { success: false, error: 'Write access not granted' }
          }
          if (!parameters.path) {
            return { success: false, error: 'Missing path parameter' }
          }
          return this.createFile(parameters.path, parameters.content || '')

        case 'create_directory':
          if (this.config.workDirAccess !== 'rw') {
            return { success: false, error: 'Write access not granted' }
          }
          if (!parameters.path) {
            return { success: false, error: 'Missing path parameter' }
          }
          return this.createDirectory(parameters.path)

        case 'delete_file':
          if (this.config.workDirAccess !== 'rw') {
            return { success: false, error: 'Write access not granted' }
          }
          if (!parameters.path) {
            return { success: false, error: 'Missing path parameter' }
          }
          return this.deleteFile(parameters.path)

        case 'move_file':
          if (this.config.workDirAccess !== 'rw') {
            return { success: false, error: 'Write access not granted' }
          }
          if (!parameters.path || !parameters.newPath) {
            return { success: false, error: 'Missing path or newPath parameter' }
          }
          return this.moveFile(parameters.path, parameters.newPath)

        case 'run_command':
          if (!parameters.command) {
            return { success: false, error: 'Missing command parameter' }
          }
          return await this.runCommand(
            parameters.command,
            parameters.cwd,
            parameters.timeout
          )

        default:
          return { success: false, error: `Unknown action: ${parameters.action}` }
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error)
      return { success: false, error: message }
    }
  }

  private readFile(targetPath: string, start?: number, end?: number): CliResponse {
    const filePath = this.validatePath(targetPath)
    if (!filePath) {
      return { success: false, error: `Path not allowed: ${targetPath}` }
    }

    if (!fs.existsSync(filePath)) {
      return { success: false, error: `File not found: ${targetPath}` }
    }

    const stats = fs.statSync(filePath)
    if (stats.isDirectory()) {
      return { success: false, error: `Path is a directory: ${targetPath}` }
    }

    const fileContent = fs.readFileSync(filePath, 'utf-8')
    const allLines = fileContent.split('\n')
    const lastModified = stats.mtimeMs

    // If start/end specified, return range
    if (start !== undefined) {
      const actualStart = Math.max(1, start)
      const actualEnd = end !== undefined ? Math.min(end, allLines.length) : allLines.length

      if (actualStart > allLines.length) {
        return { success: false, error: `Invalid line number: ${actualStart}` }
      }

      const selectedLines = allLines.slice(actualStart - 1, actualEnd)
      const content = this.formatLineNumbered(selectedLines, actualStart)

      return {
        success: true,
        content,
        lastModified,
        totalLines: allLines.length,
        linesRead: selectedLines.length
      }
    }

    // Check file size limit for full file reads
    if (fileContent.length > MAX_READ_FILE_CHARACTERS) {
      const estimatedTokens = Math.ceil(fileContent.length / 4)
      const maxTokens = MAX_READ_FILE_CHARACTERS / 4
      return {
        success: false,
        error: `File too large (~${estimatedTokens.toLocaleString()} tokens, max ${maxTokens.toLocaleString()}). Use start/end to read specific lines. Total lines: ${allLines.length}`
      }
    }

    // Return full file
    const content = this.formatLineNumbered(allLines)

    return {
      success: true,
      content,
      lastModified,
      totalLines: allLines.length,
      linesRead: allLines.length
    }
  }

  private editFile(
    targetPath: string,
    start: number,
    end: number,
    newContent: string,
    lastModified?: number
  ): CliResponse {
    const filePath = this.validatePath(targetPath)
    if (!filePath) {
      return { success: false, error: `Path not allowed: ${targetPath}` }
    }

    if (!fs.existsSync(filePath)) {
      return { success: false, error: `File not found: ${targetPath}` }
    }

    // Check lastModified if provided
    if (lastModified !== undefined) {
      const stats = fs.statSync(filePath)
      if (stats.mtimeMs !== lastModified) {
        return {
          success: false,
          error: `File was modified since last read. Expected: ${new Date(lastModified).toISOString()}, Actual: ${new Date(stats.mtimeMs).toISOString()}`
        }
      }
    }

    const fileContent = fs.readFileSync(filePath, 'utf-8')
    const allLines = fileContent.split('\n')

    if (start < 1 || start > allLines.length) {
      return { success: false, error: `Invalid line number: ${start}` }
    }

    if (end < start || end > allLines.length) {
      return { success: false, error: `Invalid line number: ${end}` }
    }

    // If newContent is empty, delete the lines
    const newLines = newContent ? newContent.split('\n') : []
    const linesRemoved = end - start + 1
    allLines.splice(start - 1, linesRemoved, ...newLines)

    fs.writeFileSync(filePath, allLines.join('\n'), 'utf-8')
    const newStats = fs.statSync(filePath)

    return {
      success: true,
      linesModified: linesRemoved,
      totalLines: allLines.length,
      lastModified: newStats.mtimeMs
    }
  }

  private writeFile(targetPath: string, content: string, lastModified?: number): CliResponse {
    const filePath = this.validatePath(targetPath)
    if (!filePath) {
      return { success: false, error: `Path not allowed: ${targetPath}` }
    }

    // Check lastModified if provided and file exists
    if (lastModified !== undefined && fs.existsSync(filePath)) {
      const stats = fs.statSync(filePath)
      if (stats.mtimeMs !== lastModified) {
        return {
          success: false,
          error: `File was modified since last read. Expected: ${new Date(lastModified).toISOString()}, Actual: ${new Date(stats.mtimeMs).toISOString()}`
        }
      }
    }

    fs.writeFileSync(filePath, content, 'utf-8')
    const lines = content.split('\n')
    const newStats = fs.statSync(filePath)

    return {
      success: true,
      totalLines: lines.length,
      lastModified: newStats.mtimeMs
    }
  }

  private createFile(targetPath: string, content: string): CliResponse {
    const filePath = this.validatePath(targetPath)
    if (!filePath) {
      return { success: false, error: `Path not allowed: ${targetPath}` }
    }

    // Check if file already exists
    if (fs.existsSync(filePath)) {
      return { success: false, error: `File already exists: ${targetPath}` }
    }

    // Create parent directories if needed
    const dir = path.dirname(filePath)
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }

    fs.writeFileSync(filePath, content, 'utf-8')
    const lines = content.split('\n')

    return {
      success: true,
      totalLines: lines.length
    }
  }

  private createDirectory(targetPath: string): CliResponse {
    const dirPath = this.validatePath(targetPath)
    if (!dirPath) {
      return { success: false, error: `Path not allowed: ${targetPath}` }
    }

    // Check if already exists
    if (fs.existsSync(dirPath)) {
      const stats = fs.statSync(dirPath)
      if (stats.isDirectory()) {
        return { success: false, error: `Directory already exists: ${targetPath}` }
      } else {
        return { success: false, error: `File exists at path: ${targetPath}` }
      }
    }

    fs.mkdirSync(dirPath, { recursive: true })

    return { success: true }
  }

  private deleteFile(targetPath: string): CliResponse {
    const filePath = this.validatePath(targetPath)
    if (!filePath) {
      return { success: false, error: `Path not allowed: ${targetPath}` }
    }

    if (!fs.existsSync(filePath)) {
      return { success: false, error: `File not found: ${targetPath}` }
    }

    const stats = fs.statSync(filePath)
    if (stats.isDirectory()) {
      fs.rmSync(filePath, { recursive: true })
    } else {
      fs.unlinkSync(filePath)
    }

    return { success: true }
  }

  private moveFile(targetPath: string, newTargetPath: string): CliResponse {
    const filePath = this.validatePath(targetPath)
    if (!filePath) {
      return { success: false, error: `Path not allowed: ${targetPath}` }
    }

    const newFilePath = this.validatePath(newTargetPath)
    if (!newFilePath) {
      return { success: false, error: `Path not allowed: ${newTargetPath}` }
    }

    if (!fs.existsSync(filePath)) {
      return { success: false, error: `File not found: ${targetPath}` }
    }

    if (fs.existsSync(newFilePath)) {
      return { success: false, error: `File already exists: ${newTargetPath}` }
    }

    // Create parent directories for destination if needed
    const newDir = path.dirname(newFilePath)
    if (!fs.existsSync(newDir)) {
      fs.mkdirSync(newDir, { recursive: true })
    }

    fs.renameSync(filePath, newFilePath)

    return { success: true }
  }

  private async runCommand(
    command: string,
    cwd?: string,
    timeout?: number
  ): Promise<CliResponse> {
    // Analyze command for blocked/dangerous patterns
    const analysis = analyzeCommand(command, this.config.workDirPath)

    if (analysis.blockedCommand) {
      return {
        success: false,
        stdout: '',
        stderr: `Command '${analysis.blockedCommand}' is not allowed. Use the file operation actions instead.`,
        exitCode: 1,
        error: `Command '${analysis.blockedCommand}' is blocked for safety`
      }
    }

    if (analysis.hasForbiddenOperators) {
      return {
        success: false,
        stdout: '',
        stderr: 'Command chaining operators (&&, ||, ;) are not allowed for security.',
        exitCode: 1,
        error: 'Command chaining is blocked'
      }
    }

    // In CLI context, block dangerous commands (no confirmation dialog available)
    if (analysis.isDangerous) {
      return {
        success: false,
        stdout: '',
        stderr: `Command blocked: ${analysis.dangersDetected.join(', ')}`,
        exitCode: 1,
        error: 'Dangerous command blocked'
      }
    }

    // Resolve working directory
    const workDir = cwd ? this.validatePath(cwd) : this.config.workDirPath
    if (!workDir) {
      return {
        success: false,
        stdout: '',
        stderr: `Working directory not allowed: ${cwd}`,
        exitCode: 1,
        error: 'Invalid working directory'
      }
    }

    // Execute command using shell.ts
    const result = await shellExecuteCommand({
      command,
      cwd: workDir,
      restrictToPath: this.config.workDirPath,
      timeoutMs: timeout
    })

    return {
      success: result.success,
      stdout: result.stdout,
      stderr: result.stderr,
      exitCode: result.exitCode,
      error: result.error
    }
  }
}
