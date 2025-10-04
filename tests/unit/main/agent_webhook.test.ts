import { vi, expect, test, beforeEach, Mock } from 'vitest'
import { App } from 'electron'
import { installAgentWebhook } from '../../../src/main/agent_webhook'
import { HttpServer } from '../../../src/main/http_server'
import * as agentUtilsModule from '../../../src/main/agent_utils'
import * as configModule from '../../../src/main/config'
import Mcp from '../../../src/main/mcp'

vi.mock('../../../src/main/http_server')
vi.mock('../../../src/main/config')

// Create shared mock function that will be used by all instances
const mockRunAgentFn = vi.fn()

// Mock agent utils
vi.mock('../../../src/main/agent_utils', async () => {
  const actual = await vi.importActual('../../../src/main/agent_utils')
  return {
    ...actual,
    findAgentByWebhookToken: vi.fn(),
    AgentExecutor: vi.fn().mockImplementation(() => ({
      runAgent: mockRunAgentFn
    }))
  }
})

const mockApp = {} as App
const mockMcp = {} as Mcp

let mockHttpServer: Partial<HttpServer>
let mockRegister: Mock

beforeEach(() => {
  vi.clearAllMocks()
  mockRunAgentFn.mockClear()
  vi.spyOn(console, 'log').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})

  mockRegister = vi.fn()
  mockHttpServer = {
    register: mockRegister
  }

  vi.mocked(configModule.loadSettings).mockReturnValue({
    general: { locale: 'en-US' },
    llm: { locale: 'en-US' }
  } as any)
})

test('installAgentWebhook registers /agent/run/* endpoint', () => {
  installAgentWebhook(mockHttpServer as HttpServer, mockApp, mockMcp)

  expect(mockRegister).toHaveBeenCalledWith('/agent/run/*', expect.any(Function))
  expect(console.log).toHaveBeenCalledWith('[http] Agent webhook installed')
})

test('webhook endpoint returns 404 for invalid token', async () => {
  vi.mocked(agentUtilsModule.findAgentByWebhookToken).mockReturnValue(null)

  installAgentWebhook(mockHttpServer as HttpServer, mockApp, mockMcp)

  const handler = mockRegister.mock.calls[0][1]
  const mockReq = { method: 'GET', headers: {}, on: vi.fn() } as any
  const mockRes = { writeHead: vi.fn(), end: vi.fn() } as any
  const mockUrl = new URL('http://localhost:8090/agent/run/invalidtoken')

  await handler(mockReq, mockRes, mockUrl)

  expect(agentUtilsModule.findAgentByWebhookToken).toHaveBeenCalledWith(mockApp, 'invalidtoken')
  expect(mockRes.writeHead).toHaveBeenCalledWith(404, { 'Content-Type': 'application/json' })
  expect(mockRes.end).toHaveBeenCalledWith(JSON.stringify({ success: false, error: 'Agent not found' }))
})

test('webhook endpoint returns 400 if prompt building fails', async () => {
  const mockAgent = {
    uuid: 'agent-1',
    name: 'Test Agent',
    buildPrompt: vi.fn().mockReturnValue(null)
  }

  vi.mocked(agentUtilsModule.findAgentByWebhookToken).mockReturnValue({
    agent: mockAgent as any,
    workspaceId: 'workspace-1'
  })

  installAgentWebhook(mockHttpServer as HttpServer, mockApp, mockMcp)

  const handler = mockRegister.mock.calls[0][1]
  const mockReq = { method: 'GET', headers: {}, on: vi.fn() } as any
  const mockRes = { writeHead: vi.fn(), end: vi.fn() } as any
  const mockUrl = new URL('http://localhost:8090/agent/run/abc12345')

  await handler(mockReq, mockRes, mockUrl)

  expect(mockAgent.buildPrompt).toHaveBeenCalledWith(0, {})
  expect(mockRes.writeHead).toHaveBeenCalledWith(400, { 'Content-Type': 'application/json' })
  expect(mockRes.end).toHaveBeenCalledWith(JSON.stringify({ success: false, error: 'Failed to build prompt' }))
})

test('webhook endpoint successfully triggers agent with GET params', async () => {
  const mockAgent = {
    uuid: 'agent-1',
    name: 'Test Agent',
    buildPrompt: vi.fn().mockReturnValue('Generated prompt with name=John')
  }

  const mockRun = {
    uuid: 'run-1',
    agentId: 'agent-1',
    status: 'success'
  }

  vi.mocked(agentUtilsModule.findAgentByWebhookToken).mockReturnValue({
    agent: mockAgent as any,
    workspaceId: 'workspace-1'
  })

  mockRunAgentFn.mockResolvedValue(mockRun as any)

  installAgentWebhook(mockHttpServer as HttpServer, mockApp, mockMcp)

  const handler = mockRegister.mock.calls[0][1]
  const mockReq = { method: 'GET', headers: {}, on: vi.fn() } as any
  const mockRes = { writeHead: vi.fn(), end: vi.fn() } as any
  const mockUrl = new URL('http://localhost:8090/agent/run/abc12345?name=John&age=30')

  await handler(mockReq, mockRes, mockUrl)

  expect(mockAgent.buildPrompt).toHaveBeenCalledWith(0, { name: 'John', age: '30' })
  expect(mockRunAgentFn).toHaveBeenCalledWith(
    'workspace-1',
    mockAgent,
    'webhook',
    'Generated prompt with name=John',
    expect.any(String)
  )
  expect(mockRes.writeHead).toHaveBeenCalledWith(200, { 'Content-Type': 'application/json' })
  expect(mockRes.end).toHaveBeenCalledWith(expect.stringContaining('"success":true'))
  const response = JSON.parse(mockRes.end.mock.calls[0][0])
  expect(response.success).toBe(true)
  expect(response.runId).toBeDefined()
  expect(typeof response.runId).toBe('string')
})

test('webhook endpoint successfully triggers agent with POST JSON', async () => {
  const mockAgent = {
    uuid: 'agent-2',
    name: 'Test Agent 2',
    buildPrompt: vi.fn().mockReturnValue('Generated prompt with task=Deploy')
  }

  const mockRun = {
    uuid: 'run-2',
    agentId: 'agent-2',
    status: 'running'
  }

  vi.mocked(agentUtilsModule.findAgentByWebhookToken).mockReturnValue({
    agent: mockAgent as any,
    workspaceId: 'workspace-2'
  })

  mockRunAgentFn.mockResolvedValue(mockRun as any)

  installAgentWebhook(mockHttpServer as HttpServer, mockApp, mockMcp)

  const handler = mockRegister.mock.calls[0][1]

  const listeners: Record<string, (...args: any[]) => void> = {}
  const mockReq = {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    on: vi.fn((event: string, callback: (...args: any[]) => void) => {
      listeners[event] = callback
      return mockReq
    })
  } as any

  const mockRes = { writeHead: vi.fn(), end: vi.fn() } as any
  const mockUrl = new URL('http://localhost:8090/agent/run/xyz99999')

  const handlerPromise = handler(mockReq, mockRes, mockUrl)

  // Simulate POST body
  listeners['data'](JSON.stringify({ task: 'Deploy', env: 'production' }))
  listeners['end']()

  await handlerPromise

  expect(mockAgent.buildPrompt).toHaveBeenCalledWith(0, { task: 'Deploy', env: 'production' })
  expect(mockRunAgentFn).toHaveBeenCalledWith(
    'workspace-2',
    mockAgent,
    'webhook',
    'Generated prompt with task=Deploy',
    expect.any(String)
  )
  expect(mockRes.end).toHaveBeenCalledWith(expect.stringContaining('"success":true'))
  const response = JSON.parse(mockRes.end.mock.calls[0][0])
  expect(response.success).toBe(true)
  expect(response.runId).toBeDefined()
  expect(typeof response.runId).toBe('string')
})

test('webhook endpoint returns 200 even if agent fails asynchronously', async () => {
  const mockAgent = {
    uuid: 'agent-3',
    name: 'Error Agent',
    buildPrompt: vi.fn().mockReturnValue('Some prompt')
  }

  vi.mocked(agentUtilsModule.findAgentByWebhookToken).mockReturnValue({
    agent: mockAgent as any,
    workspaceId: 'workspace-3'
  })

  // runAgent is not awaited in the implementation, so errors won't be caught
  mockRunAgentFn.mockRejectedValue(new Error('Agent execution failed'))

  installAgentWebhook(mockHttpServer as HttpServer, mockApp, mockMcp)

  const handler = mockRegister.mock.calls[0][1]
  const mockReq = { method: 'GET', headers: {}, on: vi.fn() } as any
  const mockRes = { writeHead: vi.fn(), end: vi.fn() } as any
  const mockUrl = new URL('http://localhost:8090/agent/run/error123')

  await handler(mockReq, mockRes, mockUrl)

  // Since runAgent is not awaited, the webhook returns 200 immediately
  expect(mockRes.writeHead).toHaveBeenCalledWith(200, { 'Content-Type': 'application/json' })
  expect(mockRes.end).toHaveBeenCalledWith(expect.stringContaining('"success":true'))
})

test('webhook endpoint combines GET and POST parameters', async () => {
  const mockAgent = {
    uuid: 'agent-4',
    name: 'Combined Params Agent',
    buildPrompt: vi.fn().mockReturnValue('Prompt with all params')
  }

  const mockRun = {
    uuid: 'run-4',
    agentId: 'agent-4',
    status: 'success'
  }

  vi.mocked(agentUtilsModule.findAgentByWebhookToken).mockReturnValue({
    agent: mockAgent as any,
    workspaceId: 'workspace-4'
  })

  mockRunAgentFn.mockResolvedValue(mockRun as any)

  installAgentWebhook(mockHttpServer as HttpServer, mockApp, mockMcp)

  const handler = mockRegister.mock.calls[0][1]

  const listeners: Record<string, (...args: any[]) => void> = {}
  const mockReq = {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    on: vi.fn((event: string, callback: (...args: any[]) => void) => {
      listeners[event] = callback
      return mockReq
    })
  } as any

  const mockRes = { writeHead: vi.fn(), end: vi.fn() } as any
  const mockUrl = new URL('http://localhost:8090/agent/run/combined?fromQuery=yes')

  const handlerPromise = handler(mockReq, mockRes, mockUrl)

  listeners['data'](JSON.stringify({ fromBody: 'also' }))
  listeners['end']()

  await handlerPromise

  expect(mockAgent.buildPrompt).toHaveBeenCalledWith(0, { fromQuery: 'yes', fromBody: 'also' })
})
