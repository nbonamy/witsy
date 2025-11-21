import { vi, expect, test, beforeEach, afterEach } from 'vitest'
import { IncomingMessage, ServerResponse } from 'node:http'
import { HttpServer } from '@main/http_server'

// Mock portfinder
vi.mock('portfinder', () => ({
  default: {
    getPortPromise: vi.fn().mockResolvedValue(8090)
  },
  getPortPromise: vi.fn().mockResolvedValue(8090)
}))

let httpServer: HttpServer
let mockServer: any
let requestListener: (req: IncomingMessage, res: ServerResponse) => void

beforeEach(async () => {
  // Reset singleton
  // @ts-expect-error accessing private property for testing
  HttpServer.instance = null

  // Create mock server
  mockServer = {
    listen: vi.fn((port: number, callback: () => void) => {
      callback()
    }),
    on: vi.fn(),
    close: vi.fn()
  }

  // Mock createServer to capture the request listener
  const mockCreateServer = vi.fn((listener: any) => {
    requestListener = listener
    return mockServer
  })

  // Get instance with mocked createServer
  httpServer = HttpServer.getInstance(mockCreateServer as any)
  await httpServer.ensureServerRunning()
})

afterEach(() => {
  // Clean up
  // @ts-expect-error accessing private method for testing
  httpServer.shutdown()
  // @ts-expect-error reset singleton
  HttpServer.instance = null
})

test('routes with exact match take precedence', () => {
  const exactHandler = vi.fn()
  const wildcardHandler = vi.fn()

  httpServer.register('/api/test', exactHandler)
  httpServer.register('/api/*', wildcardHandler)

  const mockReq = {
    method: 'GET',
    url: 'http://localhost:8090/api/test'
  } as IncomingMessage

  const mockRes = {
    writeHead: vi.fn(),
    end: vi.fn(),
    headersSent: false
  } as any as ServerResponse

  requestListener(mockReq, mockRes)

  expect(exactHandler).toHaveBeenCalled()
  expect(wildcardHandler).not.toHaveBeenCalled()
})

test('wildcard routes match prefixes', () => {
  const handler = vi.fn()

  httpServer.register('/api/agent/run/*', handler)

  const mockReq = {
    method: 'GET',
    url: 'http://localhost:8090/api/agent/run/abc12345'
  } as IncomingMessage

  const mockRes = {
    writeHead: vi.fn(),
    end: vi.fn(),
    headersSent: false
  } as any as ServerResponse

  requestListener(mockReq, mockRes)

  expect(handler).toHaveBeenCalled()
})

test('wildcard routes match any suffix', () => {
  const handler = vi.fn()

  httpServer.register('/files/*', handler)

  const paths = [
    'http://localhost:8090/files/document.pdf',
    'http://localhost:8090/files/folder/subfolder/file.txt',
    'http://localhost:8090/files/123/456/789'
  ]

  for (const url of paths) {
    const mockReq = { method: 'GET', url } as IncomingMessage
    const mockRes = {
      writeHead: vi.fn(),
      end: vi.fn(),
      headersSent: false
    } as any as ServerResponse

    requestListener(mockReq, mockRes)
  }

  expect(handler).toHaveBeenCalledTimes(3)
})

test('returns 404 for unmatched routes', () => {
  httpServer.register('/api/test', vi.fn())

  const mockReq = {
    method: 'GET',
    url: 'http://localhost:8090/api/notfound'
  } as IncomingMessage

  const mockRes = {
    writeHead: vi.fn(),
    end: vi.fn(),
    headersSent: false
  } as any as ServerResponse

  requestListener(mockReq, mockRes)

  expect(mockRes.writeHead).toHaveBeenCalledWith(404, { 'Content-Type': 'text/plain' })
  expect(mockRes.end).toHaveBeenCalledWith('Not Found')
})

test('multiple wildcard routes - first match wins', () => {
  const handler1 = vi.fn()
  const handler2 = vi.fn()

  httpServer.register('/api/*', handler1)
  httpServer.register('/api/users/*', handler2)

  const mockReq = {
    method: 'GET',
    url: 'http://localhost:8090/api/users/123'
  } as IncomingMessage

  const mockRes = {
    writeHead: vi.fn(),
    end: vi.fn(),
    headersSent: false
  } as any as ServerResponse

  requestListener(mockReq, mockRes)

  // First registered wildcard should match
  expect(handler1).toHaveBeenCalled()
  expect(handler2).not.toHaveBeenCalled()
})

test('wildcard at root matches all paths', () => {
  const handler = vi.fn()

  httpServer.register('/*', handler)

  const mockReq = {
    method: 'GET',
    url: 'http://localhost:8090/anything/here/works'
  } as IncomingMessage

  const mockRes = {
    writeHead: vi.fn(),
    end: vi.fn(),
    headersSent: false
  } as any as ServerResponse

  requestListener(mockReq, mockRes)

  expect(handler).toHaveBeenCalled()
})

test('exact match preferred even when wildcard exists', () => {
  const exactHandler = vi.fn()
  const wildcardHandler = vi.fn()

  httpServer.register('/*', wildcardHandler)
  httpServer.register('/specific', exactHandler)

  const mockReq = {
    method: 'GET',
    url: 'http://localhost:8090/specific'
  } as IncomingMessage

  const mockRes = {
    writeHead: vi.fn(),
    end: vi.fn(),
    headersSent: false
  } as any as ServerResponse

  requestListener(mockReq, mockRes)

  expect(exactHandler).toHaveBeenCalled()
  expect(wildcardHandler).not.toHaveBeenCalled()
})

test('wildcard does not match if prefix does not match', () => {
  const handler = vi.fn()

  httpServer.register('/api/users/*', handler)

  const mockReq = {
    method: 'GET',
    url: 'http://localhost:8090/api/products/123'
  } as IncomingMessage

  const mockRes = {
    writeHead: vi.fn(),
    end: vi.fn(),
    headersSent: false
  } as any as ServerResponse

  requestListener(mockReq, mockRes)

  expect(handler).not.toHaveBeenCalled()
  expect(mockRes.writeHead).toHaveBeenCalledWith(404, { 'Content-Type': 'text/plain' })
})

test('handler receives correct parsedUrl for wildcard routes', () => {
  let receivedUrl: URL | undefined

  const handler = vi.fn((req: IncomingMessage, res: ServerResponse, parsedUrl: URL) => {
    receivedUrl = parsedUrl
    res.writeHead(200)
    res.end()
  })

  httpServer.register('/api/agent/run/*', handler)

  const mockReq = {
    method: 'GET',
    url: 'http://localhost:8090/api/agent/run/abc12345?param=value'
  } as IncomingMessage

  const mockRes = {
    writeHead: vi.fn(),
    end: vi.fn(),
    headersSent: false
  } as any as ServerResponse

  requestListener(mockReq, mockRes)

  expect(handler).toHaveBeenCalled()
  expect(receivedUrl).toBeDefined()
  expect(receivedUrl?.pathname).toBe('/api/agent/run/abc12345')
  expect(receivedUrl?.searchParams.get('param')).toBe('value')
})

test('throws error when registering duplicate route', () => {
  httpServer.register('/test', vi.fn())

  expect(() => {
    httpServer.register('/test', vi.fn())
  }).toThrow("Path conflict: Route '/test' already registered")
})
