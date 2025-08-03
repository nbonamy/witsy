
import { AgentRun } from '../../src/types'
import { vi, beforeAll, expect, test, beforeEach } from 'vitest'
import { useWindowMock } from '../mocks/window'
import * as main from '../../src/main/agents'
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

vi.mock('../../src/main/windows/index', async () => {
  return {
    notifyBrowserWindows: vi.fn(),
  }
})

beforeAll(() => {
  useWindowMock()
})

beforeEach(() => {
  vi.clearAllMocks()
})

test('Load agents', () => {
  const agents = main.loadAgents(app)
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
    invocationValues: {},
  }
  const result = main.saveAgent(app, agent)
  expect(fs.writeFileSync).toHaveBeenCalledWith('tests/fixtures/agents/agent3.json', JSON.stringify(agent, null, 2))
  expect(result).toBe(true)
})

test('Delete agent', () => {
  const result = main.deleteAgent(app, 'agent1')
  expect(fs.unlinkSync).toHaveBeenCalledWith('tests/fixtures/agents/agent1.json')
  expect(fs.rmSync).toHaveBeenCalledWith('tests/fixtures/agents/agent1', { recursive: true, force: true })
  expect(result).toBe(true)
})

test('Get agent runs', () => {
  const runs1: AgentRun[]|null = main.getAgentRuns(app, 'agent1')
  expect(runs1).toHaveLength(2)
  expect(runs1![0].uuid).toBe('run2')
  expect(runs1![1].uuid).toBe('run1')

  const runs2: AgentRun[]|null = main.getAgentRuns(app, 'agent2')
  expect(runs2).toHaveLength(0)
})

test('Save agent run', () => {
  const run = {
    uuid: 'run3',
    agentId: 'agent1',
  } as AgentRun
  const result = main.saveAgentRun(app, run)
  expect(fs.writeFileSync).toHaveBeenCalledWith('tests/fixtures/agents/agent1/run3.json', JSON.stringify(run, null, 2))
  expect(result).toBe(true)
})

test('Delete agent runs', () => {
  const result = main.deleteAgentRuns(app, 'agent1')
  expect(fs.rmSync).toHaveBeenCalledWith('tests/fixtures/agents/agent1', { recursive: true, force: true })
  expect(result).toBe(true)
})

test('Delete agent run', () => {
  const result = main.deleteAgentRun(app, 'agent1', 'run1')
  expect(fs.unlinkSync).toHaveBeenCalledWith('tests/fixtures/agents/agent1/run1.json')
  expect(result).toBe(true)
})

