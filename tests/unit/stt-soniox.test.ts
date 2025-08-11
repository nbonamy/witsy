import { describe, it, expect, vi, beforeEach } from 'vitest'
import STTSoniox from '../../src/voice/stt-soniox'

const makeConfig = (overrides: any = {}) => ({
  stt: {
    model: 'file-transcription',
    vocabulary: [
      { text: 'test' },
      { text: 'vocabulary' }
    ],
    soniox: {
      cleanup: false,
      audioFormat: 'auto'
    },
  },
  engines: {
    soniox: { apiKey: 'test-api-key' },
  },
  ...overrides,
})

describe('STTSoniox', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('should have correct model definitions', () => {
    expect(STTSoniox.models).toEqual([
      { id: 'file-transcription', label: 'File Transcription (async)' },
      { id: 'realtime-transcription', label: 'Real-time Transcription' },
    ])
  })

  it('should correctly identify streaming models', () => {
    const engine = new STTSoniox(makeConfig() as any)
    
    expect(engine.isStreamingModel('file-transcription')).toBe(false)
    expect(engine.isStreamingModel('realtime-transcription')).toBe(true)
  })

  it('should handle async transcription with direct API call', async () => {
    const engine = new STTSoniox(makeConfig() as any)
    
    // Mock the fetch calls for the new API workflow
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ 
        ok: true, 
        json: async () => ({ transcription_id: 'test-transcription-id' }) 
      }) // Create transcription
      .mockResolvedValueOnce({ 
        ok: true, 
        json: async () => ({ status: 'completed' }) 
      }) // Status check
      .mockResolvedValueOnce({ 
        ok: true, 
        json: async () => ({ text: 'Hello world from async transcription' }) 
      }) // Get transcript

    global.fetch = fetchMock
    
    // Mock FileReader for base64 conversion
    const mockFileReader = {
      readAsDataURL: vi.fn(),
      result: 'data:audio/webm;base64,dGVzdGF1ZGlv', // 'testaudio' in base64
      onload: null,
      onerror: null
    }

    vi.stubGlobal('FileReader', vi.fn(() => mockFileReader))
    
    // Simulate FileReader completion
    setTimeout(() => {
      mockFileReader.onload()
    }, 0)

    const result = await engine.transcribe(new Blob(['test audio data']))
    
    expect(result.text).toBe('Hello world from async transcription')
    expect(fetchMock).toHaveBeenCalledTimes(3)
    
    // Verify first call (create transcription)
    const [createUrl, createOptions] = fetchMock.mock.calls[0]
    expect(createUrl).toBe('https://api.soniox.com/v1/transcriptions')
    expect(createOptions.method).toBe('POST')
    expect(createOptions.headers['Authorization']).toBe('Bearer test-api-key')
    
    const createBody = JSON.parse(createOptions.body)
    expect(createBody.model).toBe('stt-async-preview')
    expect(createBody.audio_data).toBe('dGVzdGF1ZGlv')
    expect(createBody.language_hints).toEqual(['test', 'vocabulary'])
  })

  it('should handle transcription errors gracefully', async () => {
    const engine = new STTSoniox(makeConfig() as any)
    
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ 
        ok: false, 
        status: 400,
        statusText: 'Bad Request',
        text: async () => 'Invalid audio format'
      })

    global.fetch = fetchMock
    
    // Mock FileReader for base64 conversion
    const mockFileReader = {
      readAsDataURL: vi.fn(),
      result: 'data:audio/webm;base64,dGVzdA==', // 'test' in base64
      onload: null,
      onerror: null
    }

    vi.stubGlobal('FileReader', vi.fn(() => mockFileReader))
    
    // Simulate FileReader completion immediately
    setTimeout(() => {
      mockFileReader.onload()
    }, 0)

    await expect(engine.transcribe(new Blob(['invalid']))).rejects.toThrow(
      'Soniox transcription failed: 400 Bad Request - Invalid audio format'
    )
  }, 10000)

  it('should handle realtime streaming with proper token aggregation', async () => {
    const engine = new STTSoniox(makeConfig() as any)
    
    class MockWebSocket {
      readyState = WebSocket.CONNECTING
      onopen: any
      onmessage: any
      onerror: any
      onclose: any
      
      constructor(public url: string) {
        expect(url).toBe('wss://stt-rt.soniox.com/transcribe-websocket')
        
        setTimeout(() => {
          this.readyState = WebSocket.OPEN
          this.onopen?.()
          
          // Simulate token stream with final and non-final tokens
          setTimeout(() => {
            this.onmessage?.({
              data: JSON.stringify({
                tokens: [
                  { text: 'Hello ', is_final: false },
                  { text: 'world', is_final: false },
                ],
              }),
            })
          }, 10)
          
          setTimeout(() => {
            this.onmessage?.({
              data: JSON.stringify({
                tokens: [
                  { text: 'Hello ', is_final: true },
                  { text: 'from ', is_final: false },
                ],
              }),
            })
          }, 20)
          
          setTimeout(() => {
            this.onmessage?.({
              data: JSON.stringify({
                tokens: [
                  { text: 'from realtime', is_final: true },
                ],
              }),
            })
          }, 30)
          
          setTimeout(() => {
            this.onmessage?.({
              data: JSON.stringify({ finished: true })
            })
            this.readyState = WebSocket.CLOSED
            this.onclose?.({ code: 1000, reason: 'Normal closure' })
          }, 40)
        }, 5)
      }
      
      send(data: any) {
        if (typeof data === 'string') {
          const config = JSON.parse(data)
          expect(config.api_key).toBe('test-api-key')
          expect(config.model).toBe('stt-rt-preview')
          expect(config.audio_format).toBe('auto')
          expect(config.enable_non_final_tokens).toBe(true)
          expect(config.language_hints).toEqual(['test', 'vocabulary'])
        }
      }
      
      close() {
        this.readyState = WebSocket.CLOSED
        this.onclose?.({ code: 1000, reason: 'Manual close' })
      }
    }

    // @ts-expect-error mocking
    global.WebSocket = MockWebSocket
    
    const chunks: any[] = []
    await engine.startStreaming('realtime-transcription', (chunk) => {
      chunks.push(chunk)
    })
    
    // Wait for all messages to be processed
    await new Promise(resolve => setTimeout(resolve, 100))
    
    // Check that we received the expected messages
    const statusChunks = chunks.filter(c => c.type === 'status')
    const textChunks = chunks.filter(c => c.type === 'text')
    
    expect(statusChunks.length).toBeGreaterThanOrEqual(2) // at least connected, done
    expect(statusChunks[0].status).toBe('connected')
    expect(statusChunks[statusChunks.length - 1].status).toBe('done')
    
    expect(textChunks.length).toBeGreaterThan(0)
    
    // Final text should aggregate all final tokens
    const finalText = textChunks[textChunks.length - 1]?.content
    expect(finalText).toBe('Hello from realtime')
  })

  it('should handle streaming connection errors', async () => {
    const engine = new STTSoniox(makeConfig() as any)
    
    class MockWebSocket {
      onopen: any
      onmessage: any
      onerror: any
      onclose: any
      
      constructor() {
        setTimeout(() => {
          this.onerror?.({ message: 'Connection failed' })
          this.onclose?.({ code: 1006, reason: 'Abnormal closure' })
        }, 10)
      }
      
      send() {}
    }

    // @ts-expect-error mocking
    global.WebSocket = MockWebSocket
    
    const chunks: any[] = []
    await engine.startStreaming('realtime-transcription', (chunk) => {
      chunks.push(chunk)
    })
    
    await new Promise(resolve => setTimeout(resolve, 50))
    
    const errorChunks = chunks.filter(c => c.type === 'error')
    expect(errorChunks).toHaveLength(1)
    expect(errorChunks[0].error).toMatch(/Connection (failed|closed unexpectedly)/)
  })

  it('should require API key for transcription', async () => {
    const configWithoutKey = makeConfig()
    configWithoutKey.engines.soniox.apiKey = ''
    const engine = new STTSoniox(configWithoutKey as any)
    
    await expect(engine.transcribe(new Blob(['test']))).rejects.toThrow(
      'Missing Soniox API key. Please configure your API key in Settings > Audio > Speech to Text.'
    )
  })

  it('should require API key for streaming', async () => {
    const configWithoutKey = makeConfig()
    configWithoutKey.engines.soniox.apiKey = ''
    const engine = new STTSoniox(configWithoutKey as any)
    
    const chunks: any[] = []
    await engine.startStreaming('realtime-transcription', (chunk) => {
      chunks.push(chunk)
    })
    
    const errorChunks = chunks.filter(c => c.type === 'error')
    expect(errorChunks).toHaveLength(1)
    expect(errorChunks[0].status).toBe('not_authorized')
    expect(errorChunks[0].error).toContain('Missing Soniox API key')
  })
})