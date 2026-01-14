import { describe, expect, test, beforeEach, afterEach } from 'vitest'
import { loadCliConfig, saveCliConfig, getDefaultUserDataPath, CliConfig } from '@/cli/config'
import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'

describe('CLI Config', () => {
  let tempDir: string

  beforeEach(() => {
    // Create a temporary directory for tests
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'witsy-cli-test-'))
  })

  afterEach(() => {
    // Clean up temporary directory
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true })
    }
  })

  describe('loadCliConfig', () => {
    test('returns default config when file does not exist', () => {
      const config = loadCliConfig(tempDir)

      expect(config).toEqual({
        historySize: 50,
        history: []
      })
    })

    test('loads config from file', () => {
      const savedConfig: CliConfig = {
        engine: 'openai',
        model: 'gpt-4',
        historySize: 100,
        history: ['command1', 'command2']
      }

      fs.writeFileSync(
        path.join(tempDir, 'cli.json'),
        JSON.stringify(savedConfig),
        'utf-8'
      )

      const config = loadCliConfig(tempDir)

      expect(config).toEqual(savedConfig)
    })

    test('loads config with port', () => {
      const savedConfig: CliConfig = {
        port: 9000,
        historySize: 50,
        history: []
      }

      fs.writeFileSync(
        path.join(tempDir, 'cli.json'),
        JSON.stringify(savedConfig),
        'utf-8'
      )

      const config = loadCliConfig(tempDir)

      expect(config.port).toBe(9000)
    })

    test('merges with defaults when fields are missing', () => {
      const partialConfig = {
        engine: 'openai'
      }

      fs.writeFileSync(
        path.join(tempDir, 'cli.json'),
        JSON.stringify(partialConfig),
        'utf-8'
      )

      const config = loadCliConfig(tempDir)

      expect(config).toEqual({
        engine: 'openai',
        historySize: 50,
        history: []
      })
    })

    test('uses default historySize when invalid', () => {
      const invalidConfig = {
        historySize: -10,
        history: []
      }

      fs.writeFileSync(
        path.join(tempDir, 'cli.json'),
        JSON.stringify(invalidConfig),
        'utf-8'
      )

      const config = loadCliConfig(tempDir)

      expect(config.historySize).toBe(50)
    })

    test('uses empty array when history is not an array', () => {
      const invalidConfig = {
        historySize: 50,
        history: 'not an array'
      }

      fs.writeFileSync(
        path.join(tempDir, 'cli.json'),
        JSON.stringify(invalidConfig),
        'utf-8'
      )

      const config = loadCliConfig(tempDir)

      expect(config.history).toEqual([])
    })

    test('returns default config when JSON is invalid', () => {
      fs.writeFileSync(
        path.join(tempDir, 'cli.json'),
        'invalid json{',
        'utf-8'
      )

      const config = loadCliConfig(tempDir)

      expect(config).toEqual({
        historySize: 50,
        history: []
      })
    })
  })

  describe('saveCliConfig', () => {
    test('saves config to file', () => {
      const config: CliConfig = {
        engine: 'openai',
        model: 'gpt-4',
        historySize: 100,
        history: ['command1', 'command2']
      }

      saveCliConfig(tempDir, config)

      const filePath = path.join(tempDir, 'cli.json')
      expect(fs.existsSync(filePath)).toBe(true)

      const saved = JSON.parse(fs.readFileSync(filePath, 'utf-8'))
      expect(saved).toEqual(config)
    })

    test('truncates history to historySize', () => {
      const config: CliConfig = {
        historySize: 3,
        history: ['cmd1', 'cmd2', 'cmd3', 'cmd4', 'cmd5']
      }

      saveCliConfig(tempDir, config)

      const filePath = path.join(tempDir, 'cli.json')
      const saved = JSON.parse(fs.readFileSync(filePath, 'utf-8'))

      expect(saved.history).toEqual(['cmd3', 'cmd4', 'cmd5'])
      expect(saved.history.length).toBe(3)
    })

    test('keeps all history when under historySize', () => {
      const config: CliConfig = {
        historySize: 10,
        history: ['cmd1', 'cmd2', 'cmd3']
      }

      saveCliConfig(tempDir, config)

      const filePath = path.join(tempDir, 'cli.json')
      const saved = JSON.parse(fs.readFileSync(filePath, 'utf-8'))

      expect(saved.history).toEqual(['cmd1', 'cmd2', 'cmd3'])
    })

    test('creates file with pretty formatting', () => {
      const config: CliConfig = {
        engine: 'openai',
        historySize: 50,
        history: []
      }

      saveCliConfig(tempDir, config)

      const filePath = path.join(tempDir, 'cli.json')
      const content = fs.readFileSync(filePath, 'utf-8')

      // Check it's formatted (has newlines and indentation)
      expect(content).toContain('\n')
      expect(content).toContain('  ')
    })

    test('saves config with port', () => {
      const config: CliConfig = {
        port: 9000,
        historySize: 50,
        history: []
      }

      saveCliConfig(tempDir, config)

      const filePath = path.join(tempDir, 'cli.json')
      const saved = JSON.parse(fs.readFileSync(filePath, 'utf-8'))

      expect(saved.port).toBe(9000)
    })

    test('saves config without port when undefined', () => {
      const config: CliConfig = {
        historySize: 50,
        history: []
      }

      saveCliConfig(tempDir, config)

      const filePath = path.join(tempDir, 'cli.json')
      const saved = JSON.parse(fs.readFileSync(filePath, 'utf-8'))

      expect(saved.port).toBeUndefined()
    })
  })

  describe('getDefaultUserDataPath', () => {
    test('returns path based on platform', () => {
      const userDataPath = getDefaultUserDataPath()
      const home = os.homedir()

      // Should return a path containing 'Witsy'
      expect(userDataPath).toContain('Witsy')

      // Should be under home directory
      if (process.platform === 'darwin') {
        expect(userDataPath).toBe(path.join(home, 'Library', 'Application Support', 'Witsy'))
      } else if (process.platform === 'win32') {
        expect(userDataPath).toContain('Witsy')
      } else {
        // Linux
        expect(userDataPath).toContain('Witsy')
      }
    })
  })
})
