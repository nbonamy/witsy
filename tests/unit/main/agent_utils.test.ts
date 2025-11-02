import { vi, expect, test, beforeEach } from 'vitest'
import { App } from 'electron'
import { generateWebhookToken, findAgentByWebhookToken, AgentExecutor } from '../../../src/main/agent_utils'
import * as workspaceModule from '../../../src/main/workspace'
import * as agentsModule from '../../../src/main/agents'
import * as configModule from '../../../src/main/config'
import AgentWorkflowExecutor from '../../../src/services/agent_executor_workflow'

// Mock dependencies
vi.mock('../../../src/main/workspace')
vi.mock('../../../src/main/agents')
vi.mock('../../../src/main/config')
vi.mock('../../../src/services/agent_executor_workflow')
vi.mock('../../../src/main/interpreter', () => ({
  runPython: vi.fn()
}))
vi.mock('../../../src/main/search', () => ({
  default: vi.fn().mockImplementation(() => ({
    search: vi.fn()
  }))
}))
vi.mock('../../../src/main/i18n', () => ({
  getLocaleMessages: vi.fn(() => ({}))
}))
vi.mock('../../../src/services/i18n', () => ({
  initI18n: vi.fn()
}))

const mockApp = {} as App

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(workspaceModule.listWorkspaces).mockReturnValue([])
  vi.mocked(agentsModule.listAgents).mockReturnValue([])
  vi.mocked(agentsModule.saveAgent).mockReturnValue(true)
})

test('generateWebhookToken generates 8 character token', () => {
  // Mocks already set in beforeEach

  const token = generateWebhookToken(mockApp, 'workspace-1', 'agent-1')

  expect(token).toHaveLength(8)
  expect(token).toMatch(/^[a-z0-9]+$/)
})

test('generateWebhookToken ensures uniqueness', () => {
  // Mock existing agent with token 'aaaa0000'
  const existingAgent = {
    uuid: 'existing-agent',
    webhookToken: 'aaaa0000'
  }

  vi.mocked(workspaceModule.listWorkspaces).mockReturnValue([
    { uuid: 'workspace-1', name: 'Workspace 1' }
  ])

  vi.mocked(agentsModule.listAgents).mockReturnValue([
    existingAgent,
    { uuid: 'agent-1', webhookToken: null }
  ])

  const token = generateWebhookToken(mockApp, 'workspace-1', 'agent-1')

  // Token should be different from existing one
  expect(token).not.toBe('aaaa0000')
  expect(token).toHaveLength(8)
})

test('generateWebhookToken returns unique token for agent', () => {
  vi.mocked(agentsModule.listAgents).mockReturnValue([
    { uuid: 'agent-1', webhookToken: null } as any
  ])

  const token = generateWebhookToken(mockApp, 'workspace-1', 'agent-1')

  expect(token).toHaveLength(8)
  expect(token).toMatch(/^[a-z0-9]+$/)
  expect(agentsModule.saveAgent).not.toHaveBeenCalled()
})

test('generateWebhookToken throws after max attempts', () => {
  // Mock that all tokens are taken
  vi.mocked(workspaceModule.listWorkspaces).mockReturnValue([
    { uuid: 'workspace-1', name: 'Workspace 1' }
  ])

  // Create 10 agents with different tokens that will collide with any generated token
  const tokens = ['aaaaaaaa', 'bbbbbbbb', 'cccccccc', 'dddddddd', 'eeeeeeee', 'ffffffff', 'gggggggg', 'hhhhhhhh', 'iiiiiiii', 'jjjjjjjj']

  vi.mocked(agentsModule.listAgents).mockReturnValue(
    tokens.map((token, i) => ({ uuid: `existing-${i}`, webhookToken: token } as any))
  )

  // Mock Math.random to return values that will generate the same tokens as above
  vi.spyOn(Math, 'random').mockImplementation(() => {
    // Generate the same token each time by returning 0, which gives us 'aaaaaaaa'
    return 0
  })

  expect(() => {
    generateWebhookToken(mockApp, 'workspace-1', 'agent-1')
  }).toThrow('Failed to generate unique webhook token')

  vi.restoreAllMocks()
})

test('findAgentByWebhookToken finds agent in first workspace', () => {
  const targetAgent = {
    uuid: 'agent-1',
    name: 'Test Agent',
    webhookToken: 'abc12345'
  }

  vi.mocked(workspaceModule.listWorkspaces).mockReturnValue([
    { uuid: 'workspace-1', name: 'Workspace 1' },
    { uuid: 'workspace-2', name: 'Workspace 2' }
  ])

  vi.mocked(agentsModule.listAgents).mockImplementation((app: App, workspaceId: string) => {
    if (workspaceId === 'workspace-1') {
      return [targetAgent]
    }
    return []
  })

  const result = findAgentByWebhookToken(mockApp, 'abc12345')

  expect(result).toEqual({
    agent: targetAgent,
    workspaceId: 'workspace-1'
  })
})

test('findAgentByWebhookToken finds agent in second workspace', () => {
  const targetAgent = {
    uuid: 'agent-2',
    name: 'Test Agent 2',
    webhookToken: 'xyz99999'
  }

  vi.mocked(workspaceModule.listWorkspaces).mockReturnValue([
    { uuid: 'workspace-1', name: 'Workspace 1' },
    { uuid: 'workspace-2', name: 'Workspace 2' }
  ])

  vi.mocked(agentsModule.listAgents).mockImplementation((app: App, workspaceId: string) => {
    if (workspaceId === 'workspace-2') {
      return [targetAgent]
    }
    return []
  })

  const result = findAgentByWebhookToken(mockApp, 'xyz99999')

  expect(result).toEqual({
    agent: targetAgent,
    workspaceId: 'workspace-2'
  })
})

test('findAgentByWebhookToken returns null for invalid token', () => {
  vi.mocked(workspaceModule.listWorkspaces).mockReturnValue([
    { uuid: 'workspace-1', name: 'Workspace 1' }
  ])

  vi.mocked(agentsModule.listAgents).mockReturnValue([
    { uuid: 'agent-1', webhookToken: 'validtoken' }
  ])

  const result = findAgentByWebhookToken(mockApp, 'invalidtoken')

  expect(result).toBeNull()
})

test('findAgentByWebhookToken searches all workspaces', () => {
  vi.mocked(workspaceModule.listWorkspaces).mockReturnValue([
    { uuid: 'workspace-1', name: 'Workspace 1' },
    { uuid: 'workspace-2', name: 'Workspace 2' },
    { uuid: 'workspace-3', name: 'Workspace 3' }
  ])

  vi.mocked(agentsModule.listAgents).mockReturnValue([])

  findAgentByWebhookToken(mockApp, 'notfound')

  expect(agentsModule.listAgents).toHaveBeenCalledTimes(3)
  expect(agentsModule.listAgents).toHaveBeenCalledWith(mockApp, 'workspace-1')
  expect(agentsModule.listAgents).toHaveBeenCalledWith(mockApp, 'workspace-2')
  expect(agentsModule.listAgents).toHaveBeenCalledWith(mockApp, 'workspace-3')
})

test('AgentExecutor sets up mocks and calls AgentWorkflowExecutor', async () => {
  const mockAgent = {
    uuid: 'agent-1',
    name: 'Test Agent'
  }

  const mockRun = {
    uuid: 'run-1',
    agentId: 'agent-1',
    status: 'success'
  }

  const mockExecutor = {
    run: vi.fn().mockResolvedValue(mockRun)
  }

  // @ts-expect-error mocking
  AgentWorkflowExecutor.mockImplementation(() => mockExecutor)

  const mockConfig = {
    general: { locale: 'en-US' },
    llm: { locale: 'en-US' }
  }

  vi.mocked(configModule.loadSettings).mockReturnValue(mockConfig as any)

  const mockMcp = {
    getLlmTools: vi.fn(),
    callTool: vi.fn()
  }

  // @ts-expect-error partial types
  const executor = new AgentExecutor(mockApp, mockMcp)
  const result = await executor.runAgent('workspace-1', mockAgent, 'webhook', 'Test prompt')

  expect(AgentWorkflowExecutor).toHaveBeenCalledWith(mockConfig, 'workspace-1', mockAgent)
  expect(mockExecutor.run).toHaveBeenCalledWith('webhook', 'Test prompt', expect.objectContaining({
    model: undefined,
    runId: undefined
  }))
  expect(result).toEqual(mockRun)

  // Verify global.window was mocked
  expect(global.window).toBeDefined()
  expect(global.window.api).toBeDefined()
  expect(global.window.api.config).toBeDefined()
  expect(global.window.api.agents).toBeDefined()
  expect(global.window.api.interpreter).toBeDefined()
  expect(global.window.api.search).toBeDefined()
  expect(global.window.api.mcp).toBeDefined()
})
