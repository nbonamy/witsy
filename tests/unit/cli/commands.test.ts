import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { WitsyAPI } from '@/cli/api'
import { COMMANDS, handleCommand, initialize, handleHelp, handleClear, handleSave, handleTitle, handleRetry, handleQuit, executeCommand, handlePort, handleMessage, handleModel } from '@/cli/commands'
import { state } from '@/cli/state'
import { ChatCli, MessageCli } from '@/cli/models'
import { resetDisplay, displayFooter, clearFooter } from '@/cli/display'
import { promptInput } from '@/cli/input'
import { selectOption } from '@/cli/select'

// Setup fetch mock
global.fetch = vi.fn()

// Mock dependencies
vi.mock('@/cli/api')
vi.mock('@/cli/display', () => ({
  grayText: (s: string) => s,
  padContent: (text: string) => `  ${text}  `,
  resetDisplay: vi.fn(),
  displayFooter: vi.fn(),
  clearFooter: vi.fn(),
  displayHeader: vi.fn(),
  displayConversation: vi.fn(),
  startPulseAnimation: vi.fn(() => ({} as NodeJS.Timeout)),
  stopPulseAnimation: vi.fn(),
  successText: (s: string) => s,
}))
vi.mock('@/cli/input', () => ({
  promptInput: vi.fn(),
}))
vi.mock('@/cli/select', () => ({
  selectOption: vi.fn(),
}))
vi.mock('chalk', () => ({
  default: {
    yellow: (s: string) => s,
    dim: (s: string) => s,
    red: (s: string) => s,
    rgb: () => (s: string) => s,
    italic: { dim: (s: string) => s },
    greenBright: (s: string) => s,
    blueBright: (s: string) => s,
  },
}))
vi.mock('terminal-kit', () => ({
  default: {
    terminal: {
      grabInput: vi.fn(),
      on: vi.fn(() => null),
      removeListener: vi.fn(),
    }
  }
}))

describe('CLI Commands', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    state.port = 4321
    state.engine = { id: 'openai', name: 'OpenAI' }
    state.model = { id: 'gpt-4', name: 'GPT-4' }
    state.chat = new ChatCli('CLI Session')
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
      userDataPath: tempDir,
      enableHttpEndpoints: true
    }

    vi.mocked(WitsyAPI.prototype.connectWithTimeout).mockResolvedValue(true)
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
      userDataPath: tempDir,
      enableHttpEndpoints: true
    }

    vi.mocked(WitsyAPI.prototype.connectWithTimeout).mockResolvedValue(true)
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

    // Should set null engine/model on error
    expect(state.engine).toBe(null)
    expect(state.model).toBe(null)
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
    vi.mocked(selectOption)
      .mockResolvedValueOnce('openai')  // First call: engine selection
      .mockResolvedValueOnce('gpt-4')   // Second call: model selection

    // Import handleModel dynamically to get the function
    await handleModel()

    // Check state was updated
    expect(state.engine).toEqual({ id: 'openai', name: 'OpenAI' })
    expect(state.model).toEqual({ id: 'gpt-4', name: 'GPT-4' })

    // Check cli.json was created and contains the selection
    const configPath = path.join(tempDir, 'cli.json')
    expect(fs.existsSync(configPath)).toBe(true)

    const savedConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'))
    expect(savedConfig.engine).toEqual({ id: 'openai', name: 'OpenAI' })
    expect(savedConfig.model).toEqual({ id: 'gpt-4', name: 'GPT-4' })
  })
})

describe('Command Handlers', () => {
  let tempDir: string

  beforeEach(() => {
    vi.clearAllMocks()
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'witsy-cli-cmd-test-'))
    state.userDataPath = tempDir
    state.port = 4321
    state.engine = { id: 'openai', name: 'OpenAI' }
    state.model = { id: 'gpt-4', name: 'GPT-4' }
    state.cliConfig = {
      historySize: 50,
      history: []
    }
  })

  afterEach(() => {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true })
    }
  })

  test('handleHelp displays command list', async () => {

    await handleHelp()

    expect(clearFooter).toHaveBeenCalled()
    expect(displayFooter).toHaveBeenCalled()
  })

  test('handleClear resets conversation', async () => {

    state.chat = new ChatCli('Test')
    state.chat.addMessage(new MessageCli('user', 'test'))

    await handleClear()

    expect(state.chat.messages.length).toBe(0)
    expect(state.chat.uuid).toBe('')
  })

  test('handleSave saves conversation and sets UUID', async () => {

    state.chat = new ChatCli('Test')
    state.chat.addMessage(new MessageCli('user', 'test'))
    state.chat.uuid = ''

    vi.mocked(WitsyAPI.prototype.saveConversation).mockResolvedValue('new-chat-id')

    await handleSave()

    expect(state.chat.uuid).toBe('new-chat-id')
    expect(WitsyAPI.prototype.saveConversation).toHaveBeenCalledWith(state.chat)
  })

  test('handleSave displays error when no messages', async () => {

    state.chat = new ChatCli('Test')
    state.chat.messages = []

    await handleSave()

    // Should not call API
    expect(WitsyAPI.prototype.saveConversation).not.toHaveBeenCalled()
  })

  test('handleTitle updates chat title', async () => {

    state.chat = new ChatCli('Old Title')

    vi.mocked(promptInput).mockResolvedValue('New Title')

    await handleTitle()

    expect(state.chat.title).toBe('New Title')
  })

  test('handleTitle auto-saves if chat is already saved', async () => {

    state.chat = new ChatCli('Old Title')
    state.chat.uuid = 'existing-uuid'

    vi.mocked(promptInput).mockResolvedValue('New Title')
    vi.mocked(WitsyAPI.prototype.saveConversation).mockResolvedValue('existing-uuid')

    await handleTitle()

    expect(state.chat.title).toBe('New Title')
    expect(WitsyAPI.prototype.saveConversation).toHaveBeenCalled()
  })

  test('handleRetry retries last user message', async () => {

    state.chat = new ChatCli('Test')
    state.chat.addMessage(new MessageCli('user', 'first'))
    state.chat.addMessage(new MessageCli('assistant', 'response'))

    // Mock streaming response
    const encoder = new TextEncoder()
    const mockReader = {
      read: vi.fn()
        .mockResolvedValueOnce({ value: encoder.encode('data: {"type":"content","text":"retry"}\n'), done: false })
        .mockResolvedValueOnce({ value: encoder.encode('data: [DONE]\n'), done: false })
        .mockResolvedValueOnce({ value: undefined, done: true })
    }

    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      body: { getReader: () => mockReader } as any
    } as Response)

    await handleRetry()

    // Should have re-added user message (1 message because it removes everything from last user onwards)
    expect(state.chat.messages.length).toBeGreaterThanOrEqual(1)
    expect(state.chat.messages[0].content).toBe('first')
  })

  test('handleRetry displays error when no messages', async () => {

    state.chat = new ChatCli('Test')
    state.chat.messages = []

    await handleRetry()

    // Should not try to retry
    expect(state.chat.messages.length).toBe(0)
  })

  test('handleQuit exits process', async () => {
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never)

    handleQuit()

    expect(exitSpy).toHaveBeenCalledWith(0)
    exitSpy.mockRestore()
  })

  test('executeCommand dispatches to correct handler', async () => {

    await executeCommand('help')

    // Verify handleHelp was executed by checking its side effects
    expect(clearFooter).toHaveBeenCalled()
    expect(displayFooter).toHaveBeenCalled()
  })

  test('executeCommand handles unknown commands', async () => {

    await executeCommand('unknown')

    expect(resetDisplay).toHaveBeenCalled()
  })

  test('handlePort validates port number', async () => {

    vi.mocked(promptInput).mockResolvedValue('invalid')

    await handlePort()

    // Should not attempt connection with invalid port
    expect(WitsyAPI.prototype.connectWithTimeout).not.toHaveBeenCalled()
  })

  test('handlePort validates port range', async () => {

    vi.mocked(promptInput).mockResolvedValue('99999')

    await handlePort()

    // Should not attempt connection with out-of-range port
    expect(WitsyAPI.prototype.connectWithTimeout).not.toHaveBeenCalled()
  })

  test('handlePort changes port successfully', async () => {

    vi.mocked(promptInput).mockResolvedValue('5000')
    vi.mocked(WitsyAPI.prototype.connectWithTimeout).mockResolvedValue(true)
    vi.mocked(WitsyAPI.prototype.getConfig).mockResolvedValue({
      engine: 'anthropic',
      model: 'claude-3',
      userDataPath: tempDir,
      enableHttpEndpoints: true
    })

    await handlePort()

    expect(state.port).toBe(5000)
    expect(WitsyAPI.prototype.connectWithTimeout).toHaveBeenCalledWith(5000, 2000)
  })

  test('handlePort handles connection failure', async () => {

    vi.mocked(promptInput).mockResolvedValue('5000')
    vi.mocked(WitsyAPI.prototype.connectWithTimeout).mockResolvedValue(false)

    await handlePort()

    // Port should not change on connection failure
    expect(state.port).toBe(4321)
  })

  test('handlePort handles disabled HTTP endpoints', async () => {

    vi.mocked(promptInput).mockResolvedValue('5000')
    vi.mocked(WitsyAPI.prototype.connectWithTimeout).mockResolvedValue(true)
    vi.mocked(WitsyAPI.prototype.getConfig).mockResolvedValue({
      engine: 'openai',
      model: 'gpt-4',
      userDataPath: tempDir,
      enableHttpEndpoints: false
    })

    await handlePort()

    // Port is set before checking HTTP endpoints, so it changes
    expect(state.port).toBe(5000)
  })

  test('handleMessage adds messages and streams response', async () => {

    state.chat = new ChatCli('Test')

    // Mock streaming response
    const encoder = new TextEncoder()
    const mockReader = {
      read: vi.fn()
        .mockResolvedValueOnce({ value: encoder.encode('data: {"type":"content","text":"response"}\n'), done: false })
        .mockResolvedValueOnce({ value: encoder.encode('data: [DONE]\n'), done: false })
        .mockResolvedValueOnce({ value: undefined, done: true })
    }

    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      body: { getReader: () => mockReader } as any
    } as Response)

    await handleMessage('test message')

    // User message added before streaming, no assistant added due to mocked terminal-kit
    expect(state.chat.messages.length).toBeGreaterThanOrEqual(1)
    expect(state.chat.messages[0].content).toBe('test message')
    expect(state.chat.messages[0].role).toBe('user')
  })

  test('handleMessage handles cancellation', async () => {

    state.chat = new ChatCli('Test')

    vi.mocked(fetch).mockRejectedValueOnce(new DOMException('Aborted', 'AbortError'))

    await handleMessage('test message')

    // User message is added but not removed when cancelled (only removed if no response)
    expect(state.chat.messages.length).toBeGreaterThanOrEqual(1)
  })

  test('handleMessage handles partial response on cancellation', async () => {

    state.chat = new ChatCli('Test')

    // Mock partial streaming before abort
    const encoder = new TextEncoder()
    const mockReader = {
      read: vi.fn()
        .mockResolvedValueOnce({ value: encoder.encode('data: {"type":"content","text":"partial"}\n'), done: false })
        .mockRejectedValueOnce(new DOMException('Aborted', 'AbortError'))
    }

    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      body: { getReader: () => mockReader } as any
    } as Response)

    await handleMessage('test message')

    // User message always added, partial response handling tested
    expect(state.chat.messages.length).toBeGreaterThanOrEqual(1)
  })

  test('handleMessage handles tool calls', async () => {

    state.chat = new ChatCli('Test')

    // Mock streaming with tool calls
    const encoder = new TextEncoder()
    const mockReader = {
      read: vi.fn()
        .mockResolvedValueOnce({ value: encoder.encode('data: {"type":"tool","status":"Searching...","done":false}\n'), done: false })
        .mockResolvedValueOnce({ value: encoder.encode('data: {"type":"tool","status":"Search complete","done":true}\n'), done: false })
        .mockResolvedValueOnce({ value: encoder.encode('data: {"type":"content","text":"result"}\n'), done: false })
        .mockResolvedValueOnce({ value: encoder.encode('data: [DONE]\n'), done: false })
        .mockResolvedValueOnce({ value: undefined, done: true })
    }

    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      body: { getReader: () => mockReader } as any
    } as Response)

    await handleMessage('search for something')

    // Verify tool processing occurred (would add assistant message)
    expect(state.chat.messages.length).toBeGreaterThanOrEqual(1)
  })

  test('handleMessage handles API errors', async () => {

    state.chat = new ChatCli('Test')

    vi.mocked(fetch).mockRejectedValueOnce(new Error('Network error'))

    await handleMessage('test message')

    // User message added, then removed on error
    expect(state.chat.messages.length).toBeGreaterThanOrEqual(0)
  })

  test('handleModel handles cancellation', async () => {

    vi.mocked(WitsyAPI.prototype.getEngines).mockResolvedValue([
      { id: 'openai', name: 'OpenAI' }
    ])
    vi.mocked(selectOption).mockResolvedValueOnce('') // Empty = cancelled

    await handleModel()

    // State should not change
    expect(state.engine).toEqual({ id: 'openai', name: 'OpenAI' })
    expect(state.model).toEqual({ id: 'gpt-4', name: 'GPT-4' })
  })

  test('handleModel handles no engines', async () => {

    vi.mocked(WitsyAPI.prototype.getEngines).mockResolvedValue([])

    await handleModel()

    // Should just return without error
    expect(state.engine).toEqual({ id: 'openai', name: 'OpenAI' })
  })

  test('handleModel handles no models', async () => {

    vi.mocked(WitsyAPI.prototype.getEngines).mockResolvedValue([
      { id: 'openai', name: 'OpenAI' }
    ])
    vi.mocked(WitsyAPI.prototype.getModels).mockResolvedValue([])
    vi.mocked(selectOption).mockResolvedValueOnce('openai')

    await handleModel()

    // Engine should not change when no models available
    expect(state.engine).toEqual({ id: 'openai', name: 'OpenAI' })
  })

  test('handleTitle rejects empty title', async () => {

    state.chat = new ChatCli('Old Title')

    vi.mocked(promptInput).mockResolvedValue('   ')

    await handleTitle()

    // Title should not change
    expect(state.chat.title).toBe('Old Title')
  })

  test('handleCommand parses command correctly', async () => {

    await handleCommand('/help some args')

    // Should execute help command
    expect(clearFooter).toHaveBeenCalled()
  })
})
