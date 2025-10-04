import { vi, expect, test, beforeEach, Mock } from 'vitest'
import { IncomingMessage, ServerResponse } from 'node:http'
import { sendJson, sendError, parseParams } from '../../../src/main/http_utils'

let mockRes: Partial<ServerResponse>
let mockReq: Partial<IncomingMessage>

beforeEach(() => {
  mockRes = {
    writeHead: vi.fn(),
    end: vi.fn(),
  }
  mockReq = {
    method: 'GET',
    headers: {},
    on: vi.fn(),
  }
})

test('sendJson sends JSON response with default status 200', () => {
  const data = { success: true, message: 'test' }
  sendJson(mockRes as ServerResponse, data)

  expect(mockRes.writeHead).toHaveBeenCalledWith(200, { 'Content-Type': 'application/json' })
  expect(mockRes.end).toHaveBeenCalledWith(JSON.stringify(data))
})

test('sendJson sends JSON response with custom status code', () => {
  const data = { success: true }
  sendJson(mockRes as ServerResponse, data, 201)

  expect(mockRes.writeHead).toHaveBeenCalledWith(201, { 'Content-Type': 'application/json' })
  expect(mockRes.end).toHaveBeenCalledWith(JSON.stringify(data))
})

test('sendError sends error response with default status 400', () => {
  sendError(mockRes as ServerResponse, 'Bad request')

  expect(mockRes.writeHead).toHaveBeenCalledWith(400, { 'Content-Type': 'application/json' })
  expect(mockRes.end).toHaveBeenCalledWith(JSON.stringify({ success: false, error: 'Bad request' }))
})

test('sendError sends error response with custom status code', () => {
  sendError(mockRes as ServerResponse, 'Not found', 404)

  expect(mockRes.writeHead).toHaveBeenCalledWith(404, { 'Content-Type': 'application/json' })
  expect(mockRes.end).toHaveBeenCalledWith(JSON.stringify({ success: false, error: 'Not found' }))
})

test('parseParams extracts GET query parameters', async () => {
  const parsedUrl = new URL('http://localhost:8090/api/test?name=John&age=30')

  const params = await parseParams(mockReq as IncomingMessage, parsedUrl)

  expect(params).toEqual({ name: 'John', age: '30' })
})

test('parseParams extracts POST JSON body', async () => {
  mockReq.method = 'POST'
  mockReq.headers = { 'content-type': 'application/json' }

  const jsonBody = JSON.stringify({ name: 'Jane', age: '25' })

  // Mock the request stream
  const listeners: Record<string, (...args: any[]) => void> = {}
  mockReq.on = vi.fn((event: string, callback: (...args: any[]) => void) => {
    listeners[event] = callback
    return mockReq as IncomingMessage
  }) as Mock

  const parsedUrl = new URL('http://localhost:8090/api/test')
  const promise = parseParams(mockReq as IncomingMessage, parsedUrl)

  // Simulate receiving data
  listeners['data'](jsonBody)
  listeners['end']()

  const params = await promise

  expect(params).toEqual({ name: 'Jane', age: '25' })
})

test('parseParams extracts POST form-encoded body', async () => {
  mockReq.method = 'POST'
  mockReq.headers = { 'content-type': 'application/x-www-form-urlencoded' }

  const formBody = 'name=Bob&age=40'

  const listeners: Record<string, (...args: any[]) => void> = {}
  mockReq.on = vi.fn((event: string, callback: (...args: any[]) => void) => {
    listeners[event] = callback
    return mockReq as IncomingMessage
  }) as Mock

  const parsedUrl = new URL('http://localhost:8090/api/test')
  const promise = parseParams(mockReq as IncomingMessage, parsedUrl)

  listeners['data'](formBody)
  listeners['end']()

  const params = await promise

  expect(params).toEqual({ name: 'Bob', age: '40' })
})

test('parseParams combines GET and POST parameters', async () => {
  mockReq.method = 'POST'
  mockReq.headers = { 'content-type': 'application/json' }

  const jsonBody = JSON.stringify({ city: 'NYC' })

  const listeners: Record<string, (...args: any[]) => void> = {}
  mockReq.on = vi.fn((event: string, callback: (...args: any[]) => void) => {
    listeners[event] = callback
    return mockReq as IncomingMessage
  }) as Mock

  const parsedUrl = new URL('http://localhost:8090/api/test?name=Alice')
  const promise = parseParams(mockReq as IncomingMessage, parsedUrl)

  listeners['data'](jsonBody)
  listeners['end']()

  const params = await promise

  expect(params).toEqual({ name: 'Alice', city: 'NYC' })
})

test('parseParams handles empty POST body gracefully', async () => {
  mockReq.method = 'POST'
  mockReq.headers = { 'content-type': 'application/json' }

  const listeners: Record<string, (...args: any[]) => void> = {}
  mockReq.on = vi.fn((event: string, callback: (...args: any[]) => void) => {
    listeners[event] = callback
    return mockReq as IncomingMessage
  }) as Mock

  const parsedUrl = new URL('http://localhost:8090/api/test?name=Test')
  const promise = parseParams(mockReq as IncomingMessage, parsedUrl)

  listeners['data']('')
  listeners['end']()

  const params = await promise

  expect(params).toEqual({ name: 'Test' })
})

test('parseParams handles invalid JSON gracefully', async () => {
  mockReq.method = 'POST'
  mockReq.headers = { 'content-type': 'application/json' }

  const listeners: Record<string, (...args: any[]) => void> = {}
  mockReq.on = vi.fn((event: string, callback: (...args: any[]) => void) => {
    listeners[event] = callback
    return mockReq as IncomingMessage
  }) as Mock

  const parsedUrl = new URL('http://localhost:8090/api/test?name=Test')
  const promise = parseParams(mockReq as IncomingMessage, parsedUrl)

  listeners['data']('{invalid json}')
  listeners['end']()

  const params = await promise

  // Should still return query params even if JSON parsing fails
  expect(params).toEqual({ name: 'Test' })
})
