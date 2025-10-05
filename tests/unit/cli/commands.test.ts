import { describe, expect, test, vi, beforeEach, afterEach } from 'vitest'
import { handleCommand, COMMANDS, initialize } from '../../../src/cli/commands'
import { state } from '../../../src/cli/state'
import { WitsyAPI } from '../../../src/cli/api'
import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'

// Mock dependencies
vi.mock('../../../src/cli/api')
vi.mock('../../../src/cli/display', () => ({
  displayFooter: vi.fn(),
  clearFooter: vi.fn(),
  displayHeader: vi.fn(),
  displayConversation: vi.fn(),
}))
vi.mock('../../../src/cli/input', () => ({
  promptInput: vi.fn(),
}))
vi.mock('../../../src/cli/select', () => ({
  selectOption: vi.fn(),
}))
vi.mock('chalk', () => ({
  default: {
    yellow: (s: string) => s,
    dim: (s: string) => s,
    red: (s: string) => s,
    rgb: () => (s: string) => s,
  },
}))

describe('CLI Commands', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    state.port = 4321
    state.engine = 'openai'
    state.model = 'gpt-4'
  })

  test('COMMANDS constant has expected structure', () => {
    expect(COMMANDS).toBeDefined()
    expect(Array.isArray(COMMANDS)).toBe(true)
    expect(COMMANDS.length).toBeGreaterThan(0)

    COMMANDS.forEach(cmd => {
      expect(cmd).toHaveProperty('name')
      expect(cmd).toHaveProperty('value')
      expect(cmd).toHaveProperty('description')
      expect(cmd.name).toMatch(/^\//)
    })
  })

  test('COMMANDS includes essential commands', () => {
    const commandNames = COMMANDS.map(cmd => cmd.name)
    expect(commandNames).toContain('/help')
    expect(commandNames).toContain('/exit')
    expect(commandNames).toContain('/clear')
  })

  test('handleCommand is a function', () => {
    expect(typeof handleCommand).toBe('function')
  })
})

describe('CLI Initialization', () => {
  let tempDir: string

  beforeEach(() => {
    vi.clearAllMocks()
    // Create temp directory for test config
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'witsy-cli-init-test-'))
  })

  afterEach(() => {
    // Clean up temp directory
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true })
    }
  })

  test('initialize loads config from API and merges with CLI config', async () => {
    // Mock API response
    const mockApiConfig = {
      engine: 'anthropic',
      model: 'claude-3',
      userDataPath: tempDir
    }

    vi.mocked(WitsyAPI.prototype.getConfig).mockResolvedValue(mockApiConfig)

    // Create CLI config with different engine/model
    const cliConfigData = {
      engine: 'openai',
      model: 'gpt-4',
      historySize: 100,
      history: ['old command']
    }

    fs.writeFileSync(
      path.join(tempDir, 'cli.json'),
      JSON.stringify(cliConfigData),
      'utf-8'
    )

    await initialize()

    // CLI config should override API config
    expect(state.engine).toBe('openai')
    expect(state.model).toBe('gpt-4')
    expect(state.userDataPath).toBe(tempDir)
    expect(state.cliConfig).toEqual(cliConfigData)
  })

  test('initialize falls back to API config when CLI config is empty', async () => {
    // Mock API response
    const mockApiConfig = {
      engine: 'anthropic',
      model: 'claude-3',
      userDataPath: tempDir
    }

    vi.mocked(WitsyAPI.prototype.getConfig).mockResolvedValue(mockApiConfig)

    // No CLI config file exists

    await initialize()

    // Should use API config
    expect(state.engine).toBe('anthropic')
    expect(state.model).toBe('claude-3')
    expect(state.userDataPath).toBe(tempDir)
    expect(state.cliConfig).toEqual({
      engine: 'anthropic',
      model: 'claude-3',
      historySize: 50,
      history: []
    })

    // Should have created cli.json with the API config values
    const configPath = path.join(tempDir, 'cli.json')
    expect(fs.existsSync(configPath)).toBe(true)
    const saved = JSON.parse(fs.readFileSync(configPath, 'utf-8'))
    expect(saved.engine).toBe('anthropic')
    expect(saved.model).toBe('claude-3')
  })

  test('initialize handles API errors gracefully', async () => {
    vi.mocked(WitsyAPI.prototype.getConfig).mockRejectedValue(new Error('Network error'))

    await initialize()

    // Should set empty engine/model on error
    expect(state.engine).toBe('')
    expect(state.model).toBe('')
  })
})

describe('/model Command Persistence', () => {
  let tempDir: string

  beforeEach(() => {
    vi.clearAllMocks()
    // Create temp directory for test config
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'witsy-cli-model-test-'))

    // Setup state with userDataPath and cliConfig
    state.userDataPath = tempDir
    state.cliConfig = {
      historySize: 50,
      history: []
    }
  })

  afterEach(() => {
    // Clean up temp directory
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true })
    }
  })

  test('handleModel persists engine and model selection to cli.json', async () => {
    // Mock API responses
    const mockEngines = [
      { id: 'openai', name: 'OpenAI' },
      { id: 'anthropic', name: 'Anthropic' }
    ]
    const mockModels = [
      { id: 'gpt-4', name: 'GPT-4' },
      { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo' }
    ]

    vi.mocked(WitsyAPI.prototype.getEngines).mockResolvedValue(mockEngines)
    vi.mocked(WitsyAPI.prototype.getModels).mockResolvedValue(mockModels)

    // Mock selectOption to return specific choices
    const { selectOption } = await import('../../../src/cli/select')
    vi.mocked(selectOption)
      .mockResolvedValueOnce('openai')  // First call: engine selection
      .mockResolvedValueOnce('gpt-4')   // Second call: model selection

    // Import handleModel dynamically to get the function
    const { handleModel } = await import('../../../src/cli/commands')
    await handleModel()

    // Check state was updated
    expect(state.engine).toBe('openai')
    expect(state.model).toBe('gpt-4')

    // Check cli.json was created and contains the selection
    const configPath = path.join(tempDir, 'cli.json')
    expect(fs.existsSync(configPath)).toBe(true)

    const savedConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'))
    expect(savedConfig.engine).toBe('openai')
    expect(savedConfig.model).toBe('gpt-4')
  })
})
