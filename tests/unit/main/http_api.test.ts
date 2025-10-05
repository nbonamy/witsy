import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { IncomingMessage } from 'http'
import { installApiEndpoints } from '../../../src/main/http_api'
import { HttpServer } from '../../../src/main/http_server'
import LlmFactory from '../../../src/llms/llm'
import Assistant from '../../../src/services/assistant'
import * as config from '../../../src/main/config'
import { App } from 'electron'
import Mcp from '../../../src/main/mcp'

type RouteHandler = (req: IncomingMessage, res: any, parsedUrl?: URL) => Promise<void> | void

vi.mock('../../../src/main/config')
vi.mock('../../../src/services/assistant')

vi.mock('../../../src/llms/llm', () => ({
  default: {
    manager: vi.fn()
  }
}))

describe('HTTP API Endpoints', () => {
  let httpServer: HttpServer
  let mockApp: App
  let mockMcp: Mcp
  let mockSettings: any
  let mockLlmManager: any
  let registeredRoutes: Map<string, RouteHandler>

  beforeEach(() => {
    registeredRoutes = new Map()

    httpServer = {
      register: vi.fn((path: string, handler: RouteHandler) => {
        registeredRoutes.set(path, handler)
      })
    } as any

    mockApp = {} as App
    mockMcp = {} as Mcp

    mockSettings = {
      llm: { engine: 'openai' },
      engines: {
        openai: { model: { chat: 'gpt-4' }, models: { chat: [] } },
        anthropic: { model: { chat: 'claude-3' }, models: { chat: [] } }
      },
      workspaceId: 'test-workspace'
    }

    mockLlmManager = {
      getChatEngines: vi.fn(() => ['openai', 'anthropic']),
      isEngineConfigured: vi.fn(() => true),
      getChatModels: vi.fn(() => [
        { id: 'gpt-4', name: 'GPT-4' },
        { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo' }
      ])
    }

    vi.mocked(config.loadSettings).mockReturnValue(mockSettings)
    vi.mocked(LlmFactory.manager).mockReturnValue(mockLlmManager)
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('GET /api/engines', () => {
    test('returns list of configured engines', async () => {
      installApiEndpoints(httpServer, mockApp, mockMcp)

      const handler = registeredRoutes.get('/api/engines')
      expect(handler).toBeDefined()

      const mockReq = {} as IncomingMessage
      const mockRes = {
        writeHead: vi.fn(),
        end: vi.fn()
      } as any

      await handler!(mockReq, mockRes)

      expect(mockRes.writeHead).toHaveBeenCalledWith(200, { 'Content-Type': 'application/json' })
      const response = JSON.parse(mockRes.end.mock.calls[0][0])
      expect(response.engines).toHaveLength(2)
      expect(response.engines[0]).toEqual({ id: 'openai', name: 'OpenAI' })
      expect(response.engines[1]).toEqual({ id: 'anthropic', name: 'Anthropic' })
    })

    test('filters out non-configured engines', async () => {
      mockLlmManager.isEngineConfigured = vi.fn((engine: string) => engine === 'openai')

      installApiEndpoints(httpServer, mockApp, mockMcp)

      const handler = registeredRoutes.get('/api/engines')
      const mockReq = {} as IncomingMessage
      const mockRes = {
        writeHead: vi.fn(),
        end: vi.fn()
      } as any

      await handler!(mockReq, mockRes)

      const response = JSON.parse(mockRes.end.mock.calls[0][0])
      expect(response.engines).toHaveLength(1)
      expect(response.engines[0].id).toBe('openai')
    })
  })

  describe('GET /api/models/:engine', () => {
    test('returns models for valid engine', async () => {
      installApiEndpoints(httpServer, mockApp, mockMcp)

      const handler = registeredRoutes.get('/api/models/*')
      expect(handler).toBeDefined()

      const mockReq = {} as IncomingMessage
      const mockRes = {
        writeHead: vi.fn(),
        end: vi.fn()
      } as any
      const mockUrl = new URL('http://localhost/api/models/openai')

      await handler!(mockReq, mockRes, mockUrl)

      expect(mockRes.writeHead).toHaveBeenCalledWith(200, { 'Content-Type': 'application/json' })
      const response = JSON.parse(mockRes.end.mock.calls[0][0])
      expect(response.engine).toBe('openai')
      expect(response.models).toHaveLength(2)
      expect(response.models[0]).toEqual({ id: 'gpt-4', name: 'GPT-4' })
    })

    test('returns 404 for non-configured engine', async () => {
      mockLlmManager.isEngineConfigured = vi.fn(() => false)

      installApiEndpoints(httpServer, mockApp, mockMcp)

      const handler = registeredRoutes.get('/api/models/*')
      const mockReq = {} as IncomingMessage
      const mockRes = {
        writeHead: vi.fn(),
        end: vi.fn()
      } as any
      const mockUrl = new URL('http://localhost/api/models/invalid')

      await handler!(mockReq, mockRes, mockUrl)

      expect(mockRes.writeHead).toHaveBeenCalledWith(404, { 'Content-Type': 'application/json' })
    })

    test('returns 400 for missing engine parameter', async () => {
      installApiEndpoints(httpServer, mockApp, mockMcp)

      const handler = registeredRoutes.get('/api/models/*')
      const mockReq = {} as IncomingMessage
      const mockRes = {
        writeHead: vi.fn(),
        end: vi.fn()
      } as any
      const mockUrl = new URL('http://localhost/api/models/')

      await handler!(mockReq, mockRes, mockUrl)

      expect(mockRes.writeHead).toHaveBeenCalledWith(400, { 'Content-Type': 'application/json' })
    })
  })

  describe('POST /api/complete', () => {
    let mockAssistant: any

    beforeEach(() => {
      mockAssistant = {
        setChat: vi.fn(),
        initLlm: vi.fn(),
        hasLlm: vi.fn(() => true),
        prompt: vi.fn()
      }
      vi.mocked(Assistant).mockReturnValue(mockAssistant)
    })

    test('handles non-streaming completion', async () => {
      installApiEndpoints(httpServer, mockApp, mockMcp)

      const handler = registeredRoutes.get('/api/complete')
      expect(handler).toBeDefined()

      const mockReq = {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        on: vi.fn((event, callback) => {
          if (event === 'data') {
            callback(Buffer.from(JSON.stringify({
              stream: 'false',
              thread: [{ role: 'user', content: 'Hello' }]
            })))
          }
          if (event === 'end') callback()
        })
      } as any
      const mockRes = {
        writeHead: vi.fn(),
        write: vi.fn(),
        end: vi.fn()
      } as any
      const mockUrl = new URL('http://localhost/api/complete')

      // Mock the chat's last message to return our test response
      const mockChat = {
        lastMessage: vi.fn(() => ({ content: 'Hello! How are you?' }))
      }

      // Mock setChat to capture the chat instance
      mockAssistant.setChat.mockImplementation((chat: any) => {
        // Replace methods on the real chat object with our mocks
        chat.lastMessage = mockChat.lastMessage
        mockAssistant.chat = chat
      })

      await handler!(mockReq, mockRes, mockUrl)

      expect(mockRes.writeHead).toHaveBeenCalledWith(200, { 'Content-Type': 'application/json' })
      const response = JSON.parse(mockRes.end.mock.calls[0][0])
      expect(response.success).toBe(true)
      expect(response.response.content).toBe('Hello! How are you?')
    })

    test('handles streaming completion with SSE', async () => {
      installApiEndpoints(httpServer, mockApp, mockMcp)

      const handler = registeredRoutes.get('/api/complete')

      const mockReq = {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        on: vi.fn((event, callback) => {
          if (event === 'data') {
            callback(Buffer.from(JSON.stringify({
              stream: 'true',
              thread: [{ role: 'user', content: 'Hello' }]
            })))
          }
          if (event === 'end') callback()
        })
      } as any
      const mockRes = {
        writeHead: vi.fn(),
        write: vi.fn(),
        end: vi.fn()
      } as any
      const mockUrl = new URL('http://localhost/api/complete')

      mockAssistant.prompt.mockImplementation(async (_prompt: string, _opts: any, callback: (chunk: any) => void) => {
        callback({ type: 'content', text: 'Hello!', done: false })
      })

      await handler!(mockReq, mockRes, mockUrl)

      expect(mockRes.writeHead).toHaveBeenCalledWith(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive'
      })
      expect(mockRes.write).toHaveBeenCalledWith(expect.stringContaining('data:'))
      expect(mockRes.write).toHaveBeenCalledWith('data: [DONE]\n\n')
    })

    test('uses default engine and model when not specified', async () => {
      installApiEndpoints(httpServer, mockApp, mockMcp)

      const handler = registeredRoutes.get('/api/complete')

      const mockReq = {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        on: vi.fn((event, callback) => {
          if (event === 'data') {
            callback(Buffer.from(JSON.stringify({
              thread: [{ role: 'user', content: 'Hello' }]
            })))
          }
          if (event === 'end') callback()
        })
      } as any
      const mockRes = {
        writeHead: vi.fn(),
        write: vi.fn(),
        end: vi.fn()
      } as any
      const mockUrl = new URL('http://localhost/api/complete')

      mockAssistant.prompt.mockImplementation(async (_prompt: string, opts: any, callback: (chunk: any) => void) => {
        expect(opts.engine).toBe('openai')
        expect(opts.model).toBe('gpt-4')
        callback({ type: 'content', text: 'test', done: true })
      })

      await handler!(mockReq, mockRes, mockUrl)

      expect(mockAssistant.prompt).toHaveBeenCalled()
    })

    test('passes noMarkdown parameter to assistant', async () => {
      installApiEndpoints(httpServer, mockApp, mockMcp)

      const handler = registeredRoutes.get('/api/complete')

      const mockReq = {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        on: vi.fn((event, callback) => {
          if (event === 'data') {
            callback(Buffer.from(JSON.stringify({
              stream: 'false',
              noMarkdown: true,
              thread: [{ role: 'user', content: 'Hello' }]
            })))
          }
          if (event === 'end') callback()
        })
      } as any
      const mockRes = {
        writeHead: vi.fn(),
        end: vi.fn()
      } as any
      const mockUrl = new URL('http://localhost/api/complete')

      // Mock the chat's last message
      const mockChat = {
        lastMessage: vi.fn(() => ({ content: 'Test response' }))
      }

      mockAssistant.setChat.mockImplementation((chat: any) => {
        chat.lastMessage = mockChat.lastMessage
        mockAssistant.chat = chat
      })

      await handler!(mockReq, mockRes, mockUrl)

      // Verify that prompt was called with noMarkdown option
      expect(mockAssistant.prompt).toHaveBeenCalledWith(
        'Hello',
        expect.objectContaining({
          noMarkdown: true
        }),
        expect.any(Function)
      )
    })

    test('returns 400 for missing thread', async () => {
      installApiEndpoints(httpServer, mockApp, mockMcp)

      const handler = registeredRoutes.get('/api/complete')

      const mockReq = {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        on: vi.fn((event, callback) => {
          if (event === 'data') {
            callback(Buffer.from(JSON.stringify({ stream: 'false' })))
          }
          if (event === 'end') callback()
        })
      } as any
      const mockRes = {
        writeHead: vi.fn(),
        end: vi.fn()
      } as any
      const mockUrl = new URL('http://localhost/api/complete')

      await handler!(mockReq, mockRes, mockUrl)

      expect(mockRes.writeHead).toHaveBeenCalledWith(400, { 'Content-Type': 'application/json' })
    })

    test('returns 404 for non-configured engine', async () => {
      mockLlmManager.isEngineConfigured = vi.fn(() => false)

      installApiEndpoints(httpServer, mockApp, mockMcp)

      const handler = registeredRoutes.get('/api/complete')

      const mockReq = {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        on: vi.fn((event, callback) => {
          if (event === 'data') {
            callback(Buffer.from(JSON.stringify({
              engine: 'invalid',
              thread: [{ role: 'user', content: 'Hello' }]
            })))
          }
          if (event === 'end') callback()
        })
      } as any
      const mockRes = {
        writeHead: vi.fn(),
        end: vi.fn()
      } as any
      const mockUrl = new URL('http://localhost/api/complete')

      await handler!(mockReq, mockRes, mockUrl)

      expect(mockRes.writeHead).toHaveBeenCalledWith(404, { 'Content-Type': 'application/json' })
    })
  })
})
