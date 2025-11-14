import { describe, it, expect, vi, beforeEach } from 'vitest'
import STTSpeechmatics from '../../src/renderer/voice/stt-speechmatics'

// Mock the Speechmatics SDK
vi.mock('@speechmatics/auth', () => ({
  createSpeechmaticsJWT: vi.fn()
}))

vi.mock('@speechmatics/real-time-client', () => ({
  RealtimeClient: vi.fn(),
  OperatingPoint: {
    Standard: 'standard',
    Enhanced: 'enhanced'
  }
}))

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
    speechmatics: { apiKey: 'test-api-key' },
  },
  ...overrides,
})

describe('STTSpeechmatics', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should have correct model definitions', () => {
    expect(STTSpeechmatics.models).toEqual([
      { id: 'realtime', label: 'Standard (realtime)' },
      { id: 'enhanced', label: 'Enhanced (realtime)' },
    ])
  })

  it('should correctly identify all models as streaming', () => {
    const engine = new STTSpeechmatics(makeConfig() as any)

    expect(engine.isStreamingModel('realtime')).toBe(true)
    expect(engine.isStreamingModel('enhanced')).toBe(true)
    expect(engine.isStreamingModel('anything')).toBe(true)
  })

  it('should not require PCM16 bits', () => {
    const engine = new STTSpeechmatics(makeConfig() as any)

    expect(engine.requiresPcm16bits('realtime')).toBe(false)
    expect(engine.requiresPcm16bits('enhanced')).toBe(false)
  })

  it('should return correct name', () => {
    const engine = new STTSpeechmatics(makeConfig() as any)
    expect(engine.name).toBe('speechmatics')
  })

  it('should be ready', () => {
    const engine = new STTSpeechmatics(makeConfig() as any)
    expect(engine.isReady()).toBe(true)
  })

  it('should not require download', () => {
    expect(STTSpeechmatics.requiresDownload()).toBe(false)

    const engine = new STTSpeechmatics(makeConfig() as any)
    expect(engine.requiresDownload()).toBe(false)
  })

  it('should initialize with callback', async () => {
    const engine = new STTSpeechmatics(makeConfig() as any)
    const callback = vi.fn()

    await engine.initialize(callback)

    expect(callback).toHaveBeenCalledWith({
      status: 'ready',
      task: 'speechmatics',
      model: 'realtime'
    })
  })

  it('should throw error for transcribe method', async () => {
    const engine = new STTSpeechmatics(makeConfig() as any)

    await expect(engine.transcribe(new Blob(['test audio']))).rejects.toThrow(
      'Transcription not supported in Speechmatics STT engine'
    )
  })

  it('should require API key for streaming', async () => {
    const configWithoutKey = makeConfig()
    configWithoutKey.engines.speechmatics.apiKey = ''
    const engine = new STTSpeechmatics(configWithoutKey as any)

    const callback = vi.fn()
    await engine.startStreaming('realtime', callback)

    expect(callback).toHaveBeenCalledWith({
      type: 'error',
      status: 'not_authorized',
      error: 'Missing API key. Please check your Speechmatics AI configuration.'
    })
  })

  it('should handle realtime streaming with Standard operating point', async () => {
    const { createSpeechmaticsJWT } = await import('@speechmatics/auth')
    const { RealtimeClient } = await import('@speechmatics/real-time-client')

    // Mock JWT creation
    vi.mocked(createSpeechmaticsJWT).mockResolvedValue('test-jwt-token')

    // Create a mock client
    const mockClient: any = {
      socketState: 'closed',
      addEventListener: vi.fn(),
      start: vi.fn().mockResolvedValue(undefined),
      sendAudio: vi.fn(),
      stopRecognition: vi.fn().mockResolvedValue(undefined)
    }

    vi.mocked(RealtimeClient).mockImplementation(() => mockClient)

    const engine = new STTSpeechmatics(makeConfig() as any)
    const chunks: any[] = []

    await engine.startStreaming('realtime', (chunk) => {
      chunks.push(chunk)
    })

    // Verify JWT was created
    expect(createSpeechmaticsJWT).toHaveBeenCalledWith({
      type: 'rt',
      apiKey: 'test-api-key',
      ttl: 60
    })

    // Verify client was created and started
    expect(RealtimeClient).toHaveBeenCalled()
    expect(mockClient.start).toHaveBeenCalledWith('test-jwt-token', {
      transcription_config: {
        operating_point: 'standard',
        language: 'en',
        additional_vocab: ['test', 'vocabulary'],
        enable_partials: true
      }
    })

    // Verify addEventListener was called
    expect(mockClient.addEventListener).toHaveBeenCalledWith('receiveMessage', expect.any(Function))
  })

  it('should handle realtime streaming with Enhanced operating point', async () => {
    const { createSpeechmaticsJWT } = await import('@speechmatics/auth')
    const { RealtimeClient } = await import('@speechmatics/real-time-client')

    // Mock JWT creation
    vi.mocked(createSpeechmaticsJWT).mockResolvedValue('test-jwt-token')

    // Create a mock client
    const mockClient: any = {
      socketState: 'closed',
      addEventListener: vi.fn(),
      start: vi.fn().mockResolvedValue(undefined),
      sendAudio: vi.fn(),
      stopRecognition: vi.fn().mockResolvedValue(undefined)
    }

    vi.mocked(RealtimeClient).mockImplementation(() => mockClient)

    const engine = new STTSpeechmatics(makeConfig() as any)

    await engine.startStreaming('enhanced', () => {})

    // Verify Enhanced operating point was used
    expect(mockClient.start).toHaveBeenCalledWith('test-jwt-token', {
      transcription_config: {
        operating_point: 'enhanced',
        language: 'en',
        additional_vocab: ['test', 'vocabulary'],
        enable_partials: true
      }
    })
  })

  it('should handle AddPartialTranscript messages', async () => {
    const { createSpeechmaticsJWT } = await import('@speechmatics/auth')
    const { RealtimeClient } = await import('@speechmatics/real-time-client')

    vi.mocked(createSpeechmaticsJWT).mockResolvedValue('test-jwt-token')

    let messageHandler: any = null
    const mockClient: any = {
      socketState: 'closed',
      addEventListener: vi.fn((event: string, handler: any) => {
        if (event === 'receiveMessage') {
          messageHandler = handler
        }
      }),
      start: vi.fn().mockResolvedValue(undefined),
      sendAudio: vi.fn(),
      stopRecognition: vi.fn().mockResolvedValue(undefined)
    }

    vi.mocked(RealtimeClient).mockImplementation(() => mockClient)

    const engine = new STTSpeechmatics(makeConfig() as any)
    const chunks: any[] = []

    await engine.startStreaming('realtime', (chunk) => {
      chunks.push(chunk)
    })

    // Simulate partial transcript
    messageHandler({
      data: {
        message: 'AddPartialTranscript',
        results: [
          { alternatives: [{ content: 'Hello' }] },
          { alternatives: [{ content: 'world' }] }
        ]
      }
    })

    const textChunks = chunks.filter(c => c.type === 'text')
    expect(textChunks).toHaveLength(1)
    expect(textChunks[0].content).toBe(' Hello world')
  })

  it('should handle AddTranscript messages and format text', async () => {
    const { createSpeechmaticsJWT } = await import('@speechmatics/auth')
    const { RealtimeClient } = await import('@speechmatics/real-time-client')

    vi.mocked(createSpeechmaticsJWT).mockResolvedValue('test-jwt-token')

    let messageHandler: any = null
    const mockClient: any = {
      socketState: 'closed',
      addEventListener: vi.fn((event: string, handler: any) => {
        if (event === 'receiveMessage') {
          messageHandler = handler
        }
      }),
      start: vi.fn().mockResolvedValue(undefined),
      sendAudio: vi.fn(),
      stopRecognition: vi.fn().mockResolvedValue(undefined)
    }

    vi.mocked(RealtimeClient).mockImplementation(() => mockClient)

    const engine = new STTSpeechmatics(makeConfig() as any)
    const chunks: any[] = []

    await engine.startStreaming('realtime', (chunk) => {
      chunks.push(chunk)
    })

    // Simulate transcript messages with punctuation
    messageHandler({
      data: {
        message: 'AddTranscript',
        results: [
          { alternatives: [{ content: 'Hello' }] },
          { alternatives: [{ content: ',' }] },
          { alternatives: [{ content: 'world' }] },
          { alternatives: [{ content: '.' }] }
        ]
      }
    })

    const textChunks = chunks.filter(c => c.type === 'text')
    expect(textChunks.length).toBeGreaterThan(0)
    // Should format with proper punctuation (remove space before comma and period)
    expect(textChunks[textChunks.length - 1].content).toBe('Hello, world.')
  })

  it('should handle French locale formatting differently', async () => {
    const frenchConfig = makeConfig()
    frenchConfig.stt.locale = 'fr-FR'

    const { createSpeechmaticsJWT } = await import('@speechmatics/auth')
    const { RealtimeClient } = await import('@speechmatics/real-time-client')

    vi.mocked(createSpeechmaticsJWT).mockResolvedValue('test-jwt-token')

    let messageHandler: any = null
    const mockClient: any = {
      socketState: 'closed',
      addEventListener: vi.fn((event: string, handler: any) => {
        if (event === 'receiveMessage') {
          messageHandler = handler
        }
      }),
      start: vi.fn().mockResolvedValue(undefined),
      sendAudio: vi.fn(),
      stopRecognition: vi.fn().mockResolvedValue(undefined)
    }

    vi.mocked(RealtimeClient).mockImplementation(() => mockClient)

    const engine = new STTSpeechmatics(frenchConfig as any)
    const chunks: any[] = []

    await engine.startStreaming('realtime', (chunk) => {
      chunks.push(chunk)
    })

    // Simulate transcript with question mark (French keeps space before ?)
    messageHandler({
      data: {
        message: 'AddTranscript',
        results: [
          { alternatives: [{ content: 'Bonjour' }] },
          { alternatives: [{ content: '?' }] }
        ]
      }
    })

    const textChunks = chunks.filter(c => c.type === 'text')
    // French should keep space before ?
    expect(textChunks[textChunks.length - 1].content).toBe('Bonjour ?')
  })

  it('should handle non-French locale formatting', async () => {
    const { createSpeechmaticsJWT } = await import('@speechmatics/auth')
    const { RealtimeClient } = await import('@speechmatics/real-time-client')

    vi.mocked(createSpeechmaticsJWT).mockResolvedValue('test-jwt-token')

    let messageHandler: any = null
    const mockClient: any = {
      socketState: 'closed',
      addEventListener: vi.fn((event: string, handler: any) => {
        if (event === 'receiveMessage') {
          messageHandler = handler
        }
      }),
      start: vi.fn().mockResolvedValue(undefined),
      sendAudio: vi.fn(),
      stopRecognition: vi.fn().mockResolvedValue(undefined)
    }

    vi.mocked(RealtimeClient).mockImplementation(() => mockClient)

    const engine = new STTSpeechmatics(makeConfig() as any)
    const chunks: any[] = []

    await engine.startStreaming('realtime', (chunk) => {
      chunks.push(chunk)
    })

    // Simulate transcript with exclamation and colon
    messageHandler({
      data: {
        message: 'AddTranscript',
        results: [
          { alternatives: [{ content: 'Hello' }] },
          { alternatives: [{ content: '!' }] }
        ]
      }
    })

    messageHandler({
      data: {
        message: 'AddTranscript',
        results: [
          { alternatives: [{ content: 'Note' }] },
          { alternatives: [{ content: ':' }] },
          { alternatives: [{ content: 'important' }] }
        ]
      }
    })

    const textChunks = chunks.filter(c => c.type === 'text')
    // Non-French should remove spaces before ! : ?
    expect(textChunks[0].content).toBe('Hello!')
    expect(textChunks[1].content).toBe('Hello! Note: important')
  })

  it('should handle EndOfTranscript message', async () => {
    const { createSpeechmaticsJWT } = await import('@speechmatics/auth')
    const { RealtimeClient } = await import('@speechmatics/real-time-client')

    vi.mocked(createSpeechmaticsJWT).mockResolvedValue('test-jwt-token')

    let messageHandler: any = null
    const mockClient: any = {
      socketState: 'closed',
      addEventListener: vi.fn((event: string, handler: any) => {
        if (event === 'receiveMessage') {
          messageHandler = handler
        }
      }),
      start: vi.fn().mockResolvedValue(undefined),
      sendAudio: vi.fn(),
      stopRecognition: vi.fn().mockResolvedValue(undefined)
    }

    vi.mocked(RealtimeClient).mockImplementation(() => mockClient)

    const engine = new STTSpeechmatics(makeConfig() as any)
    const chunks: any[] = []

    await engine.startStreaming('realtime', (chunk) => {
      chunks.push(chunk)
    })

    // Simulate end of transcript
    messageHandler({
      data: {
        message: 'EndOfTranscript'
      }
    })

    const statusChunks = chunks.filter(c => c.type === 'status')
    expect(statusChunks).toHaveLength(1)
    expect(statusChunks[0].status).toBe('done')
  })

  it('should send audio chunks when client is open', async () => {
    const engine = new STTSpeechmatics(makeConfig() as any)

    const mockSendAudio = vi.fn()
    const mockClient: any = {
      socketState: 'open',
      sendAudio: mockSendAudio
    }

    // @ts-expect-error mocking
    engine.client = mockClient

    const audioChunk = new Blob(['audio data'])
    await engine.sendAudioChunk(audioChunk)

    expect(mockSendAudio).toHaveBeenCalledWith(audioChunk)
  })

  it('should not send audio chunks when client is not open', async () => {
    const engine = new STTSpeechmatics(makeConfig() as any)

    const mockSendAudio = vi.fn()
    const mockClient: any = {
      socketState: 'closed',
      sendAudio: mockSendAudio
    }

    // @ts-expect-error mocking
    engine.client = mockClient

    const audioChunk = new Blob(['audio data'])
    await engine.sendAudioChunk(audioChunk)

    expect(mockSendAudio).not.toHaveBeenCalled()
  })

  it('should end streaming by stopping recognition', async () => {
    const engine = new STTSpeechmatics(makeConfig() as any)

    const mockStopRecognition = vi.fn().mockResolvedValue(undefined)
    const mockClient: any = {
      stopRecognition: mockStopRecognition
    }

    // @ts-expect-error mocking
    engine.client = mockClient

    await engine.endStreaming()

    expect(mockStopRecognition).toHaveBeenCalledWith({ noTimeout: true })
    expect(engine.client).toBeNull()
  })

  it('should return false for isModelDownloaded', async () => {
    const engine = new STTSpeechmatics(makeConfig() as any)
    expect(await engine.isModelDownloaded('realtime')).toBe(false)
  })

  it('should have no-op deleteModel', async () => {
    const engine = new STTSpeechmatics(makeConfig() as any)
    const result = await engine.deleteModel('realtime')
    expect(result).toBeUndefined()
  })

  it('should have no-op deleteAllModels', async () => {
    const engine = new STTSpeechmatics(makeConfig() as any)
    const result = await engine.deleteAllModels()
    expect(result).toBeUndefined()
  })
})
