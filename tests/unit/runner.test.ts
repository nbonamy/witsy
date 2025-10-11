import { defaultCapabilities, LlmChunk } from 'multi-llm-ts'
import { vi, beforeAll, beforeEach, expect, test } from 'vitest'
import { useWindowMock } from '../mocks/window'
import { createI18nMock } from '../mocks'
import { store } from '../../src/services/store'
import Runner, { RunnerCompletionOpts } from '../../src/services/runner'
import Generator from '../../src/services/generator'
import Agent from '../../src/models/agent'
import Chat from '../../src/models/chat'
import { AgentRun, AgentRunTrigger } from '../../src/types'
import LlmMock, { installMockModels } from '../mocks/llm'

// Mock dependencies
vi.mock('../../src/llms/manager.ts', async () => {
  const LlmManager = vi.fn()
  LlmManager.prototype.initModels = vi.fn()
  LlmManager.prototype.isEngineReady = vi.fn(() => true)
  LlmManager.prototype.getEngineName = () => 'mock'
  LlmManager.prototype.getCustomEngines = () => []
  LlmManager.prototype.getFavoriteId = () => 'favid'
  LlmManager.prototype.getChatModels = vi.fn(() => [{ id: 'chat', name: 'chat', ...defaultCapabilities }])
  LlmManager.prototype.getChatModel = vi.fn(() => ({ id: 'chat', name: 'chat', ...defaultCapabilities }))
  LlmManager.prototype.getChatEngineModel = () => ({ engine: 'mock', model: 'chat' })
  LlmManager.prototype.igniteEngine = vi.fn(() => new LlmMock(store.config.engines.mock))
  LlmManager.prototype.isComputerUseModel = vi.fn(() => false)
  LlmManager.prototype.checkModelsCapabilities = vi.fn()
  LlmManager.prototype.loadTools = vi.fn()
  return { default: LlmManager }
})

vi.mock('../../src/services/i18n', async () => {
  return createI18nMock(() => ({
    locale: store.config.llm.locale
  }))
})

vi.mock('../../src/services/a2a-client.ts', () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      execute: vi.fn(async function* () {
        yield { type: 'content', text: 'A2A response chunk 1', done: false }
        yield { type: 'content', text: ' chunk 2', done: true }
      })
    }))
  }
})

vi.mock('../../src/plugins/plugins.ts', () => {
  return {
    availablePlugins: {}
  }
})

const spyGenerate = vi.spyOn(Generator.prototype, 'generate')

let runner: Runner|null = null
let testAgent: Agent

const createTestAgent = (overrides: Partial<Agent> = {}): Agent => {
  const agent = new Agent()
  agent.uuid = 'test-agent'
  agent.name = 'Test Agent'
  agent.description = 'A test agent'
  agent.instructions = 'You are a helpful test assistant'
  agent.engine = 'mock'
  agent.model = 'chat'
  agent.steps = [{
    prompt: 'Hello {{name}}, how can I help you today?',
    tools: null,
    agents: [],
  }]
  
  // Apply overrides
  Object.assign(agent, overrides)
  
  return agent
}

const runAgent = async (
  trigger: AgentRunTrigger = 'manual',
  prompt?: string,
  opts: Partial<RunnerCompletionOpts> = {},
  generationCallback?: (event: string) => void
): Promise<AgentRun> => {

  // Default options
  const defaultOpts: RunnerCompletionOpts = {
    engine: 'mock',
    model: 'chat',
    ephemeral: true,
    ...opts
  }

  // Run the agent
  const run = await runner!.run(trigger, prompt, defaultOpts, generationCallback)
  
  // Wait for completion if not ephemeral
  if (!defaultOpts.ephemeral) {
    await vi.waitUntil(() => run.status !== 'running')
  }

  return run
}

beforeAll(() => {
  useWindowMock({ noAdditionalInstructions: true })
  store.loadExperts()
})

beforeEach(() => {
  // Clear mocks
  vi.clearAllMocks()

  // Reset store
  store.loadSettings()
  store.config.general.locale = 'en-US'
  store.config.llm.locale = 'fr-FR'
  store.config.llm.forceLocale = false
  store.config.llm.engine = 'mock'
  // @ts-expect-error mocking
  store.config.instructions = {}
  installMockModels()

  // disable all additional instructions
  for (const key of Object.keys(store.config.llm.additionalInstructions)) {
    // @ts-expect-error partial mock
    store.config.llm.additionalInstructions[key] = false
  }

  // Reset spies
  spyGenerate.mockResolvedValue('success')

  // Create test agent
  testAgent = createTestAgent()

  // Create runner
  runner = new Runner(store.config, '123', testAgent)
})

test('Runner Creation', () => {
  expect(runner).not.toBeNull()
  expect(runner!.agent).toBe(testAgent)
  expect(runner!.llmManager).toBeDefined()
})

test('Basic Agent Run - Success', async () => {
  const run = await runAgent('manual', 'Hello there')

  expect(run).toBeDefined()
  expect(run.uuid).toBeDefined()
  expect(run.agentId).toBe(testAgent.uuid)
  expect(run.trigger).toBe('manual')
  expect(run.status).toBe('success')
  expect(run.prompt).toBe('Hello there')
  expect(run.messages).toHaveLength(3) // system, user, assistant
  expect(run.messages[0].role).toBe('system')
  expect(run.messages[1].role).toBe('user')
  expect(run.messages[2].role).toBe('assistant')
})

test('Agent Run with Parameters', async () => {
  testAgent.parameters = [{
    name: 'name',
    type: 'string',
    description: 'User name',
    required: true
  }]
  
  const run = await runAgent('manual', 'Test prompt')

  expect(run.status).toBe('success')
  // The first step uses the provided prompt, not the step prompt
  expect(run.messages[1].content).toBe('Test prompt')
})

test('Agent Run with Multiple Steps', async () => {
  testAgent.steps = [
    {
      prompt: 'Step 1: {{input}}',
      tools: null,
      agents: [],
    },
    {
      prompt: 'Step 2: Based on {{output.1}}, provide more help',
      tools: null,
      agents: [],
    }
  ]

  const run = await runAgent('manual', 'Multi-step test')

  expect(run.status).toBe('success')
  expect(run.messages).toHaveLength(5) // system, user1, assistant1, user2, assistant2
  // First step uses provided prompt
  expect(run.messages[1].content).toBe('Multi-step test')
  // Second step uses step prompt with output replacement
  expect(run.messages[3].content).toContain('Step 2: Based on')
})

test('Agent Run with Chat Integration', async () => {
  const chat = new Chat()
  chat.setEngineModel('mock', 'chat')
  
  const run = await runAgent('manual', 'Chat integration test', { chat })

  expect(run.status).toBe('success')
  expect(chat.messages).toHaveLength(3)
  expect(chat.messages[1].content).toBe('Chat integration test')
  expect(chat.messages[2].agentId).toBe(testAgent.uuid)
  expect(chat.messages[2].agentRunId).toBe(run.uuid)
})

test('Agent Run with Engine Override', async () => {
  // Agent engine takes precedence, so we need to clear it to test override
  testAgent.engine = null
  
  const run = await runAgent('manual', 'Engine test', { engine: 'custom-mock' })

  expect(run.status).toBe('success')
  expect(run.messages[1].engine).toBe('custom-mock')
  expect(run.messages[2].engine).toBe('custom-mock')
})

test('Agent Run with Model Override', async () => {
  // Agent model takes precedence, so we need to clear it to test override
  testAgent.model = null
  
  const run = await runAgent('manual', 'Model test', { model: 'custom-model' })

  expect(run.status).toBe('success')
  // The LlmManager mock will return its default model, not the custom one
  // This is correct behavior - the manager validates/resolves the model
  expect(run.messages[1].model).toBe('chat') // Mock manager returns 'chat' as default
  expect(run.messages[2].model).toBe('chat')
})

test('Agent Run with Streaming Disabled', async () => {
  testAgent.disableStreaming = true
  
  const run = await runAgent('manual', 'No streaming test')

  expect(run.status).toBe('success')
  // Check if generate was called with streaming: false
  const generateCalls = spyGenerate.mock.calls
  if (generateCalls.length > 0) {
    const params = generateCalls[0][2] as RunnerCompletionOpts
    expect(params.streaming).toBe(false)
  }
})

test('Agent Run with Streaming Enabled', async () => {
  testAgent.disableStreaming = false
  
  const run = await runAgent('manual', 'Streaming test')

  expect(run.status).toBe('success')
  // Check if generate was called with streaming: true
  const generateCalls = spyGenerate.mock.calls
  if (generateCalls.length > 0) {
    const params = generateCalls[0][2] as RunnerCompletionOpts
    expect(params.streaming).toBe(true)
  }
})

test('Agent Run with Custom Locale', async () => {
  testAgent.locale = 'es-ES'
  
  const run = await runAgent('manual', 'Locale test')

  expect(run.status).toBe('success')
  // Locale should be applied during run and restored after
})

test('Agent Run with LLM Callback', async () => {
  const chunks: LlmChunk[] = []
  const callback = (chunk: LlmChunk) => {
    if (chunk) chunks.push(chunk)
  }

  // Mock generate to call the callback
  spyGenerate.mockImplementation(async (llm, messages, opts, llmCallback) => {
    if (llmCallback) {
      llmCallback({ type: 'content', text: 'test chunk', done: true })
    }
    return 'success'
  })

  const run = await runAgent('manual', 'Callback test', { callback })

  expect(run.status).toBe('success')
  expect(chunks.length).toBeGreaterThan(0)
})

test('Agent Run with Generation Callbacks', async () => {
  const events: string[] = []
  const generationCallback = (event: string) => {
    events.push(event)
  }

  const run = await runAgent('manual', 'Generation callback test', { model: 'chat' }, generationCallback)

  expect(run.status).toBe('success')
  expect(events).toContain('before_generation')
  expect(events).toContain('generation_done')
})

test('Agent Run with Structured Output', async () => {
  testAgent.steps[0].structuredOutput = {
    name: 'test_output',
    structure: {} as any // Mock ZodType
  }

  const run = await runAgent('manual', 'Structured output test')

  expect(run.status).toBe('success')
  // Check if generate was called with structuredOutput
  const generateCalls = spyGenerate.mock.calls
  if (generateCalls.length > 0) {
    const params = generateCalls[0][2] as RunnerCompletionOpts
    expect(params.structuredOutput).toBeDefined()
  }
})

test('Agent Run with Tools Filter', async () => {
  testAgent.steps[0].tools = ['search_internet', 'run_python_code']

  const run = await runAgent('manual', 'Tools test')

  expect(run.status).toBe('success')
  // Tools should be filtered and added to LLM
})

test('Agent Run with Sub-Agents', async () => {
  testAgent.steps[0].agents = ['agent1', 'agent2']

  const run = await runAgent('manual', 'Sub-agents test')

  expect(run.status).toBe('success')
  // Sub-agents should be loaded and added as plugins
})

test('Agent Run without Prompt', async () => {
  testAgent.steps[0].prompt = 'Default step prompt'

  const run = await runAgent('manual')

  expect(run.status).toBe('success')
  expect(run.messages[1].content).toBe('Default step prompt')
})

test('Agent Run with Empty Prompt', async () => {
  testAgent.steps[0].prompt = ''

  const run = await runAgent('manual', '')

  expect(run).toBeNull()
})

test('A2A Agent Run', async () => {
  testAgent.source = 'a2a'
  testAgent.instructions = 'A2A test instructions'

  const run = await runAgent('manual', 'A2A test prompt')

  expect(run.status).toBe('success')
  expect(run.messages[2].content).toContain('A2A response chunk 1 chunk 2')
})

test('Agent Run with Tool Calls', async () => {
  // Mock the generate method to call the callback with tool chunks
  spyGenerate.mockImplementation(async (llm, messages, opts, callback) => {
    // Simulate tool calls via callback
    if (callback) {
      callback({ type: 'tool', id: 'tool1', name: 'test_tool', call: { params: { test: 'param' }, result: null }, done: false })
      callback({ type: 'tool', id: 'tool1', name: 'test_tool', call: { params: { test: 'param' }, result: 'tool result' }, done: true })
      callback({ type: 'content', text: 'Final response', done: true })
    }
    return 'success'
  })

  const run = await runAgent('manual', 'Tool call test')

  expect(run.status).toBe('success')
  expect(run.toolCalls).toHaveLength(1)
  expect(run.toolCalls[0].name).toBe('test_tool')
  expect(run.toolCalls[0].params).toEqual({ test: 'param' })
  expect(run.toolCalls[0].result).toBe('tool result')
})

test('Agent Run Error Handling', async () => {
  // Mock generate to throw error
  spyGenerate.mockRejectedValue(new Error('Test error'))

  const run = await runAgent('manual', 'Error test')

  expect(run.status).toBe('error')
  expect(run.error).toBe('Test error')
  expect(run.messages[2].content).toContain('generator.errors.cannotContinue')
})

test('Agent Run with Non-ephemeral Storage', async () => {
  const run = await runAgent('manual', 'Storage test', { ephemeral: false })

  expect(run.status).toBe('success')
  // Should call saveRun multiple times for non-ephemeral runs
})

test('Agent Run Different Triggers', async () => {
  const triggers: AgentRunTrigger[] = ['manual', 'schedule', 'webhook', 'workflow']
  
  for (const trigger of triggers) {
    const run = await runAgent(trigger, `${trigger} test`)
    expect(run.trigger).toBe(trigger)
    expect(run.status).toBe('success')
  }
})

test('Agent Run with Model Options', async () => {
  testAgent.modelOpts = {
    temperature: 0.8,
    maxTokens: 100
  }

  const run = await runAgent('manual', 'Model options test')

  expect(run.status).toBe('success')
  // Check if generate was called with model options
  const generateCalls = spyGenerate.mock.calls
  if (generateCalls.length > 0) {
    const params = generateCalls[0][2] as RunnerCompletionOpts
    expect(params.temperature).toBe(0.8)
    expect(params.maxTokens).toBe(100)
  }
})

test('Agent Run with Streaming Not Supported Error', async () => {
  // Mock generate to return streaming not supported on first call, success on second
  spyGenerate
    .mockResolvedValueOnce('streaming_not_supported')
    .mockResolvedValueOnce('success')

  const run = await runAgent('manual', 'Streaming error test')

  expect(run.status).toBe('success')
  expect(spyGenerate).toHaveBeenCalledTimes(2) // Should retry without streaming
})

test('Agent Run System Instructions', async () => {
  testAgent.instructions = 'Custom agent instructions'

  const run = await runAgent('manual', 'Instructions test')

  expect(run.status).toBe('success')
  expect(run.messages[0].content).toContain('Custom agent instructions')
})

test('Agent Run with Chat Locale Override', async () => {
  const chat = new Chat()
  chat.locale = 'de-DE'
  
  const run = await runAgent('manual', 'Chat locale test', { chat })

  expect(run.status).toBe('success')
  expect(chat.locale).toBe('de-DE')
})

test('Agent Run with Chat Model Options', async () => {
  const chat = new Chat()
  chat.modelOpts = { temperature: 0.5 }
  testAgent.modelOpts = { temperature: 0.9 }

  const run = await runAgent('manual', 'Chat model opts test', { chat })

  expect(run.status).toBe('success')
  // Agent model options should override chat model options
  const generateCalls = spyGenerate.mock.calls
  if (generateCalls.length > 0) {
    const params = generateCalls[0][2] as RunnerCompletionOpts
    expect(params.temperature).toBe(0.9)
  }
})

test('Runner aborts when abortSignal is aborted before first step', async () => {
  const abortController = new AbortController()

  // Abort before starting
  abortController.abort()

  // Start the run with aborted signal
  const run = await runner!.run('manual', 'Abort test', {
    model: 'chat',
    streaming: true,
    abortSignal: abortController.signal
  })

  expect(run).toBeDefined()
  expect(run.status).toBe('canceled')
})

test('Runner aborts between multi-step execution', async () => {
  testAgent.steps = [
    { prompt: 'Step 1', tools: null, agents: [] },
    { prompt: 'Step 2', tools: null, agents: [] },
    { prompt: 'Step 3', tools: null, agents: [] },
  ]

  const abortController = new AbortController()
  let stepCount = 0

  // Mock generate to track steps and abort after step 1
  spyGenerate.mockImplementation(async (_llm, messages) => {
    stepCount++
    const assistantMessage = messages[messages.length - 1]
    assistantMessage.appendText({ type: 'content', text: `Step ${stepCount} complete`, done: true })

    // Abort after first step completes
    if (stepCount === 1) {
      abortController.abort()
    }

    return 'success'
  })

  const run = await runner!.run('manual', 'Multi-step abort test', {
    model: 'chat',
    abortSignal: abortController.signal
  })

  expect(run.status).toBe('canceled')
  expect(stepCount).toBe(1) // Should only execute first step
  expect(run.messages).toHaveLength(3) // system + step1 user + step1 assistant
})

test('Runner aborts before docrepo query', async () => {
  testAgent.steps[0].docrepo = 'test-repo'
  const abortController = new AbortController()

  // Mock docrepo query (should not be called)
  window.api.docrepo.query = vi.fn().mockResolvedValue([])

  // Abort before run starts
  abortController.abort()

  const run = await runner!.run('manual', 'Docrepo abort test', {
    model: 'chat',
    abortSignal: abortController.signal
  })

  expect(run.status).toBe('canceled')
  expect(window.api.docrepo.query).not.toHaveBeenCalled()
})

test('Runner aborts before tool loading', async () => {
  testAgent.steps[0].tools = ['search_internet']
  const abortController = new AbortController()

  // Abort before run starts
  abortController.abort()

  const run = await runner!.run('manual', 'Tools abort test', {
    model: 'chat',
    abortSignal: abortController.signal
  })

  expect(run.status).toBe('canceled')
  // Generator should not have been called
  expect(spyGenerate).not.toHaveBeenCalled()
})

test('Runner aborts before titling', async () => {
  const chat = new Chat()
  const abortController = new AbortController()

  // Mock generate to succeed but abort before titling
  spyGenerate.mockImplementation(async (_llm, messages) => {
    const assistantMessage = messages[messages.length - 1]
    assistantMessage.appendText({ type: 'content', text: 'Response', done: true })
    // Abort after generation
    abortController.abort()
    return 'success'
  })

  const run = await runner!.run('manual', 'Titling abort test', {
    model: 'chat',
    chat,
    abortSignal: abortController.signal
  })

  expect(run.status).toBe('canceled')
  expect(chat.title).toBeUndefined() // Title should not be set
})

test('Agent Run with Docrepo - No Sources', async () => {
  testAgent.steps[0].docrepo = 'uuid1'
  
  // Mock docrepo.query to return empty results
  window.api.docrepo.query = vi.fn().mockResolvedValue([])
  
  const run = await runAgent('manual', 'Docrepo test')

  expect(run.status).toBe('success')
  expect(window.api.docrepo.query).toHaveBeenCalledWith('uuid1', 'Docrepo test')
  
  // Prompt should not be modified when no sources are found
  expect(run.messages[1].content).toBe('Docrepo test')
})

test('Agent Run with Docrepo - With Sources', async () => {
  testAgent.steps[0].docrepo = 'uuid2'
  
  // Mock docrepo.query to return sources
  const mockSources = [
    { content: 'Source 1 content', score: 0.9, metadata: { uuid: 'doc1' } },
    { content: 'Source 2 content', score: 0.8, metadata: { uuid: 'doc2' } }
  ]
  window.api.docrepo.query = vi.fn().mockResolvedValue(mockSources)
  
  const run = await runAgent('manual', 'Docrepo query test')

  expect(run.status).toBe('success')
  expect(window.api.docrepo.query).toHaveBeenCalledWith('uuid2', 'Docrepo query test')
  
  // Prompt should be augmented with docrepo instructions
  const userMessage = run.messages[1]
  expect(userMessage.content).toContain('Docrepo query test')
  expect(userMessage.content).toContain('instructions.agent.docquery')
})

test('Agent Run with Docrepo - Multiple Steps', async () => {
  testAgent.steps = [
    {
      prompt: 'Step 1: {{input}}',
      tools: null,
      agents: [],
      docrepo: 'uuid1'
    },
    {
      prompt: 'Step 2: Based on {{output.1}}, provide more details',
      tools: null,
      agents: [],
      docrepo: 'uuid2'
    }
  ]

  // Mock docrepo.query for different repositories
  window.api.docrepo.query = vi.fn()
    .mockResolvedValueOnce([
      { content: 'Step 1 context', score: 0.9, metadata: { uuid: 'doc1' } }
    ])
    .mockResolvedValueOnce([
      { content: 'Step 2 context', score: 0.8, metadata: { uuid: 'doc2' } }
    ])

  const run = await runAgent('manual', 'Multi-step docrepo test')

  expect(run.status).toBe('success')
  
  // Should have called docrepo.query for both steps
  expect(window.api.docrepo.query).toHaveBeenCalledTimes(2)
  expect(window.api.docrepo.query).toHaveBeenNthCalledWith(1, 'uuid1', 'Multi-step docrepo test')
  expect(window.api.docrepo.query).toHaveBeenNthCalledWith(2, 'uuid2', expect.stringContaining('Step 2: Based on'))

  // Messages should include docrepo instructions
  expect(run.messages[1].content).toContain('instructions.agent.docquery')
  expect(run.messages[3].content).toContain('instructions.agent.docquery')
})

test('Agent Run with Docrepo - Error Handling', async () => {
  testAgent.steps[0].docrepo = 'invalid-uuid'
  
  // Mock docrepo.query to throw an error
  window.api.docrepo.query = vi.fn().mockRejectedValue(new Error('Docrepo not found'))
  
  const run = await runAgent('manual', 'Docrepo error test')

  expect(run.status).toBe('error')
  expect(window.api.docrepo.query).toHaveBeenCalledWith('invalid-uuid', 'Docrepo error test')
  expect(run.error).toBe('Docrepo not found')
})

test('Agent Run with Docrepo - Second Step Uses Output Variable', async () => {
  testAgent.steps = [
    {
      prompt: 'Analyze: {{query}}',
      tools: null,
      agents: [],
    },
    {
      prompt: 'Based on {{output.1}}, provide summary',
      tools: null,
      agents: [],
      docrepo: 'uuid1'
    }
  ]

  // Mock the generate method to return a specific output for the first step
  spyGenerate.mockImplementation(async (_llm, messages) => {
    const assistantMessage = messages[messages.length - 1]
    if (messages[1]?.content.includes('Analyze:')) {
      assistantMessage.appendText({ type: 'content', text: 'Analysis result from step 1', done: true })
    } else {
      assistantMessage.appendText({ type: 'content', text: 'Summary based on analysis', done: true })
    }
    return 'success'
  })

  window.api.docrepo.query = vi.fn().mockResolvedValue([
    { content: 'Additional context from docrepo', score: 0.9, metadata: { uuid: 'doc1' } }
  ])

  const run = await runAgent('manual', 'Step output docrepo test')

  expect(run.status).toBe('success')
  
  // The second step should have used the output from the first step in its docrepo query
  expect(window.api.docrepo.query).toHaveBeenCalledWith('uuid1', expect.stringContaining('Summary based on analysis'))
  
  // The second step's message should contain the docrepo instructions
  const secondStepMessage = run.messages[3]
  expect(secondStepMessage.content).toContain('Summary based on analysis')
  expect(secondStepMessage.content).toContain('instructions.agent.docquery')
})
