import { describe, expect, test, beforeEach, afterEach, vi } from 'vitest'
import { WitsyAPI } from '@/cli/api'
import { state } from '@/cli/state'

// Setup fetch mock
global.fetch = vi.fn()

describe('WitsyAPI', () => {
  let api: WitsyAPI

  beforeEach(() => {
    api = new WitsyAPI()
    state.port = 4321
    state.engine = { id: 'openai', name: 'OpenAI' }
    state.model = { id: 'gpt-4', name: 'GPT-4' }
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  test('getConfig makes correct API call', async () => {
    const mockResponse = {
      engine: { id: 'openai', name: 'OpenAI' },
      model: { id: 'gpt-4', name: 'GPT-4' },
      userDataPath: '/path/to/userData',
      enableHttpEndpoints: true
    }

    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse,
    } as Response)

    const result = await api.getConfig()

    expect(fetch).toHaveBeenCalledWith('http://localhost:4321/api/cli/config')
    expect(result).toEqual(mockResponse)
  })

  test('getEngines makes correct API call', async () => {
    const mockResponse = {
      engines: [
        { id: 'openai', name: 'OpenAI' },
        { id: 'anthropic', name: 'Anthropic' },
      ],
    }

    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse,
    } as Response)

    const result = await api.getEngines()

    expect(fetch).toHaveBeenCalledWith('http://localhost:4321/api/engines')
    expect(result).toEqual(mockResponse.engines)
  })

  test('getModels makes correct API call', async () => {
    const mockResponse = {
      models: [
        { id: 'gpt-4', name: 'GPT-4' },
        { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo' },
      ],
    }

    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse,
    } as Response)

    const result = await api.getModels('openai')

    expect(fetch).toHaveBeenCalledWith('http://localhost:4321/api/models/openai')
    expect(result).toEqual(mockResponse.models)
  })

  test('handles HTTP errors', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      status: 404,
    } as Response)

    await expect(api.getConfig()).rejects.toThrow('HTTP 404')
  })

  test('connectWithTimeout returns true on successful connection', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
    } as Response)

    const result = await api.connectWithTimeout(4321, 2000)
    expect(result).toBe(true)
    expect(fetch).toHaveBeenCalledWith('http://localhost:4321/api/cli/config', expect.any(Object))
  })

  test('connectWithTimeout returns false on timeout', async () => {
    vi.mocked(fetch).mockImplementationOnce(() =>
      new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 100))
    )

    const result = await api.connectWithTimeout(4321, 50)
    expect(result).toBe(false)
  })

  test('connectWithTimeout returns false on network error', async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new Error('Network error'))

    const result = await api.connectWithTimeout(4321, 2000)
    expect(result).toBe(false)
  })

  test('complete streams response chunks', async () => {
    const chunks: string[] = []
    const mockChunks = [
      'data: {"type":"content","text":"Hello"}\n',
      'data: {"type":"content","text":" world"}\n',
      'data: [DONE]\n'
    ]

    // Mock ReadableStream
    const encoder = new TextEncoder()
    let chunkIndex = 0

    const mockReader = {
      read: vi.fn(async () => {
        if (chunkIndex < mockChunks.length) {
          const value = encoder.encode(mockChunks[chunkIndex++])
          return { value, done: false }
        }
        return { value: undefined, done: true }
      })
    }

    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      body: {
        getReader: () => mockReader
      } as any
    } as Response)

    await api.complete(
      [{ role: 'user', content: 'test' }],
      (payload) => chunks.push(payload)
    )

    expect(chunks).toHaveLength(2)
    expect(chunks[0]).toBe('{"type":"content","text":"Hello"}')
    expect(chunks[1]).toBe('{"type":"content","text":" world"}')
  })

  test('complete handles abort signal', async () => {
    const controller = new AbortController()

    vi.mocked(fetch).mockRejectedValueOnce(new DOMException('Aborted', 'AbortError'))

    controller.abort()

    await expect(
      api.complete(
        [{ role: 'user', content: 'test' }],
        () => {},
        controller.signal
      )
    ).rejects.toThrow()
  })

  test('complete throws on missing response body', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      body: null
    } as Response)

    await expect(
      api.complete([{ role: 'user', content: 'test' }], () => {})
    ).rejects.toThrow('No response body')
  })

  test('saveConversation makes correct API call', async () => {
    const mockChat = {
      uuid: 'test-uuid',
      title: 'Test Chat',
      messages: []
    }

    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ chatId: 'new-chat-id' })
    } as Response)

    const result = await api.saveConversation(mockChat as any)

    expect(fetch).toHaveBeenCalledWith(
      'http://localhost:4321/api/conversations',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat: mockChat })
      })
    )
    expect(result).toBe('new-chat-id')
  })

  test('saveConversation handles errors', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      status: 500
    } as Response)

    await expect(
      api.saveConversation({} as any)
    ).rejects.toThrow('HTTP 500')
  })
})
