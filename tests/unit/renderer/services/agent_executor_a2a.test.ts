import { vi, beforeAll, beforeEach, expect, test } from 'vitest'
import { useWindowMock } from '../mocks/window'
import { createI18nMock } from '../mocks'
import { store } from '../../src/renderer/services/store'
import AgentA2AExecutor from '../../src/renderer/services/agent_executor_a2a'
import Agent from '../../src/models/agent'
import Chat from '../../src/models/chat'
import { installMockModels } from '../mocks/llm'

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
        yield { type: 'content', text: ' chunk 2', done: false }
        yield { type: 'content', text: '', done: true }
      })
    }))
  }
})

let executor: AgentA2AExecutor|null = null
let testAgent: Agent

const createTestAgent = (): Agent => {
  const agent = new Agent()
  agent.uuid = 'test-a2a-agent'
  agent.name = 'Test A2A Agent'
  agent.description = 'A test A2A agent'
  agent.source = 'a2a'
  agent.instructions = 'https://example.com/a2a'
  agent.steps = [{
    prompt: '',
    tools: [],
    agents: [],
  }]

  return agent
}

beforeAll(() => {
  useWindowMock({ noAdditionalInstructions: true })
  store.loadExperts()
})

beforeEach(() => {
  vi.clearAllMocks()
  store.loadSettings()
  installMockModels()

  testAgent = createTestAgent()
  executor = new AgentA2AExecutor(store.config, store.workspace.uuid, testAgent)
})

test('AgentA2AExecutor Creation', () => {
  expect(executor).not.toBeNull()
  expect(executor!.agent).toBe(testAgent)
  expect(executor!.workspaceId).toBe(store.workspace.uuid)
})

test('Basic A2A Agent Run - Success', async () => {
  // A2A agents typically have empty prompts, so we pass the user's message directly
  testAgent.steps[0].prompt = '{{message}}'
  const run = await executor!.run('manual', { message: 'Hello A2A agent' }, { ephemeral: true })

  expect(run).toBeDefined()
  expect(run.uuid).toBeDefined()
  expect(run.agentId).toBe(testAgent.uuid)
  expect(run.trigger).toBe('manual')
  expect(run.status).toBe('success')
  expect(run.prompt).toBe('Hello A2A agent')
  expect(run.messages).toHaveLength(3) // system, user, assistant
  expect(run.messages[0].role).toBe('system')
  expect(run.messages[1].role).toBe('user')
  expect(run.messages[1].content).toBe('Hello A2A agent')
  expect(run.messages[2].role).toBe('assistant')
  expect(run.messages[2].content).toContain('A2A response chunk 1 chunk 2')
})

test('A2A Agent Run with Chat Integration', async () => {
  const chat = new Chat()
  testAgent.steps[0].prompt = '{{message}}'

  const run = await executor!.run('manual', { message: 'Chat integration test' }, {
    chat,
    ephemeral: true
  })

  expect(run.status).toBe('success')
  expect(chat.messages).toHaveLength(2) // user + assistant (no system in a2a)
  expect(chat.messages[0].content).toBe('Chat integration test')
  expect(chat.messages[1].agentId).toBe(testAgent.uuid)
  expect(chat.messages[1].agentRunId).toBe(run.uuid)
})

test('A2A Agent Run handles abort signal', async () => {
  testAgent.steps[0].prompt = '{{message}}'
  const abortController = new AbortController()

  // Abort before starting
  abortController.abort()

  const run = await executor!.run('manual', { message: 'Abort test' }, {
    abortSignal: abortController.signal
  })

  expect(run.status).toBe('canceled')
})

test('A2A Agent Run with a2aContext', async () => {
  testAgent.steps[0].prompt = '{{message}}'
  const a2aContext = {
    currentTaskId: 'task-123',
    currentContextId: 'context-456'
  }

  const run = await executor!.run('manual', { message: 'Context test' }, {
    a2aContext,
    ephemeral: true
  })

  expect(run.status).toBe('success')
})

test('A2A Agent Run with callback', async () => {
  testAgent.steps[0].prompt = '{{message}}'
  const chunks: any[] = []
  const callback = (chunk: any) => {
    if (chunk) chunks.push(chunk)
  }

  const run = await executor!.run('manual', { message: 'Callback test' }, {
    callback,
    ephemeral: true
  })

  expect(run.status).toBe('success')
  expect(chunks.length).toBeGreaterThan(0)
  expect(chunks.some(c => c.type === 'content')).toBe(true)
})

test('A2A Agent Run handles status chunks', async () => {
  testAgent.steps[0].prompt = '{{message}}'
  // Mock A2A client to return status chunks
  const A2AClient = (await import('../../src/renderer/services/a2a-client')).default
  vi.mocked(A2AClient).mockImplementationOnce(() => ({
    execute: async function* () {
      yield { type: 'status', taskId: 'task-1', contextId: 'ctx-1' }
      yield { type: 'status', taskId: 'task-1', contextId: 'ctx-1', status: 'Working on it...' }
      yield { type: 'content', text: 'Done', done: true }
    }
  }) as any)

  const freshExecutor = new AgentA2AExecutor(store.config, store.workspace.uuid, testAgent)
  const chat = new Chat()
  const run = await freshExecutor.run('manual', { message: 'Status test' }, {
    chat,
    ephemeral: true
  })

  expect(run.status).toBe('success')
  // a2aContext should be set by first status chunk and maintained
  expect(chat.messages[1].a2aContext).toBeDefined()
  expect(chat.messages[1].a2aContext.currentTaskId).toBe('task-1')
})

test('A2A Agent Run handles artifact chunks', async () => {
  testAgent.steps[0].prompt = '{{message}}'
  // Mock A2A client to return artifact chunks
  const A2AClient = (await import('../../src/renderer/services/a2a-client')).default
  vi.mocked(A2AClient).mockImplementation(() => ({
    execute: vi.fn(async function* () {
      yield { type: 'artifact', name: 'test.txt', content: 'File content here' }
      yield { type: 'content', text: '', done: true }
    })
  }) as any)

  const run = await executor!.run('manual', { message: 'Artifact test' }, { ephemeral: true })

  expect(run.status).toBe('success')
  expect(run.messages[2].content).toContain('<artifact title="test.txt">')
  expect(run.messages[2].content).toContain('File content here')
})

test('A2A Agent Run with non-ephemeral storage', async () => {
  testAgent.steps[0].prompt = '{{message}}'
  const saveSpy = vi.spyOn(window.api.agents, 'saveRun')

  const run = await executor!.run('manual', { message: 'Storage test' }, {
    ephemeral: false
  })

  expect(run.status).toBe('success')
  expect(saveSpy).toHaveBeenCalled()
})

test('A2A Agent Run handles errors', async () => {
  testAgent.steps[0].prompt = '{{message}}'
  // Create new executor with fresh mock that throws
  const A2AClient = (await import('../../src/renderer/services/a2a-client')).default
  vi.mocked(A2AClient).mockImplementationOnce(() => ({
    // eslint-disable-next-line require-yield
    execute: async function* () {
      throw new Error('A2A connection failed')
    }
  }) as any)

  const freshExecutor = new AgentA2AExecutor(store.config, store.workspace.uuid, testAgent)
  const run = await freshExecutor.run('manual', { message: 'Error test' }, { ephemeral: true })

  expect(run.status).toBe('error')
  expect(run.error).toBe('A2A connection failed')
})

test('A2A Agent Run different triggers', async () => {
  testAgent.steps[0].prompt = '{{message}}'
  const triggers = ['manual', 'schedule', 'webhook', 'workflow'] as const

  for (const trigger of triggers) {
    // Reset mock for each iteration
    const A2AClient = (await import('../../src/renderer/services/a2a-client')).default
    vi.mocked(A2AClient).mockImplementation(() => ({
      execute: async function* () {
        yield { type: 'content', text: 'Response', done: true }
      }
    }) as any)

    const freshExecutor = new AgentA2AExecutor(store.config, store.workspace.uuid, testAgent)
    const run = await freshExecutor.run(trigger, { message: `${trigger} test` }, { ephemeral: true })
    expect(run.trigger).toBe(trigger)
    expect(run.status).toBe('success')
  }
})
