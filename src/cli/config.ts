// CLI configuration persistence

import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'

import { WorkDirAccess } from './state'

/**
 * Get the default user data path (same as Electron's app.getPath('userData'))
 * This allows reading cli.json before connecting to the API
 */
export function getDefaultUserDataPath(): string {
  const home = os.homedir()
  switch (process.platform) {
    case 'darwin':
      return path.join(home, 'Library', 'Application Support', 'Witsy')
    case 'win32':
      return path.join(process.env.APPDATA || path.join(home, 'AppData', 'Roaming'), 'Witsy')
    default:
      return path.join(process.env.XDG_CONFIG_HOME || path.join(home, '.config'), 'Witsy')
  }
}

export interface WorkDirConfig {
  access: WorkDirAccess
}

export interface CliConfig {
  port?: number
  engine?: { id: string; name: string }
  model?: { id: string; name: string }
  historySize: number
  history: string[]
  workDirs?: Record<string, WorkDirConfig>  // path -> config
}

const DEFAULT_CONFIG: CliConfig = {
  historySize: 50,
  history: []
}

/**
 * Load CLI configuration from userData/cli.json
 * Returns default config if file doesn't exist or is invalid
 */
export function loadCliConfig(userDataPath: string): CliConfig {
  const configPath = path.join(userDataPath, 'cli.json')

  try {
    if (!fs.existsSync(configPath)) {
      return { ...DEFAULT_CONFIG }
    }

    const data = fs.readFileSync(configPath, 'utf-8')
    const parsed = JSON.parse(data)

    // Merge with defaults to ensure all required fields exist
    return {
      ...DEFAULT_CONFIG,
      ...parsed,
      // Ensure historySize is valid
      historySize: typeof parsed.historySize === 'number' && parsed.historySize > 0
        ? parsed.historySize
        : DEFAULT_CONFIG.historySize,
      // Ensure history is an array
      history: Array.isArray(parsed.history) ? parsed.history : []
    }
  } catch (error) {
    console.error('Error loading CLI config:', error)
    return { ...DEFAULT_CONFIG }
  }
}

/**
 * Save CLI configuration to userData/cli.json
 */
export function saveCliConfig(userDataPath: string, config: CliConfig): void {
  const configPath = path.join(userDataPath, 'cli.json')

  try {
    // Ensure history doesn't exceed historySize
    const truncatedHistory = config.history.slice(-config.historySize)

    const toSave: CliConfig = {
      ...config,
      history: truncatedHistory
    }

    fs.writeFileSync(configPath, JSON.stringify(toSave, null, 2), 'utf-8')
  } catch (error) {
    console.error('Error saving CLI config:', error)
  }
}
