import { describe, it, expect, vi, beforeEach } from 'vitest'
import STTSoniox from '../../../../src/renderer/voice/stt-soniox'

const makeConfig = (overrides: any = {}) => ({
  stt: {
    model: 'async-transcription',
    locale: 'en-US',
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
      { id: 'async-transcription', label: 'Async Transcription' },
      { id: 'realtime-transcription', label: 'Real-Time Transcription' },
    ])
  })

  it('should correctly identify streaming models', () => {
    const engine = new STTSoniox(makeConfig() as any)
    
    expect(engine.isStreamingModel('async-transcription')).toBe(false)
    expect(engine.isStreamingModel('realtime-transcription')).toBe(true)
  })

  it('should correctly identify PCM requirements', () => {
    const engine = new STTSoniox(makeConfig() as any)
    
    expect(engine.requiresPcm16bits('async-transcription')).toBe(false)
    expect(engine.requiresPcm16bits('realtime-transcription')).toBe(true)
  })

  it('should handle async transcription with file upload workflow', async () => {
    const engine = new STTSoniox(makeConfig() as any)
    
    // Mock the fetch calls for the new file upload workflow
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ 
        ok: true, 
        json: async () => ({ id: 'test-file-id' }) 
      }) // File upload
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

    const result = await engine.transcribe(new Blob(['test audio data'], { type: 'audio/webm' }))
    
    expect(result.text).toBe('Hello world from async transcription')
    expect(fetchMock).toHaveBeenCalledTimes(4)
    
    // Verify file upload call
    const [uploadUrl, uploadOptions] = fetchMock.mock.calls[0]
    expect(uploadUrl).toBe('https://api.soniox.com/v3/files')
    expect(uploadOptions.method).toBe('POST')
    expect(uploadOptions.headers['Authorization']).toBe('Bearer test-api-key')
    expect(uploadOptions.body).toBeInstanceOf(FormData)
    
    // Verify transcription creation call
    const [createUrl, createOptions] = fetchMock.mock.calls[1]
    expect(createUrl).toBe('https://api.soniox.com/v3/transcriptions')
    expect(createOptions.method).toBe('POST')
    expect(createOptions.headers['Authorization']).toBe('Bearer test-api-key')
    
    const createBody = JSON.parse(createOptions.body)
    expect(createBody.model).toBe('stt-async-preview')
    expect(createBody.file_id).toBe('test-file-id')
    expect(createBody.language_hints).toEqual(['en']) // from locale 'en-US'
    expect(createBody.context).toBe('test, vocabulary')
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

    await expect(engine.transcribe(new Blob(['invalid']))).rejects.toThrow(
      'File upload failed: 400 Bad Request - Invalid audio format'
    )
  })

  it('should handle realtime streaming with proper token aggregation', async () => {
    const engine = new STTSoniox(makeConfig() as any)
    
    class MockWebSocket {
      readyState = WebSocket.CONNECTING
      onopen: any
      onmessage: any
      onerror: any
      onclose: any
      
      constructor(public url: string) {
        expect(url).toBe('wss://api.soniox.com/v3/streaming/speech-to-text')
        
        setTimeout(() => {
          this.readyState = WebSocket.OPEN
          this.onopen?.()
          
          // Simulate token stream with only final tokens (no partials)
          setTimeout(() => {
            this.onmessage?.({
              data: JSON.stringify({
                tokens: [
                  { text: 'Hello ', is_final: true },
                ],
              }),
            })
          }, 10)
          
          setTimeout(() => {
            this.onmessage?.({
              data: JSON.stringify({
                tokens: [
                  { text: 'from realtime', is_final: true },
                ],
              }),
            })
          }, 20)
          
          setTimeout(() => {
            this.onmessage?.({
              data: JSON.stringify({ finished: true })
            })
            this.readyState = WebSocket.CLOSED
            this.onclose?.({ code: 1000, reason: 'Normal closure' })
          }, 30)
        }, 5)
      }
      
      send(data: any) {
        if (typeof data === 'string') {
          const config = JSON.parse(data)
          expect(config.api_key).toBe('test-api-key')
          expect(config.model).toBe('stt-rt-preview-v2')
          expect(config.audio_format).toBe('pcm_s16le')
          expect(config.sample_rate).toBe(16000)
          expect(config.num_channels).toBe(1)
          expect(config.enable_non_final_tokens).toBe(false)
          expect(config.language_hints).toEqual(['en']) // from locale
          expect(config.context).toBe('test, vocabulary')
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
    const finalChunk = textChunks[textChunks.length - 1]
    expect(finalChunk?.content).toBe('Hello from realtime')
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