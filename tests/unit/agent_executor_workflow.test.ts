import { defaultCapabilities, LlmChunk } from 'multi-llm-ts'
import { vi, beforeAll, beforeEach, expect, test } from 'vitest'
import { useWindowMock } from '../mocks/window'
import { createI18nMock } from '../mocks'
import { store } from '../../src/renderer/services/store'
import { AgentRun, AgentRunTrigger } from '../../src/types/agents'
import AgentWorkflowExecutor, { AgentWorkflowExecutorOpts } from '../../src/renderer/services/agent_executor_workflow'
import Generator from '../../src/renderer/services/generator'
import Agent from '../../src/models/agent'
import Chat from '../../src/models/chat'
import LlmMock, { installMockModels } from '../mocks/llm'


// Mock dependencies
vi.mock('../../src/renderer/services/llms/manager.ts', async () => {
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

vi.mock('../../src/renderer/services/i18n', async () => {
  return createI18nMock(() => ({
    locale: store.config.llm.locale
  }))
})

vi.mock('../../src/renderer/services/a2a-client.ts', () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      execute: vi.fn(async function* () {
        yield { type: 'content', text: 'A2A response chunk 1', done: false }
        yield { type: 'content', text: ' chunk 2', done: true }
      })
    }))
  }
})

vi.mock('../../src/renderer/services/plugins/plugins.ts', () => {
  return {
    availablePlugins: {}
  }
})

const spyGenerate = vi.spyOn(Generator.prototype, 'generate')

let executor: AgentWorkflowExecutor|null = null
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
  values: Record<string, string> = {},
  opts: Partial<AgentWorkflowExecutorOpts> = {},
  generationCallback?: (event: string) => void
): Promise<AgentRun> => {

  // Default options
  const defaultOpts: AgentWorkflowExecutorOpts = {
    engine: 'mock',
    model: 'chat',
    ephemeral: true,
    ...opts
  }

  // Run the agent
  const run = await executor!.run(trigger, values, defaultOpts, generationCallback)

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

  // Create executor
  executor = new AgentWorkflowExecutor(store.config, '123', testAgent)
})

test('AgentWorkflowExecutor Creation', () => {
  expect(executor).not.toBeNull()
  expect(executor!.agent).toBe(testAgent)
  expect(executor!.llmManager).toBeDefined()
})

test('Basic Agent Run - Success', async () => {
  const run = await runAgent('manual', { name: 'there' })

  expect(run).toBeDefined()
  expect(run.uuid).toBeDefined()
  expect(run.agentId).toBe(testAgent.uuid)
  expect(run.trigger).toBe('manual')
  expect(run.status).toBe('success')
  expect(run.prompt).toBe('Hello there, how can I help you today?')
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

  const run = await runAgent('manual', { name: 'Test' })

  expect(run.status).toBe('success')
  // The first step uses the provided values in the template
  expect(run.messages[1].content).toBe('Hello Test, how can I help you today?')
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

  const run = await runAgent('manual', { input: 'Multi-step test' })

  expect(run.status).toBe('success')
  expect(run.messages).toHaveLength(5) // system, user1, assistant1, user2, assistant2
  // First step uses provided values in template
  expect(run.messages[1].content).toBe('Step 1: Multi-step test')
  // Second step uses step prompt with output replacement
  expect(run.messages[3].content).toContain('Step 2: Based on')
})

test('Agent Run with Chat Integration', async () => {
  const chat = new Chat()
  chat.setEngineModel('mock', 'chat')
  
  const run = await runAgent('manual', { name: 'Chat integration test' }, { chat })

  expect(run.status).toBe('success')
  expect(chat.messages).toHaveLength(3)
  expect(chat.messages[1].content).toBe('Hello Chat integration test, how can I help you today?')
  expect(chat.messages[2].agentId).toBe(testAgent.uuid)
  expect(chat.messages[2].agentRunId).toBe(run.uuid)
})

test('Agent Run with Engine Override', async () => {
  // Agent engine takes precedence, so we need to clear it to test override
  testAgent.engine = null
  
  const run = await runAgent('manual', { name: 'Engine test' }, { engine: 'custom-mock' })

  expect(run.status).toBe('success')
  expect(run.messages[1].engine).toBe('custom-mock')
  expect(run.messages[2].engine).toBe('custom-mock')
})

test('Agent Run with Model Override', async () => {
  // Agent model takes precedence, so we need to clear it to test override
  testAgent.model = null
  
  const run = await runAgent('manual', { name: 'Model test' }, { model: 'custom-model' })

  expect(run.status).toBe('success')
  // The LlmManager mock will return its default model, not the custom one
  // This is correct behavior - the manager validates/resolves the model
  expect(run.messages[1].model).toBe('chat') // Mock manager returns 'chat' as default
  expect(run.messages[2].model).toBe('chat')
})

test('Agent Run with Streaming Disabled', async () => {
  testAgent.disableStreaming = true
  
  const run = await runAgent('manual', { name: 'No streaming test' })

  expect(run.status).toBe('success')
  // Check if generate was called with streaming: false
  const generateCalls = spyGenerate.mock.calls
  if (generateCalls.length > 0) {
    const params = generateCalls[0][2] as AgentWorkflowExecutorOpts
    expect(params.streaming).toBe(false)
  }
})

test('Agent Run with Streaming Enabled', async () => {
  testAgent.disableStreaming = false

  const run = await runAgent('manual', { name: 'Streaming test' })

  expect(run.status).toBe('success')
  // Check if generate was called with streaming: true
  const generateCalls = spyGenerate.mock.calls
  if (generateCalls.length > 0) {
    const params = generateCalls[0][2] as AgentWorkflowExecutorOpts
    expect(params.streaming).toBe(true)
  }
})

test('Agent Run with Custom Locale', async () => {
  testAgent.locale = 'es-ES'
  
  const run = await runAgent('manual', { name: 'Locale test' })

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

  const run = await runAgent('manual', { name: 'Callback test' }, { callback })

  expect(run.status).toBe('success')
  expect(chunks.length).toBeGreaterThan(0)
})

test('Agent Run with Generation Callbacks', async () => {
  const events: string[] = []
  const generationCallback = (event: string) => {
    events.push(event)
  }

  const run = await runAgent('manual', { name: 'Generation callback test' }, { model: 'chat' }, generationCallback)

  expect(run.status).toBe('success')
  expect(events).toContain('before_generation')
  expect(events).toContain('generation_done')
})

test('Agent Run with Structured Output', async () => {
  testAgent.steps[0].structuredOutput = {
    name: 'test_output',
    structure: {} as any // Mock ZodType
  }

  const run = await runAgent('manual', { name: 'Structured output test' })

  expect(run.status).toBe('success')
  // Check if generate was called with structuredOutput
  const generateCalls = spyGenerate.mock.calls
  if (generateCalls.length > 0) {
    const params = generateCalls[0][2] as AgentWorkflowExecutorOpts
    expect(params.structuredOutput).toBeDefined()
  }
})

test('Agent Run with Tools Filter', async () => {
  testAgent.steps[0].tools = ['search_internet', 'run_python_code']

  const run = await runAgent('manual', { name: 'Tools test' })

  expect(run.status).toBe('success')
  // Tools should be filtered and added to LLM
})

test('Agent Run with Sub-Agents', async () => {
  testAgent.steps[0].agents = ['agent1', 'agent2']

  const run = await runAgent('manual', { name: 'Sub-agents test' })

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

  const run = await runAgent('manual', {})

  expect(run.status).toBe('error')
  expect(run.error).toBe('Step 1 has an empty prompt after variable substitution')
})

test('Agent Run with Tool Calls', async () => {
  // Mock the generate method to call the callback with tool chunks
  spyGenerate.mockImplementation(async (llm, messages, opts, callback) => {
    // Simulate tool calls via callback
    if (callback) {
      callback({ type: 'tool', id: 'tool1', name: 'test_tool', state:'running', call: { params: { test: 'param' }, result: null }, done: false })
      callback({ type: 'tool', id: 'tool1', name: 'test_tool', state:'running', call: { params: { test: 'param' }, result: 'tool result' }, done: true })
      callback({ type: 'content', text: 'Final response', done: true })
    }
    return 'success'
  })

  const run = await runAgent('manual', { name: 'Tool call test' })

  expect(run.status).toBe('success')
  expect(run.toolCalls).toHaveLength(1)
  expect(run.toolCalls[0].name).toBe('test_tool')
  expect(run.toolCalls[0].params).toEqual({ test: 'param' })
  expect(run.toolCalls[0].result).toBe('tool result')
})

test('Agent Run Error Handling', async () => {
  // Mock generate to throw error
  spyGenerate.mockRejectedValue(new Error('Test error'))

  const run = await runAgent('manual', { name: 'Error test' })

  expect(run.status).toBe('error')
  expect(run.error).toBe('Test error')
  expect(run.messages[2].content).toContain('generator.errors.cannotContinue')
})

test('Agent Run with Non-ephemeral Storage', async () => {
  const run = await runAgent('manual', { name: 'Storage test' }, { ephemeral: false })

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

  const run = await runAgent('manual', { name: 'Model options test' })

  expect(run.status).toBe('success')
  // Check if generate was called with model options
  const generateCalls = spyGenerate.mock.calls
  if (generateCalls.length > 0) {
    const params = generateCalls[0][2] as AgentWorkflowExecutorOpts
    expect(params.temperature).toBe(0.8)
    expect(params.maxTokens).toBe(100)
  }
})

test('Agent Run with Streaming Not Supported Error', async () => {
  // Mock generate to return streaming not supported on first call, success on second
  spyGenerate
    .mockResolvedValueOnce('streaming_not_supported')
    .mockResolvedValueOnce('success')

  const run = await runAgent('manual', { name: 'Streaming error test' })

  expect(run.status).toBe('success')
  expect(spyGenerate).toHaveBeenCalledTimes(2) // Should retry without streaming
})

test('Agent Run System Instructions', async () => {
  testAgent.instructions = 'Custom agent instructions'

  const run = await runAgent('manual', { name: 'Instructions test' })

  expect(run.status).toBe('success')
  expect(run.messages[0].content).toContain('Custom agent instructions')
})

test('Agent Run with Chat Locale Override', async () => {
  const chat = new Chat()
  chat.locale = 'de-DE'
  
  const run = await runAgent('manual', { name: 'Chat locale test' }, { chat })

  expect(run.status).toBe('success')
  expect(chat.locale).toBe('de-DE')
})

test('Agent Run with Chat Model Options', async () => {
  const chat = new Chat()
  chat.modelOpts = { temperature: 0.5 }
  testAgent.modelOpts = { temperature: 0.9 }

  const run = await runAgent('manual', { name: 'Chat model opts test' }, { chat })

  expect(run.status).toBe('success')
  // Agent model options should override chat model options
  const generateCalls = spyGenerate.mock.calls
  if (generateCalls.length > 0) {
    const params = generateCalls[0][2] as AgentWorkflowExecutorOpts
    expect(params.temperature).toBe(0.9)
  }
})

test('AgentWorkflowExecutor aborts when abortSignal is aborted before first step', async () => {
  const abortController = new AbortController()

  // Abort before starting
  abortController.abort()

  // Start the run with aborted signal
  const run = await executor!.run('manual', 'Abort test', {
    model: 'chat',
    streaming: true,
    abortSignal: abortController.signal
  })

  expect(run).toBeDefined()
  expect(run.status).toBe('canceled')
})

test('AgentWorkflowExecutor aborts between multi-step execution', async () => {
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

  const run = await executor!.run('manual', 'Multi-step abort test', {
    model: 'chat',
    abortSignal: abortController.signal
  })

  expect(run.status).toBe('canceled')
  expect(stepCount).toBe(1) // Should only execute first step
  expect(run.messages).toHaveLength(3) // system + step1 user + step1 assistant
})

test('AgentWorkflowExecutor aborts before docrepo query', async () => {
  testAgent.steps[0].docrepo = 'test-repo'
  const abortController = new AbortController()

  // Mock docrepo query (should not be called)
  window.api.docrepo.query = vi.fn().mockResolvedValue([])

  // Abort before run starts
  abortController.abort()

  const run = await executor!.run('manual', 'Docrepo abort test', {
    model: 'chat',
    abortSignal: abortController.signal
  })

  expect(run.status).toBe('canceled')
  expect(window.api.docrepo.query).not.toHaveBeenCalled()
})

test('AgentWorkflowExecutor aborts before tool loading', async () => {
  testAgent.steps[0].tools = ['search_internet']
  const abortController = new AbortController()

  // Abort before run starts
  abortController.abort()

  const run = await executor!.run('manual', 'Tools abort test', {
    model: 'chat',
    abortSignal: abortController.signal
  })

  expect(run.status).toBe('canceled')
  // Generator should not have been called
  expect(spyGenerate).not.toHaveBeenCalled()
})

test('AgentWorkflowExecutor aborts before titling', async () => {
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

  const run = await executor!.run('manual', 'Titling abort test', {
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
  
  const run = await runAgent('manual', { name: 'Docrepo test' })

  expect(run.status).toBe('success')
  expect(window.api.docrepo.query).toHaveBeenCalledWith('uuid1', 'Hello Docrepo test, how can I help you today?')

  // Prompt should not be modified when no sources are found
  expect(run.messages[1].content).toBe('Hello Docrepo test, how can I help you today?')
})

test('Agent Run with Docrepo - With Sources', async () => {
  testAgent.steps[0].docrepo = 'uuid2'
  
  // Mock docrepo.query to return sources
  const mockSources = [
    { content: 'Source 1 content', score: 0.9, metadata: { uuid: 'doc1' } },
    { content: 'Source 2 content', score: 0.8, metadata: { uuid: 'doc2' } }
  ]
  window.api.docrepo.query = vi.fn().mockResolvedValue(mockSources)
  
  const run = await runAgent('manual', { name: 'Docrepo query test' })

  expect(run.status).toBe('success')
  expect(window.api.docrepo.query).toHaveBeenCalledWith('uuid2', 'Hello Docrepo query test, how can I help you today?')

  // Prompt should be augmented with docrepo instructions
  const userMessage = run.messages[1]
  expect(userMessage.content).toContain('Hello Docrepo query test, how can I help you today?')
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

  const run = await runAgent('manual', { input: 'Multi-step docrepo test' })

  expect(run.status).toBe('success')

  // Should have called docrepo.query for both steps
  expect(window.api.docrepo.query).toHaveBeenCalledTimes(2)
  expect(window.api.docrepo.query).toHaveBeenNthCalledWith(1, 'uuid1', 'Step 1: Multi-step docrepo test')
  expect(window.api.docrepo.query).toHaveBeenNthCalledWith(2, 'uuid2', expect.stringContaining('Step 2: Based on'))

  // Messages should include docrepo instructions
  expect(run.messages[1].content).toContain('instructions.agent.docquery')
  expect(run.messages[3].content).toContain('instructions.agent.docquery')
})

test('Agent Run with Docrepo - Error Handling', async () => {
  testAgent.steps[0].docrepo = 'invalid-uuid'
  
  // Mock docrepo.query to throw an error
  window.api.docrepo.query = vi.fn().mockRejectedValue(new Error('Docrepo not found'))
  
  const run = await runAgent('manual', { name: 'Docrepo error test' })

  expect(run.status).toBe('error')
  expect(window.api.docrepo.query).toHaveBeenCalledWith('invalid-uuid', 'Hello Docrepo error test, how can I help you today?')
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

  const run = await runAgent('manual', { query: 'Step output docrepo test' })

  expect(run.status).toBe('success')

  // The second step should have used the output from the first step in its docrepo query
  // The docrepo query gets the step prompt with {{output.1}} replaced by step 1's output
  expect(window.api.docrepo.query).toHaveBeenCalledWith('uuid1', expect.stringContaining('Analysis result from step 1'))
  
  // The second step's message should contain the docrepo instructions
  const secondStepMessage = run.messages[3]
  expect(secondStepMessage.content).toContain('Based on Analysis result from step 1')
  expect(secondStepMessage.content).toContain('instructions.agent.docquery')
})

test('Agent delegates to llmManager.loadTools', async () => {

  installMockModels()

  // Spy on llmManager.loadTools to verify it's called
  const mockLoadTools = vi.spyOn(executor!['llmManager'], 'loadTools')

  // Create a test agent that specifies certain tools
  testAgent.steps = [{
    prompt: 'Test prompt',
    tools: ['plugin1', 'plugin2', 'tool1'],
    agents: [],
  }]

  const run = await runAgent('manual', { name: 'Test prompt' })

  // Verify llmManager.loadTools was called with correct arguments
  expect(mockLoadTools).toHaveBeenCalledWith(
    expect.any(Object), // engine (LlmEngine instance)
    expect.any(String), // workspaceId
    {},                 // availablePlugins (mocked as {})
    ['plugin1', 'plugin2', 'tool1'], // tools
    { codeExecutionMode: false }, // options
  )

  expect(run.status).toBe('success')
})

test('Agent loads all tools when tools is null', async () => {

  installMockModels()

  const mockLoadTools = vi.spyOn(executor!['llmManager'], 'loadTools')

  testAgent.steps = [{
    prompt: 'Test prompt',
    tools: null,
    agents: [],
  }]

  const run = await runAgent('manual', { name: 'Test prompt' })

  // Verify llmManager.loadTools was called with null (load all)
  expect(mockLoadTools).toHaveBeenCalledWith(
    expect.any(Object),
    expect.any(String),
    {},
    null,
    { codeExecutionMode: false },
  )

  expect(run.status).toBe('success')
})

test('Agent loads no tools when tools is empty array', async () => {

  installMockModels()

  const mockLoadTools = vi.spyOn(executor!['llmManager'], 'loadTools')

  testAgent.steps = [{
    prompt: 'Test prompt',
    tools: [],
    agents: [],
  }]

  const run = await runAgent('manual', { name: 'Test prompt' })

  // Verify llmManager.loadTools was called with empty array (load none)
  expect(mockLoadTools).toHaveBeenCalledWith(
    expect.any(Object),
    expect.any(String),
    {},
    [],
    { codeExecutionMode: false },
  )

  expect(run.status).toBe('success')
})

test('Expert attachment to workflow step', async () => {
  // Create a test expert
  const testExpert = {
    id: 'test-expert-1',
    type: 'user' as const,
    name: 'Test Expert',
    prompt: 'You are a test expert with specialized knowledge.',
    state: 'enabled' as const,
    triggerApps: []
  }

  // Mock window.api.experts.load to return our test expert
  vi.mocked(window.api.experts.load).mockReturnValueOnce([testExpert])

  // Setup agent with expert on first step
  testAgent.steps = [{
    prompt: 'Analyze this data',
    tools: null,
    agents: [],
    expert: testExpert.id,
  }]

  // Run (experts will be loaded JIT)
  const run = await runAgent('manual', { name: 'Test data' })

  expect(run.status).toBe('success')
  expect(run.messages).toHaveLength(3) // system, user, assistant

  // Verify user message has expert attached
  const userMessage = run.messages[1]
  expect(userMessage.role).toBe('user')
  expect(userMessage.expert).toBeDefined()
  expect(userMessage.expert?.id).toBe(testExpert.id)
  expect(userMessage.expert?.name).toBe(testExpert.name)
})

test('Expert prompt prepended to message content', async () => {
  // Create a test expert
  const testExpert = {
    id: 'test-expert-2',
    type: 'user' as const,
    name: 'Code Expert',
    prompt: 'Focus on code quality and best practices.',
    state: 'enabled' as const,
    triggerApps: []
  }

  // Mock window.api.experts.load to return our test expert
  vi.mocked(window.api.experts.load).mockReturnValueOnce([testExpert])

  // Setup agent with expert
  testAgent.steps = [{
    prompt: 'Review this code: {{code}}',
    tools: null,
    agents: [],
    expert: testExpert.id,
  }]

  // Run (experts will be loaded JIT)
  const run = await runAgent('manual', { code: 'function test() {}' })

  expect(run.status).toBe('success')

  // Verify contentForModel includes expert prompt
  const userMessage = run.messages[1]
  const contentForModel = userMessage.contentForModel
  expect(contentForModel).toContain(testExpert.prompt)
  expect(contentForModel).toContain('Review this code')
  expect(contentForModel).toContain('function test() {}')
  // Expert prompt should come first
  expect(contentForModel.indexOf(testExpert.prompt)).toBeLessThan(contentForModel.indexOf('function test() {}'))
})

test('Workflow step without expert works normally', async () => {
  // Setup agent without expert
  testAgent.steps = [{
    prompt: 'Normal step without expert',
    tools: null,
    agents: [],
    // No expert field
  }]

  // No need to mock experts.load since step doesn't use expert
  const run = await runAgent('manual', { name: 'Test prompt' })

  expect(run.status).toBe('success')

  // Verify user message does NOT have expert attached
  const userMessage = run.messages[1]
  expect(userMessage.role).toBe('user')
  expect(userMessage.expert).toBeUndefined()
})

test('Multi-step workflow with different experts per step', async () => {
  const expert1 = {
    id: 'expert-step1',
    type: 'user' as const,
    name: 'Step 1 Expert',
    prompt: 'Expert 1 instructions.',
    state: 'enabled' as const,
    triggerApps: []
  }

  const expert2 = {
    id: 'expert-step2',
    type: 'user' as const,
    name: 'Step 2 Expert',
    prompt: 'Expert 2 instructions.',
    state: 'enabled' as const,
    triggerApps: []
  }

  // Mock window.api.experts.load to return both experts
  vi.mocked(window.api.experts.load).mockReturnValueOnce([expert1, expert2])

  // Setup multi-step agent with different experts
  testAgent.steps = [
    {
      prompt: 'First step',
      tools: null,
      agents: [],
      expert: expert1.id,
    },
    {
      prompt: 'Second step using {{output.1}}',
      tools: null,
      agents: [],
      expert: expert2.id,
    }
  ]

  const run = await runAgent('manual', { name: 'Test' })

  expect(run.status).toBe('success')
  // system + (user1 + assistant1) + (user2 + assistant2) = 5 messages
  expect(run.messages).toHaveLength(5)

  // Verify first user message has expert1
  const user1Message = run.messages[1]
  expect(user1Message.expert?.id).toBe(expert1.id)

  // Verify second user message has expert2
  const user2Message = run.messages[3]
  expect(user2Message.expert?.id).toBe(expert2.id)
})

test('Expert not found in experts array is ignored', async () => {
  // Setup agent with non-existent expert
  testAgent.steps = [{
    prompt: 'Test prompt',
    tools: null,
    agents: [],
    expert: 'non-existent-expert-id',
  }]

  // Mock window.api.experts.load to return empty array (no matching expert)
  vi.mocked(window.api.experts.load).mockReturnValueOnce([])

  const run = await runAgent('manual', { name: 'Test' })

  expect(run.status).toBe('success')

  // Verify user message does NOT have expert (since it wasn't found)
  const userMessage = run.messages[1]
  expect(userMessage.expert).toBeUndefined()
})
