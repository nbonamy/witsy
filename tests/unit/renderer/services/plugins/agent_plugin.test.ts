
import { vi, beforeAll, beforeEach, expect, test, describe } from 'vitest'
import { useWindowMock } from '@tests/mocks/window'
import AgentPlugin, { AgentStorage } from '@services/plugins/agent'
import { Agent, AgentRun } from 'types/agents'
import { Configuration } from 'types/config'
import Message from '@models/message'
import enMessages from '@root/locales/en.json'

// Mock the agent_utils module
vi.mock('@services/agent_utils', () => ({
  createAgentExecutor: vi.fn(() => ({
    run: vi.fn(),
  })),
}))

import { createAgentExecutor } from '@services/agent_utils'

beforeAll(async () => {
  useWindowMock()

  // Mock i18n messages
  window.api.config.getI18nMessages = vi.fn(() => ({ en: enMessages }))

  // Re-initialize i18n with actual messages
  const { initI18n } = await import('@services/i18n')
  initI18n()
})

beforeEach(() => {
  vi.clearAllMocks()
})

const createMockConfig = (): Configuration => ({
  general: {},
  llm: { engine: 'openai' },
  engines: {},
  plugins: {},
} as Configuration)

const createMockAgent = (overrides: Partial<Agent> = {}): Agent => ({
  uuid: 'test-agent',
  name: 'Test Agent',
  description: 'A test agent that does things',
  engine: 'openai',
  model: 'gpt-4',
  parameters: [],
  steps: [{ prompt: 'Do something with {{input}}' }],
  ...overrides,
} as Agent)

const createMockRun = (overrides: Partial<AgentRun> = {}): AgentRun => ({
  uuid: 'run-123',
  agentId: 'test-agent',
  status: 'success',
  messages: [
    new Message('system', 'System message'),
    new Message('user', 'User input'),
    new Message('assistant', 'Final result'),
  ],
  ...overrides,
} as AgentRun)

describe('AgentPlugin', () => {
  test('isEnabled returns true', () => {
    const plugin = new AgentPlugin(
      createMockConfig(),
      'workspace1',
      createMockAgent(),
      'openai',
      'gpt-4',
    )
    expect(plugin.isEnabled()).toBe(true)
  })

  test('getName returns formatted agent name', () => {
    const plugin = new AgentPlugin(
      createMockConfig(),
      'workspace1',
      createMockAgent({ name: 'My Test Agent' }),
      'openai',
      'gpt-4',
    )
    expect(plugin.getName()).toBe('agent_my_test_agent')
  })

  test('getDescription returns agent description', () => {
    const plugin = new AgentPlugin(
      createMockConfig(),
      'workspace1',
      createMockAgent({ description: 'Custom description' }),
      'openai',
      'gpt-4',
    )
    expect(plugin.getDescription()).toBe('Custom description')
  })

  test('getPreparationDescription returns default message', () => {
    const plugin = new AgentPlugin(
      createMockConfig(),
      'workspace1',
      createMockAgent(),
      'openai',
      'gpt-4',
    )
    // Returns i18n key or translated string containing agent name
    const result = plugin.getPreparationDescription()
    expect(result.includes('Test Agent') || result.includes('plugins.agent')).toBe(true)
  })

  test('getPreparationDescription uses agent custom method if available', () => {
    const agent = createMockAgent()
    agent.getPreparationDescription = () => 'Custom preparation'
    const plugin = new AgentPlugin(
      createMockConfig(),
      'workspace1',
      agent,
      'openai',
      'gpt-4',
    )
    expect(plugin.getPreparationDescription()).toBe('Custom preparation')
  })

  test('getRunningDescription returns default message', () => {
    const plugin = new AgentPlugin(
      createMockConfig(),
      'workspace1',
      createMockAgent(),
      'openai',
      'gpt-4',
    )
    const result = plugin.getRunningDescription('tool', {})
    expect(result.includes('Test Agent') || result.includes('plugins.agent')).toBe(true)
  })

  test('getRunningDescription uses agent custom method if available', () => {
    const agent = createMockAgent()
    agent.getRunningDescription = () => 'Custom running'
    const plugin = new AgentPlugin(
      createMockConfig(),
      'workspace1',
      agent,
      'openai',
      'gpt-4',
    )
    expect(plugin.getRunningDescription('tool', {})).toBe('Custom running')
  })

  test('getCompletedDescription returns default message for success', () => {
    const plugin = new AgentPlugin(
      createMockConfig(),
      'workspace1',
      createMockAgent(),
      'openai',
      'gpt-4',
    )
    const result = plugin.getCompletedDescription('tool', {}, { status: 'success' })
    expect(result!.includes('Test Agent') || result!.includes('plugins.agent')).toBe(true)
  })

  test('getCompletedDescription uses agent custom method if available', () => {
    const agent = createMockAgent()
    agent.getCompletedDescription = () => 'Custom completed'
    const plugin = new AgentPlugin(
      createMockConfig(),
      'workspace1',
      agent,
      'openai',
      'gpt-4',
    )
    expect(plugin.getCompletedDescription('tool', {}, { status: 'success' })).toBe('Custom completed')
  })

  test('getCompletedDescription returns error message for error status', () => {
    const plugin = new AgentPlugin(
      createMockConfig(),
      'workspace1',
      createMockAgent(),
      'openai',
      'gpt-4',
    )
    // Note: There's a typo in the source code 'error ' with trailing space
    const result = plugin.getCompletedDescription('tool', {}, { status: 'error ', error: 'Something failed' })
    expect(result!.includes('Test Agent') || result!.includes('plugins.agent')).toBe(true)
  })

  test('getCompletedDescription uses agent custom error method if available', () => {
    const agent = createMockAgent()
    agent.getErrorDescription = () => 'Custom error'
    const plugin = new AgentPlugin(
      createMockConfig(),
      'workspace1',
      agent,
      'openai',
      'gpt-4',
    )
    expect(plugin.getCompletedDescription('tool', {}, { status: 'error ', error: 'fail' })).toBe('Custom error')
  })

  test('getParameters extracts inputs from prompt', () => {
    const plugin = new AgentPlugin(
      createMockConfig(),
      'workspace1',
      createMockAgent({ parameters: [], steps: [{ prompt: 'Process {{data}} and {{options}}' }] }),
      'openai',
      'gpt-4',
    )
    const params = plugin.getParameters()
    expect(params).toHaveLength(2)
    expect(params[0].name).toBe('data')
    expect(params[1].name).toBe('options')
  })

  test('getParameters returns defined parameters when available', () => {
    const plugin = new AgentPlugin(
      createMockConfig(),
      'workspace1',
      createMockAgent({
        parameters: [{ name: 'custom', type: 'string', description: 'Custom param', required: true }],
        steps: [{ prompt: 'Something with {{ignored}}' }],
      }),
      'openai',
      'gpt-4',
    )
    const params = plugin.getParameters()
    expect(params).toHaveLength(1)
    expect(params[0].name).toBe('custom')
  })

  test('getParameters returns prompt parameter when no prompt in step', () => {
    const plugin = new AgentPlugin(
      createMockConfig(),
      'workspace1',
      createMockAgent({ parameters: [], steps: [{ prompt: '' }] }),
      'openai',
      'gpt-4',
    )
    const params = plugin.getParameters()
    expect(params).toHaveLength(1)
    expect(params[0].name).toBe('prompt')
  })

  test('execute runs agent and returns result', async () => {
    const mockRun = createMockRun()
    const mockExecutor = { run: vi.fn().mockResolvedValue(mockRun) }
    vi.mocked(createAgentExecutor).mockReturnValue(mockExecutor as any)

    const plugin = new AgentPlugin(
      createMockConfig(),
      'workspace1',
      createMockAgent(),
      'openai',
      'gpt-4',
    )

    const result = await plugin.execute({} as any, { input: 'test' })

    expect(createAgentExecutor).toHaveBeenCalled()
    expect(mockExecutor.run).toHaveBeenCalledWith('workflow', { input: 'test' }, expect.any(Object))
    expect(result.status).toBe('success')
    expect(result.result).toBe('Final result')
  })

  test('execute stores result when storage is provided', async () => {
    const mockRun = createMockRun()
    const mockExecutor = { run: vi.fn().mockResolvedValue(mockRun) }
    vi.mocked(createAgentExecutor).mockReturnValue(mockExecutor as any)

    const mockStorage: AgentStorage = {
      store: vi.fn().mockResolvedValue('stored-key-123'),
      retrieve: vi.fn(),
    }

    const plugin = new AgentPlugin(
      createMockConfig(),
      'workspace1',
      createMockAgent(),
      'openai',
      'gpt-4',
      { storeData: true },
      mockStorage,
    )

    const result = await plugin.execute({} as any, { input: 'test' })

    expect(mockStorage.store).toHaveBeenCalledWith('Final result')
    expect(result.status).toBe('success')
    expect(result.storeId).toBe('storeId:stored-key-123')
  })

  test('execute retrieves stored values from parameters', async () => {
    const mockRun = createMockRun()
    const mockExecutor = { run: vi.fn().mockResolvedValue(mockRun) }
    vi.mocked(createAgentExecutor).mockReturnValue(mockExecutor as any)

    const mockStorage: AgentStorage = {
      store: vi.fn(),
      retrieve: vi.fn().mockResolvedValue('retrieved-data'),
    }

    const plugin = new AgentPlugin(
      createMockConfig(),
      'workspace1',
      createMockAgent(),
      'openai',
      'gpt-4',
      { retrieveData: true, storeData: false },
      mockStorage,
    )

    await plugin.execute({} as any, { input: 'storeId:key-123' })

    expect(mockStorage.retrieve).toHaveBeenCalledWith('key-123')
    expect(mockExecutor.run).toHaveBeenCalledWith('workflow', { input: 'retrieved-data' }, expect.any(Object))
  })

  test('execute retrieves stored values from array parameters', async () => {
    const mockRun = createMockRun()
    const mockExecutor = { run: vi.fn().mockResolvedValue(mockRun) }
    vi.mocked(createAgentExecutor).mockReturnValue(mockExecutor as any)

    const mockStorage: AgentStorage = {
      store: vi.fn(),
      retrieve: vi.fn().mockImplementation((key) => `retrieved-${key}`),
    }

    const plugin = new AgentPlugin(
      createMockConfig(),
      'workspace1',
      createMockAgent(),
      'openai',
      'gpt-4',
      { retrieveData: true, storeData: false },
      mockStorage,
    )

    await plugin.execute({} as any, { items: ['storeId:key1', 'storeId:key2', 'plain-value'] })

    expect(mockStorage.retrieve).toHaveBeenCalledTimes(2)
    expect(mockExecutor.run).toHaveBeenCalledWith(
      'workflow',
      { items: ['retrieved-key1', 'retrieved-key2', 'plain-value'] },
      expect.any(Object),
    )
  })

  test('execute returns error on failure', async () => {
    const mockRun = createMockRun({ status: 'error', error: 'Agent failed' })
    const mockExecutor = { run: vi.fn().mockResolvedValue(mockRun) }
    vi.mocked(createAgentExecutor).mockReturnValue(mockExecutor as any)

    const plugin = new AgentPlugin(
      createMockConfig(),
      'workspace1',
      createMockAgent(),
      'openai',
      'gpt-4',
    )

    const result = await plugin.execute({} as any, { input: 'test' })

    expect(result.status).toBe('error')
    expect(result.error).toBe('Agent failed')
  })

  test('execute handles thrown errors', async () => {
    const mockExecutor = { run: vi.fn().mockRejectedValue(new Error('Network error')) }
    vi.mocked(createAgentExecutor).mockReturnValue(mockExecutor as any)

    const plugin = new AgentPlugin(
      createMockConfig(),
      'workspace1',
      createMockAgent(),
      'openai',
      'gpt-4',
    )

    const result = await plugin.execute({} as any, { input: 'test' })

    expect(result.status).toBe('error')
    expect(result.error).toBeInstanceOf(Error)
  })

  test('execute uses a2a opts for a2a source agents', async () => {
    const mockRun = createMockRun()
    const mockExecutor = { run: vi.fn().mockResolvedValue(mockRun) }
    vi.mocked(createAgentExecutor).mockReturnValue(mockExecutor as any)

    const plugin = new AgentPlugin(
      createMockConfig(),
      'workspace1',
      createMockAgent({ source: 'a2a' }),
      'openai',
      'gpt-4',
      { a2aOpts: { ephemeral: true } },
    )

    await plugin.execute({} as any, { input: 'test' })

    expect(mockExecutor.run).toHaveBeenCalledWith(
      'workflow',
      { input: 'test' },
      expect.objectContaining({ ephemeral: true }),
    )
  })

  test('execute skips storage when storeData is false', async () => {
    const mockRun = createMockRun()
    const mockExecutor = { run: vi.fn().mockResolvedValue(mockRun) }
    vi.mocked(createAgentExecutor).mockReturnValue(mockExecutor as any)

    const mockStorage: AgentStorage = {
      store: vi.fn(),
      retrieve: vi.fn(),
    }

    const plugin = new AgentPlugin(
      createMockConfig(),
      'workspace1',
      createMockAgent(),
      'openai',
      'gpt-4',
      { storeData: false },
      mockStorage,
    )

    const result = await plugin.execute({} as any, { input: 'test' })

    expect(mockStorage.store).not.toHaveBeenCalled()
    expect(result.result).toBe('Final result')
  })
})
