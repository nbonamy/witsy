import { exec } from 'child_process'
import { realpathSync } from 'fs'
import { sep } from 'path'
import { promisify } from 'util'
import PowerShell from 'powershell'

const execAsync = promisify(exec)

export type ShellInfo = {
  shell: string
  platform: 'darwin' | 'linux' | 'win32'
}

export type ShellExecuteParams = {
  command: string
  cwd: string
  restrictToPath?: string
  timeoutMs?: number // Default: 15000ms (15s), enforced max: 60000ms (60s)
}

export type ShellExecuteResult = {
  success: boolean
  stdout: string
  stderr: string
  exitCode: number
  error?: string
}

interface PathValidationResult {
  valid: boolean
  normalizedPath?: string
  error?: string
}

interface CommandAnalysis {
  isDangerous: boolean
  dangersDetected: string[]
  hasForbiddenOperators: boolean
  blockedCommand?: string  // e.g., "rm", "mv", "format" - if set, command is blocked
}

// Path validation with symlink resolution
export function validateWorkingDirectory(cwd: string, projectPath: string): PathValidationResult {
  try {
    // Resolve symlinks to real paths
    const realCwd = realpathSync(cwd)
    const realProject = realpathSync(projectPath)

    // Ensure trailing separator for safe prefix matching
    const projectPrefix = realProject.endsWith(sep) ? realProject : realProject + sep
    const cwdWithSep = realCwd.endsWith(sep) ? realCwd : realCwd + sep

    // Check if cwd is within project (or equals project)
    if (realCwd === realProject || cwdWithSep.startsWith(projectPrefix)) {
      return { valid: true, normalizedPath: realCwd }
    }

    return {
      valid: false,
      error: `Working directory ${cwd} is outside project directory ${projectPath}`
    }
  } catch (error: any) {
    return {
      valid: false,
      error: `Invalid path: ${error.message}`
    }
  }
}

// Blocked file operation commands (Unix + PowerShell)
const blockedFileCommands = [
  // Delete commands
  { regex: /\b(rm|rmdir)\b/i, command: 'rm' },
  { regex: /\b(Remove-Item|del|rd|ri)\b/i, command: 'Remove-Item' },
  // Move commands
  { regex: /\b(mv)\b/i, command: 'mv' },
  { regex: /\b(Move-Item|mi)\b/i, command: 'Move-Item' },
]

// Command analysis for dangerous patterns
export function analyzeCommand(command: string, restrictToPath?: string): CommandAnalysis {
  const dangersDetected: string[] = []
  let isDangerous = false
  let blockedCommand: string | undefined

  // In project context, block file operation commands
  if (restrictToPath) {
    for (const blocked of blockedFileCommands) {
      if (blocked.regex.test(command)) {
        blockedCommand = blocked.command
        break
      }
    }
  }

  // Check for dangerous patterns that warrant confirmation
  const dangerousPatterns = [
    { regex: /\brm\b.*-[rf]+/i, description: 'recursive file deletion (rm -rf)' },
    { regex: /\bdd\b/i, description: 'disk operations (dd)' },
    { regex: /\bformat\b/i, description: 'format command' },
    { regex: /\bmkfs\b/i, description: 'filesystem creation (mkfs)' },
    { regex: /\bfdisk\b/i, description: 'disk partitioning (fdisk)' },
    { regex: /:\(\)\{.*:\|:.*\};:/i, description: 'fork bomb' },
    { regex: />\s*\/dev\/sd/i, description: 'direct disk write' },
    { regex: /\bcurl\b.*\|\s*(bash|sh)/i, description: 'piped execution from remote source' },
    { regex: /\bwget\b.*\|\s*(bash|sh)/i, description: 'piped execution from remote source' },
    { regex: /\bsudo\b/i, description: 'privilege escalation (sudo)' },
    { regex: /\bsu\b/i, description: 'user switching (su)' },
    { regex: /\bchmod\b.*[+\\-]x/i, description: 'making files executable' },
  ]

  for (const pattern of dangerousPatterns) {
    if (pattern.regex.test(command)) {
      isDangerous = true
      dangersDetected.push(pattern.description)
    }
  }

  // Check for forbidden operators (&&, ||, ;)
  // Allow pipes (|) and redirects (>, >>)
  const forbiddenOperators = /(&&|\|\||;(?!\s*$))/
  const hasForbiddenOperators = forbiddenOperators.test(command)

  if (hasForbiddenOperators) {
    dangersDetected.push('command chaining operators (&&, ||, ;)')
  }

  return {
    isDangerous: isDangerous || hasForbiddenOperators,
    dangersDetected,
    hasForbiddenOperators,
    blockedCommand
  }
}

export const getShellInfo = (): ShellInfo => {
  if (process.platform === 'win32') {
    return { shell: 'powershell', platform: 'win32' }
  }
  return {
    shell: process.env.SHELL || '/bin/bash',
    platform: process.platform as 'darwin' | 'linux'
  }
}

export const executeCommand = async (params: ShellExecuteParams): Promise<ShellExecuteResult> => {
  const { command, restrictToPath, timeoutMs = 15000 } = params
  let { cwd } = params

  // Validate working directory if restriction is enabled
  if (restrictToPath) {
    const validation = validateWorkingDirectory(cwd, restrictToPath)
    if (!validation.valid) {
      return {
        success: false,
        stdout: '',
        stderr: validation.error || 'Invalid working directory',
        exitCode: 1,
      }
    }
    // Use validated path
    cwd = validation.normalizedPath!
  }

  if (process.platform === 'win32') {
    return await executeWindows(command, cwd, timeoutMs)
  } else {
    return await executeUnix(command, cwd, timeoutMs)
  }
}

const executeUnix = async (command: string, cwd: string, timeoutMs: number): Promise<ShellExecuteResult> => {
  try {
    const { stdout, stderr } = await execAsync(command, {
      cwd,
      shell: process.env.SHELL || '/bin/bash',
      timeout: timeoutMs,
      maxBuffer: 1024 * 1024, // 1MB
      killSignal: 'SIGTERM'
    })

    return {
      success: true,
      stdout: stdout || '',
      stderr: stderr || '',
      exitCode: 0
    }
  } catch (error: any) {
    // Check if error is due to timeout
    const isTimeout = error.killed && error.signal === 'SIGTERM'
    const errorMsg = isTimeout
      ? `Command timed out after ${timeoutMs}ms and was terminated`
      : error.message

    return {
      success: false,
      stdout: error.stdout || '',
      stderr: error.stderr || '',
      exitCode: error.code || (isTimeout ? 124 : 1), // 124 is standard timeout exit code
      error: errorMsg
    }
  }
}

const executeWindows = async (command: string, cwd: string, timeoutMs: number): Promise<ShellExecuteResult> => {
  return new Promise((resolve) => {
    // PowerShell library doesn't support cwd option, so we prepend Set-Location
    // Escape single quotes in path by doubling them
    const escapedCwd = cwd.replace(/'/g, "''")
    const fullCommand = `Set-Location -LiteralPath '${escapedCwd}'; ${command}`
    const ps = new PowerShell(fullCommand)
    let stdout = ''
    let stderr = ''
    let isTimedOut = false
    let hasEnded = false

    // Set up timeout
    const timeoutHandle = setTimeout(() => {
      if (!hasEnded) {
        isTimedOut = true
        ps.dispose() // Kill the PowerShell process
        resolve({
          success: false,
          stdout,
          stderr,
          exitCode: 124, // Standard timeout exit code
          error: `Command timed out after ${timeoutMs}ms and was terminated`
        })
      }
    }, timeoutMs)

    ps.on('output', (data: string) => {
      stdout += data
    })

    ps.on('error-output', (data: string) => {
      stderr += data
    })

    ps.on('error', (err: any) => {
      hasEnded = true
      clearTimeout(timeoutHandle)
      if (!isTimedOut) {
        resolve({
          success: false,
          stdout,
          stderr,
          exitCode: 1,
          error: err.message
        })
      }
    })

    ps.on('end', (code: number) => {
      hasEnded = true
      clearTimeout(timeoutHandle)
      if (!isTimedOut) {
        resolve({
          success: code === 0,
          stdout,
          stderr,
          exitCode: code || 0
        })
      }
    })
  })
}
