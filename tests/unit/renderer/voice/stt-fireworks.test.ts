import { describe, it, expect, vi, beforeEach } from 'vitest'
import STTFireworks from '../../src/renderer/voice/stt-fireworks'

const makeConfig = (overrides: any = {}) => ({
  stt: {
    model: 'realtime',
    locale: 'en-US',
    vocabulary: [
      { text: 'test' },
      { text: 'vocabulary' }
    ],
  },
  engines: {
    fireworks: { apiKey: 'test-api-key' },
  },
  ...overrides,
})

describe('STTFireworks', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('should have correct model definitions', () => {
    expect(STTFireworks.models).toEqual([
      { id: 'realtime', label: 'Fireworks (realtime)' },
    ])
  })

  it('should correctly identify streaming models', () => {
    const engine = new STTFireworks(makeConfig() as any)

    expect(engine.isStreamingModel('realtime')).toBe(true)
    expect(engine.isStreamingModel('other')).toBe(false)
  })

  it('should correctly identify PCM requirements', () => {
    const engine = new STTFireworks(makeConfig() as any)

    expect(engine.requiresPcm16bits('realtime')).toBe(true)
  })

  it('should return correct name', () => {
    const engine = new STTFireworks(makeConfig() as any)
    expect(engine.name).toBe('fireworks')
  })

  it('should be ready', () => {
    const engine = new STTFireworks(makeConfig() as any)
    expect(engine.isReady()).toBe(true)
  })

  it('should not require download', () => {
    expect(STTFireworks.requiresDownload()).toBe(false)

    const engine = new STTFireworks(makeConfig() as any)
    expect(engine.requiresDownload()).toBe(false)
  })

  it('should initialize with callback', async () => {
    const engine = new STTFireworks(makeConfig() as any)
    const callback = vi.fn()

    await engine.initialize(callback)

    expect(callback).toHaveBeenCalledWith({
      status: 'ready',
      task: 'fireworks',
      model: 'realtime'
    })
  })

  it('should throw error for transcribe method', async () => {
    const engine = new STTFireworks(makeConfig() as any)

    await expect(engine.transcribe(new Blob(['test audio']))).rejects.toThrow(
      'Transcription not supported in Fireworks STT engine'
    )
  })

  it('should require API key for streaming', async () => {
    const configWithoutKey = makeConfig()
    configWithoutKey.engines.fireworks.apiKey = ''
    const engine = new STTFireworks(configWithoutKey as any)

    const callback = vi.fn()
    await engine.startStreaming('realtime', callback)

    expect(callback).toHaveBeenCalledWith({
      type: 'error',
      status: 'not_authorized',
      error: 'Missing API key. Please check your Fireworks AI configuration.'
    })
  })

  it('should handle realtime streaming with segment aggregation', async () => {
    const engine = new STTFireworks(makeConfig() as any)

    class MockWebSocket {
      readyState = 0 // CONNECTING
      onopen: any
      onmessage: any
      onerror: any
      onclose: any
      url: string

      constructor(url: string) {
        this.url = url

        // Verify URL construction (URLSearchParams uses + for spaces)
        expect(url).toContain('wss://audio-streaming-v2.api.fireworks.ai/v1/audio/transcriptions/streaming')
        expect(url).toContain('Authorization=Bearer+test-api-key')
        expect(url).toContain('response_format=verbose_json')
        expect(url).toContain('language=en')
        expect(url).toContain('prompt=test%2C+vocabulary')

        setTimeout(() => {
          this.readyState = 1 // OPEN
          this.onopen?.()

          // Simulate segment stream with multiple messages
          setTimeout(() => {
            this.onmessage?.({
              data: JSON.stringify({
                task: 'transcribe',
                language: 'en',
                text: 'Hello',
                words: [],
                segments: [
                  {
                    id: 'seg1',
                    seek: 0,
                    text: 'Hello',
                    language: 'en',
                    words: []
                  }
                ]
              }),
            })
          }, 10)

          setTimeout(() => {
            this.onmessage?.({
              data: JSON.stringify({
                task: 'transcribe',
                language: 'en',
                text: 'Hello world',
                words: [],
                segments: [
                  {
                    id: 'seg1',
                    seek: 0,
                    text: 'Hello',
                    language: 'en',
                    words: []
                  },
                  {
                    id: 'seg2',
                    seek: 100,
                    text: 'world',
                    language: 'en',
                    words: []
                  }
                ]
              }),
            })
          }, 20)

          setTimeout(() => {
            this.readyState = 3 // CLOSED
            this.onclose?.()
          }, 30)
        }, 5)
      }

      send(data: any) {
        // Audio chunks are sent as blobs
        expect(data).toBeInstanceOf(Blob)
      }

      close() {
        this.readyState = 3 // CLOSED
        this.onclose?.()
      }
    }

    // @ts-expect-error mocking
    global.WebSocket = MockWebSocket

    const chunks: any[] = []
    await engine.startStreaming('realtime', (chunk) => {
      chunks.push(chunk)
    })

    // Wait for all messages to be processed
    await new Promise(resolve => setTimeout(resolve, 100))

    // Check that we received the expected messages
    const statusChunks = chunks.filter(c => c.type === 'status')
    const textChunks = chunks.filter(c => c.type === 'text')

    expect(statusChunks.length).toBeGreaterThanOrEqual(2) // connected, done
    expect(statusChunks[0].status).toBe('connected')
    expect(statusChunks[statusChunks.length - 1].status).toBe('done')

    expect(textChunks.length).toBeGreaterThan(0)

    // Final text should aggregate all segments
    const finalChunk = textChunks[textChunks.length - 1]
    expect(finalChunk?.content).toBe('Hello world')
  })

  it('should handle streaming with custom options', async () => {
    const engine = new STTFireworks(makeConfig() as any)

    class MockWebSocket {
      readyState = 0 // CONNECTING
      onopen: any
      onmessage: any
      onerror: any
      onclose: any

      constructor(public url: string) {
        // Verify custom options in URL (URLSearchParams uses + for spaces)
        expect(url).toContain('prompt=custom+prompt')
        expect(url).toContain('temperature=0.5')

        setTimeout(() => {
          this.readyState = 1 // OPEN
          this.onopen?.()
          setTimeout(() => {
            this.readyState = 3 // CLOSED
            this.onclose?.()
          }, 10)
        }, 5)
      }

      send() {}
      close() {
        this.readyState = 3 // CLOSED
        this.onclose?.()
      }
    }

    // @ts-expect-error mocking
    global.WebSocket = MockWebSocket

    const chunks: any[] = []
    await engine.startStreaming('realtime', (chunk) => {
      chunks.push(chunk)
    }, { prompt: 'custom prompt', temperature: '0.5' })

    await new Promise(resolve => setTimeout(resolve, 50))
  })

  it('should handle streaming connection errors', async () => {
    const engine = new STTFireworks(makeConfig() as any)

    class MockWebSocket {
      onopen: any
      onmessage: any
      onerror: any
      onclose: any

      constructor() {
        setTimeout(() => {
          this.onerror?.({ message: 'Connection failed' })
        }, 10)
      }

      send() {}
      close() {}
    }

    // @ts-expect-error mocking
    global.WebSocket = MockWebSocket

    const chunks: any[] = []
    await engine.startStreaming('realtime', (chunk) => {
      chunks.push(chunk)
    })

    await new Promise(resolve => setTimeout(resolve, 50))

    const errorChunks = chunks.filter(c => c.type === 'error')
    expect(errorChunks).toHaveLength(1)
    expect(errorChunks[0].error).toBe('WebSocket connection error')
  })

  it('should handle non-transcribe messages', async () => {
    const engine = new STTFireworks(makeConfig() as any)

    class MockWebSocket {
      readyState = 0 // CONNECTING
      onopen: any
      onmessage: any
      onerror: any
      onclose: any

      constructor() {
        setTimeout(() => {
          this.readyState = 1 // OPEN
          this.onopen?.()

          // Send a non-transcribe message
          setTimeout(() => {
            this.onmessage?.({
              data: JSON.stringify({
                task: 'other',
                message: 'should be ignored'
              }),
            })
          }, 10)

          setTimeout(() => {
            this.readyState = 3 // CLOSED
            this.onclose?.()
          }, 20)
        }, 5)
      }

      send() {}
      close() {
        this.readyState = 3 // CLOSED
        this.onclose?.()
      }
    }

    // @ts-expect-error mocking
    global.WebSocket = MockWebSocket

    const chunks: any[] = []
    await engine.startStreaming('realtime', (chunk) => {
      chunks.push(chunk)
    })

    await new Promise(resolve => setTimeout(resolve, 100))

    // Should only have status chunks, no text chunks
    const textChunks = chunks.filter(c => c.type === 'text')
    expect(textChunks).toHaveLength(0)
  })

  it('should send audio chunks when WebSocket is open', async () => {
    const engine = new STTFireworks(makeConfig() as any)

    const mockSend = vi.fn()

    // Mock WebSocket.OPEN constant
    const originalWebSocket = global.WebSocket
    // @ts-expect-error mocking
    global.WebSocket = class {}
    // @ts-expect-error mocking
    global.WebSocket.OPEN = 1

    class MockWebSocket {
      readyState = 1 // OPEN
      onopen: any
      onmessage: any
      onerror: any
      onclose: any
      send = mockSend

      close() {}
    }

    // @ts-expect-error mocking
    engine.streamingSession = new MockWebSocket()

    const audioChunk = new Blob(['audio data'])
    await engine.sendAudioChunk(audioChunk)

    expect(mockSend).toHaveBeenCalledWith(audioChunk)

    // Restore
    global.WebSocket = originalWebSocket
  })

  it('should not send audio chunks when WebSocket is not open', async () => {
    const engine = new STTFireworks(makeConfig() as any)

    const mockSend = vi.fn()

    // Mock WebSocket.OPEN constant
    const originalWebSocket = global.WebSocket
    // @ts-expect-error mocking
    global.WebSocket = class {}
    // @ts-expect-error mocking
    global.WebSocket.OPEN = 1

    class MockWebSocket {
      readyState = 0 // CONNECTING
      send = mockSend
    }

    // @ts-expect-error mocking
    engine.streamingSession = new MockWebSocket()

    const audioChunk = new Blob(['audio data'])
    await engine.sendAudioChunk(audioChunk)

    expect(mockSend).not.toHaveBeenCalled()

    // Restore
    global.WebSocket = originalWebSocket
  })

  it('should end streaming by closing WebSocket', async () => {
    const engine = new STTFireworks(makeConfig() as any)

    const mockClose = vi.fn()

    class MockWebSocket {
      close = mockClose
    }

    // @ts-expect-error mocking
    engine.streamingSession = new MockWebSocket()

    await engine.endStreaming()

    expect(mockClose).toHaveBeenCalled()
  })

  it('should return false for isModelDownloaded', async () => {
    const engine = new STTFireworks(makeConfig() as any)
    expect(await engine.isModelDownloaded('realtime')).toBe(false)
  })

  it('should have no-op deleteModel', async () => {
    const engine = new STTFireworks(makeConfig() as any)
    const result = await engine.deleteModel('realtime')
    expect(result).toBeUndefined()
  })

  it('should have no-op deleteAllModels', async () => {
    const engine = new STTFireworks(makeConfig() as any)
    const result = await engine.deleteAllModels()
    expect(result).toBeUndefined()
  })
})
