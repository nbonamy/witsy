
import { AgentRun } from '@/types'
import { vi, beforeAll, expect, test, beforeEach } from 'vitest'
import { useWindowMock } from '@tests/mocks/window'
import * as main from '@main/agents'
import { app } from 'electron'
import fs from 'fs'

vi.mock('electron', async() => {
  return {
    app: {
      getPath: vi.fn(() => './tests/fixtures'),
    },
  }
})

vi.mock('fs', async (importOriginal) => {
  const mod: any = await importOriginal()
  return { default: {
    ...mod,
    writeFileSync: vi.fn(),
    unlinkSync: vi.fn(),
    rmSync: vi.fn(),
  }}
})

vi.mock('@main/windows/index', async () => {
  return {
    emitIpcEventToAll: vi.fn(),
  }
})

beforeAll(() => {
  useWindowMock()
})

beforeEach(() => {
  vi.clearAllMocks()
})

test('Load agents', () => {
  const agents = main.listAgents(app, 'test-workspace')
  expect(agents).toHaveLength(2)
  expect(agents[0]).toMatchObject({
    uuid: 'agent1',
    source: 'witsy',
    createdAt: 1000000000000,
    updatedAt: 1000000005000,
    name: 'Name1',
    description: 'Description1',
    engine: 'engine1',
    model: 'model1',
    modelOpts: {},
    disableStreaming: true,
    locale: 'locale1',
    instructions: 'instructions1',
    parameters: [ { name: 'param1', type: 'string', description: 'Description1', required: true } ],
    schedule: '*/5 * * * *',
    steps: [{
      tools: [ 'tool1', 'tool2' ],
      agents: [],
      docrepo: null,
      prompt: 'prompt1',
    }]
  })
  expect(agents[1]).toMatchObject({
    uuid: 'agent2',
    createdAt: 1000000000000,
    updatedAt: 1000000005000,
    name: 'Name2',
    description: 'Description2',
    engine: 'engine2',
    model: 'model2',
    modelOpts: {},
    disableStreaming: true,
    locale: 'locale2',
    instructions: 'instructions2',
    parameters: [],
    schedule: '*/5 * * * *',
    steps: [{
      tools: [ 'tool1', 'tool2' ],
      agents: [ 'agent1' ],
      docrepo: null,
      prompt: 'prompt2',
    }]
  })
})

test('Save agent', () => {
  const agent = {
    uuid: 'agent3',
    source: 'witsy',
    createdAt: 1000000000000,
    updatedAt: 1000000005000,
    name: 'Name3',
    description: 'Description3',
    type: 'runnable',
    engine: 'engine3',
    model: 'model3',
    modelOpts: {},
    disableStreaming: true,
    locale: 'locale3',
    instructions: 'instructions3',
    parameters: [],
    steps: [{
      tools: [
        'tool1',
        'tool2'
      ],
      agents: [],
      docrepo: null,
      prompt: 'prompt3'
    }],
    schedule: '*/5 * * * *',
    webhookToken: null,
    invocationValues: {},
  }
  const result = main.saveAgent(app, 'test-workspace', agent)
  expect(fs.writeFileSync).toHaveBeenCalledWith('tests/fixtures/workspaces/test-workspace/agents/agent3.json', JSON.stringify(agent, null, 2))
  expect(result).toBe(true)
})

test('Delete agent', () => {
  const result = main.deleteAgent(app, 'test-workspace', 'agent1')
  expect(fs.unlinkSync).toHaveBeenCalledWith('tests/fixtures/workspaces/test-workspace/agents/agent1.json')
  expect(fs.rmSync).toHaveBeenCalledWith('tests/fixtures/workspaces/test-workspace/agents/agent1', { recursive: true, force: true })
  expect(result).toBe(true)
})

test('Get agent runs', () => {
  const runs1: AgentRun[]|null = main.getAgentRuns(app, 'test-workspace', 'agent1')
  expect(runs1).toHaveLength(3)
  expect(runs1![0].uuid).toBe('run2')
  expect(runs1![1].uuid).toBe('run1')
  expect(runs1![2].uuid).toBe('run3')

  const runs2: AgentRun[]|null = main.getAgentRuns(app, 'test-workspace', 'agent2')
  expect(runs2).toHaveLength(0)
})

test('Save agent run', () => {
  const run = {
    uuid: 'run3',
    agentId: 'agent1',
  } as AgentRun
  const result = main.saveAgentRun(app, 'test-workspace', run)
  expect(fs.writeFileSync).toHaveBeenCalledWith('tests/fixtures/workspaces/test-workspace/agents/agent1/run3.json', JSON.stringify(run, null, 2))
  expect(result).toBe(true)
})

test('Delete agent runs', () => {
  const result = main.deleteAgentRuns(app, 'test-workspace', 'agent1')
  expect(fs.rmSync).toHaveBeenCalledWith('tests/fixtures/workspaces/test-workspace/agents/agent1', { recursive: true, force: true })
  expect(result).toBe(true)
})

test('Delete agent run', () => {
  const result = main.deleteAgentRun(app, 'test-workspace', 'agent1', 'run1')
  expect(fs.unlinkSync).toHaveBeenCalledWith('tests/fixtures/workspaces/test-workspace/agents/agent1/run1.json')
  expect(result).toBe(true)
})

test('Cancel stale running runs', () => {
  const count = main.cancelStaleRunningRuns(app)
  expect(count).toBe(1)
  expect(fs.writeFileSync).toHaveBeenCalledWith(
    'tests/fixtures/workspaces/test-workspace/agents/agent1/run3.json',
    expect.stringContaining('"status": "canceled"')
  )
})

test('Load agent success', () => {
  const agent = main.loadAgent(app, 'test-workspace', 'agent1')
  expect(agent).not.toBeNull()
  expect(agent!.uuid).toBe('agent1')
  expect(agent!.name).toBe('Name1')
})

test('Load agent not found', () => {
  const agent = main.loadAgent(app, 'test-workspace', 'nonexistent')
  expect(agent).toBeNull()
})

test('Get agent run success', () => {
  const run = main.getAgentRun(app, 'test-workspace', 'agent1', 'run1')
  expect(run).not.toBeNull()
  expect(run!.uuid).toBe('run1')
  expect(run!.status).toBe('success')
})

test('Get agent run not found', () => {
  const run = main.getAgentRun(app, 'test-workspace', 'agent1', 'nonexistent')
  expect(run).toBeNull()
})

test('List agents from nonexistent workspace returns empty', () => {
  const agents = main.listAgents(app, 'nonexistent-workspace')
  expect(agents).toHaveLength(0)
})

test('Get agent runs from nonexistent agent returns empty', () => {
  const runs = main.getAgentRuns(app, 'test-workspace', 'nonexistent-agent')
  expect(runs).toHaveLength(0)
})

test('Save agent handles write error', () => {
  vi.mocked(fs.writeFileSync).mockImplementationOnce(() => {
    throw new Error('Write error')
  })
  const agent = {
    uuid: 'agent-error',
    name: 'Error Agent',
    steps: [],
  }
  const result = main.saveAgent(app, 'test-workspace', agent as any)
  expect(result).toBe(false)
})

test('Delete agent handles error', () => {
  vi.mocked(fs.unlinkSync).mockImplementationOnce(() => {
    throw new Error('Delete error')
  })
  const result = main.deleteAgent(app, 'test-workspace', 'agent-error')
  expect(result).toBe(false)
})

test('Save agent run handles error', () => {
  vi.mocked(fs.writeFileSync).mockImplementationOnce(() => {
    throw new Error('Write error')
  })
  const run = { uuid: 'run-error', agentId: 'agent1' } as any
  const result = main.saveAgentRun(app, 'test-workspace', run)
  expect(result).toBe(false)
})

test('Delete agent runs handles error', () => {
  vi.mocked(fs.rmSync).mockImplementationOnce(() => {
    throw new Error('Delete error')
  })
  // Use existing agent path that will trigger rmSync
  const result = main.deleteAgentRuns(app, 'test-workspace', 'agent1')
  expect(result).toBe(false)
})

test('Delete agent run handles error', () => {
  vi.mocked(fs.unlinkSync).mockImplementationOnce(() => {
    throw new Error('Delete error')
  })
  const result = main.deleteAgentRun(app, 'test-workspace', 'agent1', 'run-error')
  expect(result).toBe(false)
})

