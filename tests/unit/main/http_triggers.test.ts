import { vi, beforeEach, afterEach, expect, test, describe } from 'vitest'
import { IncomingMessage, ServerResponse } from 'node:http'
import { App } from 'electron'
import { HttpServer } from '../../../src/main/http_server'
import { installHttpTriggers } from '../../../src/main/http_triggers'
import * as window from '../../../src/main/window'
import * as config from '../../../src/main/config'
import PromptAnywhere from '../../../src/main/automations/anywhere'
import Commander from '../../../src/main/automations/commander'
import ReadAloud from '../../../src/main/automations/readaloud'
import Transcriber from '../../../src/main/automations/transcriber'

// Mock window module
vi.mock('../../../src/main/window', () => ({
  openMainWindow: vi.fn(),
  openSettingsWindow: vi.fn(),
  openDesignStudioWindow: vi.fn(),
  openAgentForgeWindow: vi.fn(),
  openRealtimeChatWindow: vi.fn(),
  openPromptAnywhere: vi.fn().mockResolvedValue(undefined),
  openCommandPicker: vi.fn(),
}))

// Mock config module
vi.mock('../../../src/main/config', () => ({
  loadSettings: vi.fn().mockReturnValue({
    general: {
      enableHttpEndpoints: true
    }
  })
}))

// Mock automation modules
vi.mock('../../../src/main/automations/anywhere', () => ({
  default: {
    open: vi.fn().mockResolvedValue(undefined),
  },
}))

vi.mock('../../../src/main/automations/commander', () => ({
  default: {
    initCommand: vi.fn().mockResolvedValue(undefined),
  },
}))

vi.mock('../../../src/main/automations/readaloud', () => ({
  default: {
    read: vi.fn().mockResolvedValue(undefined),
  },
}))

vi.mock('../../../src/main/automations/transcriber', () => ({
  default: {
    initTranscription: vi.fn().mockResolvedValue(undefined),
  },
}))

describe('HTTP Triggers', () => {
  let httpServer: HttpServer
  let mockRegister: any
  let mockApp: App

  beforeEach(() => {
    // Get fresh instance
    httpServer = HttpServer.getInstance()

    // Mock the register method
    mockRegister = vi.fn()
    httpServer.register = mockRegister

    // Mock app
    mockApp = {} as App
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  test('should install all endpoints', () => {
    installHttpTriggers(httpServer, mockApp)

    expect(mockRegister).toHaveBeenCalledWith('/api/health', expect.any(Function))
    expect(mockRegister).toHaveBeenCalledWith('/api/chat', expect.any(Function))
    expect(mockRegister).toHaveBeenCalledWith('/api/scratchpad', expect.any(Function))
    expect(mockRegister).toHaveBeenCalledWith('/api/settings', expect.any(Function))
    expect(mockRegister).toHaveBeenCalledWith('/api/studio', expect.any(Function))
    expect(mockRegister).toHaveBeenCalledWith('/api/forge', expect.any(Function))
    expect(mockRegister).toHaveBeenCalledWith('/api/realtime', expect.any(Function))
    expect(mockRegister).toHaveBeenCalledWith('/api/prompt', expect.any(Function))
    expect(mockRegister).toHaveBeenCalledWith('/api/command', expect.any(Function))
    expect(mockRegister).toHaveBeenCalledWith('/api/transcribe', expect.any(Function))
    expect(mockRegister).toHaveBeenCalledWith('/api/readaloud', expect.any(Function))
  })

  test('health endpoint should return ok status', async () => {
    installHttpTriggers(httpServer, mockApp)

    const healthHandler = mockRegister.mock.calls.find(
      (call: any) => call[0] === '/api/health'
    )?.[1]

    const mockReq = {} as IncomingMessage
    const mockRes = {
      writeHead: vi.fn(),
      end: vi.fn()
    } as unknown as ServerResponse

    await healthHandler(mockReq, mockRes, new URL('http://localhost:8090/api/health'))

    expect(mockRes.writeHead).toHaveBeenCalledWith(200, { 'Content-Type': 'application/json' })
    expect(mockRes.end).toHaveBeenCalledWith(
      JSON.stringify({
        status: 'ok',
        server: 'witsy-http-triggers',
        version: '1.0.0'
      })
    )
  })

  test('chat endpoint should open main window with chat view', async () => {
    installHttpTriggers(httpServer, mockApp)

    const chatHandler = mockRegister.mock.calls.find(
      (call: any) => call[0] === '/api/chat'
    )?.[1]

    const mockReq = {} as IncomingMessage
    const mockRes = {
      writeHead: vi.fn(),
      end: vi.fn()
    } as unknown as ServerResponse

    await chatHandler(mockReq, mockRes, new URL('http://localhost:8090/api/chat'))

    expect(window.openMainWindow).toHaveBeenCalledWith({ queryParams: { view: 'chat' } })
    expect(mockRes.end).toHaveBeenCalledWith(JSON.stringify({ success: true, action: 'chat' }))
  })

  test('scratchpad endpoint should open main window with scratchpad view', async () => {
    installHttpTriggers(httpServer, mockApp)

    const handler = mockRegister.mock.calls.find(
      (call: any) => call[0] === '/api/scratchpad'
    )?.[1]

    const mockReq = {} as IncomingMessage
    const mockRes = {
      writeHead: vi.fn(),
      end: vi.fn()
    } as unknown as ServerResponse

    await handler(mockReq, mockRes, new URL('http://localhost:8090/api/scratchpad'))

    expect(window.openMainWindow).toHaveBeenCalledWith({ queryParams: { view: 'scratchpad' } })
    expect(mockRes.end).toHaveBeenCalledWith(JSON.stringify({ success: true, action: 'scratchpad' }))
  })

  test('endpoints should return 404 when disabled', async () => {
    // Mock config with disabled endpoints
    vi.mocked(config.loadSettings).mockReturnValueOnce({
      general: {
        enableHttpEndpoints: false
      }
    } as any)

    installHttpTriggers(httpServer, mockApp)

    const healthHandler = mockRegister.mock.calls.find(
      (call: any) => call[0] === '/api/health'
    )?.[1]

    const mockReq = {} as IncomingMessage
    const mockRes = {
      writeHead: vi.fn(),
      end: vi.fn()
    } as unknown as ServerResponse

    await healthHandler(mockReq, mockRes, new URL('http://localhost:8090/api/health'))

    expect(mockRes.writeHead).toHaveBeenCalledWith(404)
    expect(mockRes.end).toHaveBeenCalled()
  })

  test('settings endpoint should open settings window', async () => {
    installHttpTriggers(httpServer, mockApp)

    const handler = mockRegister.mock.calls.find(
      (call: any) => call[0] === '/api/settings'
    )?.[1]

    const mockReq = {} as IncomingMessage
    const mockRes = {
      writeHead: vi.fn(),
      end: vi.fn()
    } as unknown as ServerResponse

    await handler(mockReq, mockRes, new URL('http://localhost:8090/api/settings'))

    expect(window.openSettingsWindow).toHaveBeenCalled()
    expect(mockRes.end).toHaveBeenCalledWith(JSON.stringify({ success: true, action: 'settings' }))
  })

  test('studio endpoint should open design studio window', async () => {
    installHttpTriggers(httpServer, mockApp)

    const handler = mockRegister.mock.calls.find(
      (call: any) => call[0] === '/api/studio'
    )?.[1]

    const mockReq = {} as IncomingMessage
    const mockRes = {
      writeHead: vi.fn(),
      end: vi.fn()
    } as unknown as ServerResponse

    await handler(mockReq, mockRes, new URL('http://localhost:8090/api/studio'))

    expect(window.openDesignStudioWindow).toHaveBeenCalled()
    expect(mockRes.end).toHaveBeenCalledWith(JSON.stringify({ success: true, action: 'studio' }))
  })

  test('forge endpoint should open agent forge window', async () => {
    installHttpTriggers(httpServer, mockApp)

    const handler = mockRegister.mock.calls.find(
      (call: any) => call[0] === '/api/forge'
    )?.[1]

    const mockReq = {} as IncomingMessage
    const mockRes = {
      writeHead: vi.fn(),
      end: vi.fn()
    } as unknown as ServerResponse

    await handler(mockReq, mockRes, new URL('http://localhost:8090/api/forge'))

    expect(window.openAgentForgeWindow).toHaveBeenCalled()
    expect(mockRes.end).toHaveBeenCalledWith(JSON.stringify({ success: true, action: 'forge' }))
  })

  test('realtime endpoint should open realtime chat window', async () => {
    installHttpTriggers(httpServer, mockApp)

    const handler = mockRegister.mock.calls.find(
      (call: any) => call[0] === '/api/realtime'
    )?.[1]

    const mockReq = {} as IncomingMessage
    const mockRes = {
      writeHead: vi.fn(),
      end: vi.fn()
    } as unknown as ServerResponse

    await handler(mockReq, mockRes, new URL('http://localhost:8090/api/realtime'))

    expect(window.openRealtimeChatWindow).toHaveBeenCalled()
    expect(mockRes.end).toHaveBeenCalledWith(JSON.stringify({ success: true, action: 'realtime' }))
  })

  test('prompt endpoint should trigger PromptAnywhere', async () => {
    installHttpTriggers(httpServer, mockApp)

    const handler = mockRegister.mock.calls.find(
      (call: any) => call[0] === '/api/prompt'
    )?.[1]

    const mockReq = {} as IncomingMessage
    const mockRes = {
      writeHead: vi.fn(),
      end: vi.fn()
    } as unknown as ServerResponse

    await handler(mockReq, mockRes, new URL('http://localhost:8090/api/prompt'))

    expect(PromptAnywhere.open).toHaveBeenCalled()
    expect(mockRes.end).toHaveBeenCalledWith(JSON.stringify({ success: true, action: 'prompt' }))
  })

  test('command endpoint should trigger Commander', async () => {
    installHttpTriggers(httpServer, mockApp)

    const handler = mockRegister.mock.calls.find(
      (call: any) => call[0] === '/api/command'
    )?.[1]

    const mockReq = {} as IncomingMessage
    const mockRes = {
      writeHead: vi.fn(),
      end: vi.fn()
    } as unknown as ServerResponse

    await handler(mockReq, mockRes, new URL('http://localhost:8090/api/command'))

    expect(Commander.initCommand).toHaveBeenCalledWith(mockApp)
    expect(mockRes.end).toHaveBeenCalledWith(JSON.stringify({ success: true, action: 'command' }))
  })

  test('transcribe endpoint should trigger Transcriber', async () => {
    installHttpTriggers(httpServer, mockApp)

    const handler = mockRegister.mock.calls.find(
      (call: any) => call[0] === '/api/transcribe'
    )?.[1]

    const mockReq = {} as IncomingMessage
    const mockRes = {
      writeHead: vi.fn(),
      end: vi.fn()
    } as unknown as ServerResponse

    await handler(mockReq, mockRes, new URL('http://localhost:8090/api/transcribe'))

    expect(Transcriber.initTranscription).toHaveBeenCalled()
    expect(mockRes.end).toHaveBeenCalledWith(JSON.stringify({ success: true, action: 'transcribe' }))
  })

  test('readaloud endpoint should trigger ReadAloud', async () => {
    installHttpTriggers(httpServer, mockApp)

    const handler = mockRegister.mock.calls.find(
      (call: any) => call[0] === '/api/readaloud'
    )?.[1]

    const mockReq = {} as IncomingMessage
    const mockRes = {
      writeHead: vi.fn(),
      end: vi.fn()
    } as unknown as ServerResponse

    await handler(mockReq, mockRes, new URL('http://localhost:8090/api/readaloud'))

    expect(ReadAloud.read).toHaveBeenCalledWith(mockApp)
    expect(mockRes.end).toHaveBeenCalledWith(JSON.stringify({ success: true, action: 'readaloud' }))
  })

  test('chat endpoint should handle text parameter from query string', async () => {
    installHttpTriggers(httpServer, mockApp)

    const handler = mockRegister.mock.calls.find(
      (call: any) => call[0] === '/api/chat'
    )?.[1]

    const mockReq = {} as IncomingMessage
    const mockRes = {
      writeHead: vi.fn(),
      end: vi.fn()
    } as unknown as ServerResponse

    await handler(mockReq, mockRes, new URL('http://localhost:8090/api/chat?text=Hello%20World'))

    expect(window.openMainWindow).toHaveBeenCalledWith({
      queryParams: { view: 'chat', text: 'Hello World' }
    })
  })

  test('prompt endpoint should pass text parameter using promptId', async () => {
    installHttpTriggers(httpServer, mockApp)

    const handler = mockRegister.mock.calls.find(
      (call: any) => call[0] === '/api/prompt'
    )?.[1]

    const mockReq = {} as IncomingMessage
    const mockRes = {
      writeHead: vi.fn(),
      end: vi.fn()
    } as unknown as ServerResponse

    await handler(mockReq, mockRes, new URL('http://localhost:8090/api/prompt?text=Test'))

    expect(PromptAnywhere.open).not.toHaveBeenCalled()
    expect(window.openPromptAnywhere).toHaveBeenCalledWith({ promptId: expect.any(String) })
  })

  test('prompt endpoint without text should call PromptAnywhere.open', async () => {
    installHttpTriggers(httpServer, mockApp)

    const handler = mockRegister.mock.calls.find(
      (call: any) => call[0] === '/api/prompt'
    )?.[1]

    const mockReq = {} as IncomingMessage
    const mockRes = {
      writeHead: vi.fn(),
      end: vi.fn()
    } as unknown as ServerResponse

    await handler(mockReq, mockRes, new URL('http://localhost:8090/api/prompt'))

    expect(PromptAnywhere.open).toHaveBeenCalled()
    expect(window.openPromptAnywhere).not.toHaveBeenCalled()
  })
})
