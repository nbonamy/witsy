/**
 * Main Process Agent Execution Integration Test
 *
 * PURPOSE:
 * This test exists to catch a specific class of bugs where the production global window mock
 * (installGlobalMock in src/main/llm_utils.ts) is missing API methods that plugins rely on,
 * while the test window mock (useWindowMock in tests/mocks/window.ts) has them.
 *
 * THE PROBLEM:
 * - Agents running in main process (e.g., Scheduler, webhook handlers) use AgentExecutor
 * - AgentExecutor calls installGlobalMock() to create global.window for Node.js environment
 * - Plugins (like KnowledgePlugin) call window.api.docrepo.list(), window.api.docrepo.query(), etc.
 * - Regular unit tests use useWindowMock() which has all the mocks
 * - If installGlobalMock() is missing a mock that plugins need, tests pass but production fails
 *
 * HISTORICAL BUG:
 * The docrepo mocks were missing from installGlobalMock, causing all scheduled agents with
 * knowledge tools to fail at runtime. Unit tests didn't catch this because they used
 * useWindowMock() which had complete docrepo mocks.
 *
 * HOW THIS TEST PREVENTS THE BUG:
 * 1. Uses the real AgentExecutor (which calls installGlobalMock, not useWindowMock)
 * 2. Creates an agent with tools: null (enables ALL tools including knowledge)
 * 3. Executes the agent through the same code path as Scheduler
 * 4. Verifies that window.api.docrepo and other critical APIs exist and work
 * 5. If installGlobalMock is missing any mocks, the test fails immediately
 *
 * This ensures parity between test mocks and production mocks, catching integration issues
 * that would only appear at runtime in production.
 */

import { beforeEach, describe, expect, test, vi, afterEach } from 'vitest'
import { App } from 'electron'
import { AgentExecutor } from '../../src/main/agent_utils'
import Mcp from '../../src/main/mcp'
import DocumentRepository from '../../src/main/rag/docrepo'
import Agent from '../../src/models/agent'
import * as configModule from '../../src/main/config'
import * as agentsModule from '../../src/main/agents'
import * as interpreterModule from '../../src/main/interpreter'
import * as workspaceModule from '../../src/main/workspace'
import * as i18nModule from '../../src/renderer/services/i18n'
import * as mainI18nModule from '../../src/main/i18n'
import * as searchModule from '../../src/main/search'
import { Configuration } from '../../src/types/config'
import { DocumentBase } from '../../src/types/rag'
import { WorkspaceHeader } from '../../src/types/workspace'

// Mock external dependencies
vi.mock('../../src/main/config')
vi.mock('../../src/main/agents')
vi.mock('../../src/main/interpreter')
vi.mock('../../src/main/i18n')
vi.mock('../../src/main/search')
vi.mock('../../src/main/workspace')
vi.mock('../../src/renderer/services/i18n')
vi.mock('../../src/renderer/services/agent_executor_workflow')

// Mock LLM execution
vi.mock('../../src/renderer/services/agent_executor_workflow', () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      run: vi.fn(async () => ({
        uuid: 'run-1',
        agentId: 'test-agent',
        status: 'success',
        trigger: 'manual',
        prompt: 'Test prompt',
        messages: [
          { role: 'user', content: 'Test prompt' },
          { role: 'assistant', content: 'Mock LLM response' }
        ],
        toolCalls: [],
        createdAt: Date.now(),
        updatedAt: Date.now()
      }))
    }))
  }
})

describe('AgentExecutor - Main Process Integration', () => {
  let executor: AgentExecutor
  let mockApp: App
  let mockMcp: Mcp
  let mockDocRepo: DocumentRepository
  let mockConfig: Configuration
  let mockDocRepos: DocumentBase[]
  let originalConsoleLog: any

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks()

    // Mock console.log to avoid noise
    originalConsoleLog = console.log
    console.log = vi.fn()

    // Create mock app
    mockApp = {
      getPath: vi.fn(() => '/mock/path'),
      getName: vi.fn(() => 'witsy'),
      getVersion: vi.fn(() => '1.0.0')
    } as any

    // Create mock MCP
    mockMcp = {
      getLlmTools: vi.fn(async () => []),
      callTool: vi.fn(async () => ({ result: 'mcp result' })),
      isAvailable: vi.fn(() => true)
    } as any

    // Create mock document repositories
    mockDocRepos = [
      {
        uuid: 'repo1',
        name: 'Test Repo 1',
        description: 'Test repository for knowledge search',
        embeddingEngine: 'openai',
        embeddingModel: 'text-embedding-ada-002',
        workspaceId: 'workspace1',
        documents: []
      }
    ]

    // Create mock document repository
    mockDocRepo = {
      list: vi.fn((workspaceId: string) => mockDocRepos.filter(r => r.workspaceId === workspaceId)),
      query: vi.fn(async (baseId: string, query: string) => [
        {
          content: `Mock result for: ${query}`,
          score: 0.95,
          metadata: {
            uuid: '1',
            type: 'file',
            title: 'Test Document',
            url: 'file:///test.txt',
            origin: '/test.txt',
            filename: 'test.txt'
          }
        }
      ])
    } as any

    // Setup default config
    mockConfig = {
      features: {
        agents: true
      },
      general: {
        locale: 'en-US'
      },
      llm: {
        locale: 'en-US'
      },
      engines: {
        mock: {
          apiKey: 'test-key',
          models: { chat: [] }
        }
      },
      plugins: {
        knowledge: { enabled: true }
      }
    } as any

    // Mock module functions
    vi.mocked(configModule.loadSettings).mockReturnValue(mockConfig)
    vi.mocked(agentsModule.listAgents).mockReturnValue([])
    vi.mocked(agentsModule.saveAgentRun).mockReturnValue(true)
    vi.mocked(interpreterModule.runPython).mockResolvedValue('python result')
    vi.mocked(workspaceModule.listWorkspaces).mockReturnValue([
      { uuid: 'workspace1', name: 'Test Workspace' } as WorkspaceHeader
    ])
    vi.mocked(i18nModule.initI18n).mockReturnValue(undefined)
    vi.mocked(mainI18nModule.getLocaleMessages).mockReturnValue({})

    // Mock search
    vi.mocked(searchModule.default).mockImplementation(() => ({
      search: vi.fn(() => [])
    }) as any)

    // Create executor instance
    executor = new AgentExecutor(mockApp, mockMcp, mockDocRepo)
  })

  afterEach(() => {
    // Restore console.log
    console.log = originalConsoleLog

    // Clean up global window mock
    delete (global as any).window
  })

  test('runAgent executes with all tools enabled and uses installGlobalMock', async () => {
    // Create test agent with all tools enabled (tools: null)
    const testAgent = new Agent()
    testAgent.uuid = 'test-agent'
    testAgent.name = 'Test Agent'
    testAgent.description = 'Test agent with all tools enabled'
    testAgent.engine = 'mock'
    testAgent.model = 'chat'
    testAgent.locale = 'en-US'
    testAgent.instructions = 'Test instructions'
    testAgent.steps = [{
      prompt: 'Execute test with all available tools',
      tools: null, // This enables ALL tools including knowledge plugin
      agents: [],
    }]

    // Run the agent - this should call installGlobalMock internally
    const run = await executor.runAgent(
      'workspace1',
      testAgent,
      'manual',
      'Test prompt'
    )

    // Verify execution completed successfully
    expect(run).toBeDefined()
    expect(run.status).toBe('success')
    expect(run.agentId).toBe('test-agent')

    // Verify global.window was installed by installGlobalMock
    expect((global as any).window).toBeDefined()
    expect((global as any).window.api).toBeDefined()

    // Verify critical mocks are present (these are what plugins need)
    expect((global as any).window.api.docrepo).toBeDefined()
    expect((global as any).window.api.docrepo.list).toBeDefined()
    expect((global as any).window.api.docrepo.query).toBeDefined()
    expect((global as any).window.api.config).toBeDefined()
    expect((global as any).window.api.agents).toBeDefined()
    expect((global as any).window.api.interpreter).toBeDefined()
    expect((global as any).window.api.search).toBeDefined()
    expect((global as any).window.api.mcp).toBeDefined()
  })

  test('installGlobalMock docrepo functions work correctly', async () => {
    // Create and run agent to trigger installGlobalMock
    const testAgent = new Agent()
    testAgent.uuid = 'test-agent-2'
    testAgent.name = 'Test Agent 2'
    testAgent.engine = 'mock'
    testAgent.model = 'chat'
    testAgent.locale = 'en-US'
    testAgent.steps = [{
      prompt: 'Test',
      tools: null,
      agents: [],
    }]

    await executor.runAgent('workspace1', testAgent, 'manual', 'Test')

    // Test that docrepo.list works through the mock
    const repos = (global as any).window.api.docrepo.list('workspace1')
    expect(repos).toBeDefined()
    expect(Array.isArray(repos)).toBe(true)
    expect(repos.length).toBe(1)
    expect(repos[0].uuid).toBe('repo1')

    // Test that docrepo.query works through the mock
    const results = await (global as any).window.api.docrepo.query('repo1', 'test query')
    expect(results).toBeDefined()
    expect(Array.isArray(results)).toBe(true)
    expect(results[0].content).toContain('Mock result for: test query')
  })

  test('Multiple agent runs maintain global mock state', async () => {
    const testAgent = new Agent()
    testAgent.uuid = 'test-agent-3'
    testAgent.name = 'Test Agent 3'
    testAgent.engine = 'mock'
    testAgent.model = 'chat'
    testAgent.locale = 'en-US'
    testAgent.steps = [{
      prompt: 'Test',
      tools: null,
      agents: [],
    }]

    // Run agent twice
    await executor.runAgent('workspace1', testAgent, 'manual', 'First run')
    await executor.runAgent('workspace1', testAgent, 'manual', 'Second run')

    // Global mock should still be present and functional
    expect((global as any).window.api.docrepo).toBeDefined()
    const repos = (global as any).window.api.docrepo.list('workspace1')
    expect(repos.length).toBe(1)
  })
})
