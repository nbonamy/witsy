import { vi, expect, test, beforeEach, Mock } from 'vitest'
import { App } from 'electron'
import { installAgentWebhook } from '../../../src/main/agent_webhook'
import { HttpServer } from '../../../src/main/http_server'
import * as agentUtilsModule from '../../../src/main/agent_utils'
import * as configModule from '../../../src/main/config'
import * as agentsModule from '../../../src/main/agents'
import Mcp from '../../../src/main/mcp'

vi.mock('../../../src/main/http_server')
vi.mock('../../../src/main/config')
vi.mock('../../../src/main/agents')

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

test('installAgentWebhook registers /api/agent/run/* endpoint', () => {
  installAgentWebhook(mockHttpServer as HttpServer, mockApp, mockMcp)

  expect(mockRegister).toHaveBeenCalledWith('/api/agent/run/*', expect.any(Function))
  expect(console.log).toHaveBeenCalledWith('[http] Agent webhook installed')
})

test('webhook endpoint returns 404 for invalid token', async () => {
  vi.mocked(agentUtilsModule.findAgentByWebhookToken).mockReturnValue(null)

  installAgentWebhook(mockHttpServer as HttpServer, mockApp, mockMcp)

  const handler = mockRegister.mock.calls[0][1]
  const mockReq = { method: 'GET', headers: {}, on: vi.fn() } as any
  const mockRes = { writeHead: vi.fn(), end: vi.fn() } as any
  const mockUrl = new URL('http://localhost:8090/api/agent/run/invalidtoken')

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
  const mockUrl = new URL('http://localhost:8090/api/agent/run/abc12345')

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
  const mockUrl = new URL('http://localhost:8090/api/agent/run/abc12345?name=John&age=30')

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
  expect(response.statusUrl).toBe(`/api/agent/status/abc12345/${response.runId}`)
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
  const mockUrl = new URL('http://localhost:8090/api/agent/run/xyz99999')

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
  expect(response.statusUrl).toBe(`/api/agent/status/xyz99999/${response.runId}`)
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
  const mockUrl = new URL('http://localhost:8090/api/agent/run/error123')

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
  const mockUrl = new URL('http://localhost:8090/api/agent/run/combined?fromQuery=yes')

  const handlerPromise = handler(mockReq, mockRes, mockUrl)

  listeners['data'](JSON.stringify({ fromBody: 'also' }))
  listeners['end']()

  await handlerPromise

  expect(mockAgent.buildPrompt).toHaveBeenCalledWith(0, { fromQuery: 'yes', fromBody: 'also' })
})

test('installAgentWebhook registers status endpoint', () => {
  installAgentWebhook(mockHttpServer as HttpServer, mockApp, mockMcp)

  expect(mockRegister).toHaveBeenCalledWith('/api/agent/status/*', expect.any(Function))
})

test('status endpoint returns 404 for invalid token', async () => {
  vi.mocked(agentUtilsModule.findAgentByWebhookToken).mockReturnValue(null)

  installAgentWebhook(mockHttpServer as HttpServer, mockApp, mockMcp)

  const handler = mockRegister.mock.calls[1][1] // Second registered route
  const mockReq = { method: 'GET', headers: {}, on: vi.fn() } as any
  const mockRes = { writeHead: vi.fn(), end: vi.fn() } as any
  const mockUrl = new URL('http://localhost:8090/api/agent/status/invalidtoken/run-123')

  await handler(mockReq, mockRes, mockUrl)

  expect(agentUtilsModule.findAgentByWebhookToken).toHaveBeenCalledWith(mockApp, 'invalidtoken')
  expect(mockRes.writeHead).toHaveBeenCalledWith(404, { 'Content-Type': 'application/json' })
  expect(mockRes.end).toHaveBeenCalledWith(JSON.stringify({ success: false, error: 'Agent not found' }))
})

test('status endpoint returns 404 for invalid runId', async () => {
  const mockAgent = {
    uuid: 'agent-1',
    name: 'Test Agent'
  }

  vi.mocked(agentUtilsModule.findAgentByWebhookToken).mockReturnValue({
    agent: mockAgent as any,
    workspaceId: 'workspace-1'
  })

  vi.mocked(agentsModule.getAgentRun).mockReturnValue(null)

  installAgentWebhook(mockHttpServer as HttpServer, mockApp, mockMcp)

  const handler = mockRegister.mock.calls[1][1]
  const mockReq = { method: 'GET', headers: {}, on: vi.fn() } as any
  const mockRes = { writeHead: vi.fn(), end: vi.fn() } as any
  const mockUrl = new URL('http://localhost:8090/api/agent/status/abc12345/invalid-run')

  await handler(mockReq, mockRes, mockUrl)

  expect(agentsModule.getAgentRun).toHaveBeenCalledWith(mockApp, 'workspace-1', 'agent-1', 'invalid-run')
  expect(mockRes.writeHead).toHaveBeenCalledWith(404, { 'Content-Type': 'application/json' })
  expect(mockRes.end).toHaveBeenCalledWith(JSON.stringify({ success: false, error: 'Run not found' }))
})

test('status endpoint returns running status without output field', async () => {
  const mockAgent = {
    uuid: 'agent-1',
    name: 'Test Agent'
  }

  const mockRun = {
    uuid: 'run-123',
    agentId: 'agent-1',
    status: 'running',
    createdAt: 1234567890,
    updatedAt: 1234567900,
    trigger: 'webhook',
    messages: []
  }

  vi.mocked(agentUtilsModule.findAgentByWebhookToken).mockReturnValue({
    agent: mockAgent as any,
    workspaceId: 'workspace-1'
  })

  vi.mocked(agentsModule.getAgentRun).mockReturnValue(mockRun as any)

  installAgentWebhook(mockHttpServer as HttpServer, mockApp, mockMcp)

  const handler = mockRegister.mock.calls[1][1]
  const mockReq = { method: 'GET', headers: {}, on: vi.fn() } as any
  const mockRes = { writeHead: vi.fn(), end: vi.fn() } as any
  const mockUrl = new URL('http://localhost:8090/api/agent/status/abc12345/run-123')

  await handler(mockReq, mockRes, mockUrl)

  expect(mockRes.writeHead).toHaveBeenCalledWith(200, { 'Content-Type': 'application/json' })
  const response = JSON.parse(mockRes.end.mock.calls[0][0])
  expect(response).toEqual({
    success: true,
    runId: 'run-123',
    agentId: 'agent-1',
    status: 'running',
    createdAt: 1234567890,
    updatedAt: 1234567900,
    trigger: 'webhook'
  })
  expect(response.output).toBeUndefined()
  expect(response.error).toBeUndefined()
})

test('status endpoint returns success status with output string', async () => {
  const mockAgent = {
    uuid: 'agent-2',
    name: 'Test Agent 2'
  }

  const mockRun = {
    uuid: 'run-456',
    agentId: 'agent-2',
    status: 'success',
    createdAt: 1234567890,
    updatedAt: 1234567950,
    trigger: 'webhook',
    messages: [
      { role: 'user', content: 'Hello' },
      { role: 'assistant', content: 'This is the final output' }
    ]
  }

  vi.mocked(agentUtilsModule.findAgentByWebhookToken).mockReturnValue({
    agent: mockAgent as any,
    workspaceId: 'workspace-2'
  })

  vi.mocked(agentsModule.getAgentRun).mockReturnValue(mockRun as any)

  installAgentWebhook(mockHttpServer as HttpServer, mockApp, mockMcp)

  const handler = mockRegister.mock.calls[1][1]
  const mockReq = { method: 'GET', headers: {}, on: vi.fn() } as any
  const mockRes = { writeHead: vi.fn(), end: vi.fn() } as any
  const mockUrl = new URL('http://localhost:8090/api/agent/status/xyz99999/run-456')

  await handler(mockReq, mockRes, mockUrl)

  expect(mockRes.writeHead).toHaveBeenCalledWith(200, { 'Content-Type': 'application/json' })
  const response = JSON.parse(mockRes.end.mock.calls[0][0])
  expect(response).toEqual({
    success: true,
    runId: 'run-456',
    agentId: 'agent-2',
    status: 'success',
    createdAt: 1234567890,
    updatedAt: 1234567950,
    trigger: 'webhook',
    output: 'This is the final output'
  })
  expect(response.error).toBeUndefined()
})

test('status endpoint returns error status with error message', async () => {
  const mockAgent = {
    uuid: 'agent-3',
    name: 'Test Agent 3'
  }

  const mockRun = {
    uuid: 'run-789',
    agentId: 'agent-3',
    status: 'error',
    createdAt: 1234567890,
    updatedAt: 1234567999,
    trigger: 'webhook',
    error: 'Something went wrong',
    messages: []
  }

  vi.mocked(agentUtilsModule.findAgentByWebhookToken).mockReturnValue({
    agent: mockAgent as any,
    workspaceId: 'workspace-3'
  })

  vi.mocked(agentsModule.getAgentRun).mockReturnValue(mockRun as any)

  installAgentWebhook(mockHttpServer as HttpServer, mockApp, mockMcp)

  const handler = mockRegister.mock.calls[1][1]
  const mockReq = { method: 'GET', headers: {}, on: vi.fn() } as any
  const mockRes = { writeHead: vi.fn(), end: vi.fn() } as any
  const mockUrl = new URL('http://localhost:8090/api/agent/status/error123/run-789')

  await handler(mockReq, mockRes, mockUrl)

  expect(mockRes.writeHead).toHaveBeenCalledWith(200, { 'Content-Type': 'application/json' })
  const response = JSON.parse(mockRes.end.mock.calls[0][0])
  expect(response).toEqual({
    success: true,
    runId: 'run-789',
    agentId: 'agent-3',
    status: 'error',
    createdAt: 1234567890,
    updatedAt: 1234567999,
    trigger: 'webhook',
    error: 'Something went wrong'
  })
  expect(response.output).toBeUndefined()
})

test('status endpoint strips tool tags from output', async () => {
  const mockAgent = {
    uuid: 'agent-4',
    name: 'Test Agent 4'
  }

  const mockRun = {
    uuid: 'run-999',
    agentId: 'agent-4',
    status: 'success',
    createdAt: 1234567890,
    updatedAt: 1234567950,
    trigger: 'webhook',
    messages: [
      { role: 'user', content: 'Hello' },
      { role: 'assistant', content: 'Here is the result<tool id="call_irHjhYQzKUJLoiL8LdhLUZ3G"></tool> with clean output' }
    ]
  }

  vi.mocked(agentUtilsModule.findAgentByWebhookToken).mockReturnValue({
    agent: mockAgent as any,
    workspaceId: 'workspace-4'
  })

  vi.mocked(agentsModule.getAgentRun).mockReturnValue(mockRun as any)

  installAgentWebhook(mockHttpServer as HttpServer, mockApp, mockMcp)

  const handler = mockRegister.mock.calls[1][1]
  const mockReq = { method: 'GET', headers: {}, on: vi.fn() } as any
  const mockRes = { writeHead: vi.fn(), end: vi.fn() } as any
  const mockUrl = new URL('http://localhost:8090/api/agent/status/abc12345/run-999')

  await handler(mockReq, mockRes, mockUrl)

  expect(mockRes.writeHead).toHaveBeenCalledWith(200, { 'Content-Type': 'application/json' })
  const response = JSON.parse(mockRes.end.mock.calls[0][0])
  expect(response.output).toBe('Here is the result with clean output')
  expect(response.output).not.toContain('<tool')
})
