
import { expect, test, vi, beforeEach, afterEach, describe } from 'vitest'
import TTSMiniMax from '../../src/voice/tts-minimax'
import defaults from '../../defaults/settings.json'
import { Configuration } from '../../src/types/config'

vi.mock('../../src/main/ipc.ts', () => ({}))

// Mock fetch
const mockFetch = vi.fn()
global.fetch = mockFetch as any

// Mock FileReader
class MockFileReader {
  result: string | null = null
  onloadend: (() => void) | null = null
  onerror: ((error: any) => void) | null = null

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  readAsDataURL(blob: Blob) {
    setTimeout(() => {
      this.result = 'data:audio/mp3;base64,mockbase64data'
      if (this.onloadend) this.onloadend()
    }, 0)
  }
}
global.FileReader = MockFileReader as any

beforeEach(() => {
  mockFetch.mockClear()
})

afterEach(() => {
  vi.clearAllMocks()
})

describe('TTSMiniMax Static Data', () => {
  test('has correct models', () => {
    expect(TTSMiniMax.models.length).toBe(6)
    expect(TTSMiniMax.models[0]).toHaveProperty('id')
    expect(TTSMiniMax.models[0]).toHaveProperty('label')
    expect(TTSMiniMax.models[0].id).toBe('speech-2.6-hd')
  })

  test('has correct static voices', () => {
    const voices = TTSMiniMax.voices('speech-02-hd')
    expect(voices.length).toBeGreaterThan(0)
    expect(voices[0]).toHaveProperty('id')
    expect(voices[0]).toHaveProperty('label')
    expect(voices[0].id).toBe('Calm_Man')
  })
})

describe('TTSMiniMax Construction', () => {
  test('constructs with config', () => {
    const config = defaults as unknown as Configuration
    const engine = new TTSMiniMax(config)
    expect(engine).toBeDefined()
    expect(engine.config).toBe(config)
  })
})

describe('TTSMiniMax Synthesis', () => {
  test('throws error when API key not configured', async () => {
    const config = { ...defaults, engines: { minimax: {} } } as unknown as Configuration
    const engine = new TTSMiniMax(config)
    await expect(engine.synthetize('test')).rejects.toThrow('MiniMax API key not configured')
  })

  test('makes correct API request for non-streaming', async () => {
    const config = {
      ...defaults,
      engines: {
        minimax: {
          apiKey: 'test-api-key',
        }
      },
      tts: {
        engine: 'minimax',
        model: 'speech-02-hd',
        voice: 'Calm_Man'
      }
    } as unknown as Configuration

    const mockAudioHex = '48656c6c6f' // "Hello" in hex
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: {
          audio: mockAudioHex,
          status: 2
        }
      })
    })

    const engine = new TTSMiniMax(config)
    const result = await engine.synthetize('Hello world', { stream: false })

    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.minimax.io/v1/t2a_v2',
      expect.objectContaining({
        method: 'POST',
        headers: {
          'Authorization': 'Bearer test-api-key',
          'Content-Type': 'application/json'
        },
        body: expect.stringContaining('Hello world')
      })
    )

    expect(result).toEqual({
      type: 'audio',
      mimeType: 'audio/mp3',
      content: 'data:audio/mp3;base64,mockbase64data'
    })
  })

  test('handles API error', async () => {
    const config = {
      ...defaults,
      engines: {
        minimax: {
          apiKey: 'test-api-key',
        }
      }
    } as unknown as Configuration

    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      text: async () => 'Unauthorized'
    })

    const engine = new TTSMiniMax(config)
    await expect(engine.synthetize('test')).rejects.toThrow('MiniMax API error: 401 Unauthorized')
  })

  test('handles missing audio data in response', async () => {
    const config = {
      ...defaults,
      engines: {
        minimax: {
          apiKey: 'test-api-key',
        }
      }
    } as unknown as Configuration

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: {}
      })
    })

    const engine = new TTSMiniMax(config)
    await expect(engine.synthetize('test', { stream: false })).rejects.toThrow('No audio data in response')
  })

  test('returns ReadableStream for streaming mode', async () => {
    const config = {
      ...defaults,
      engines: {
        minimax: {
          apiKey: 'test-api-key',
        }
      },
      tts: {
        engine: 'minimax',
        model: 'speech-02-hd',
        voice: 'Calm_Man'
      }
    } as unknown as Configuration

    const mockAudioChunk1 = '48656c6c6f' // "Hello" in hex
    const mockAudioChunk2 = '576f726c64' // "World" in hex
    const sseData1 = `data: ${JSON.stringify({ data: { audio: mockAudioChunk1, status: 1 } })}\n\n`
    const sseData2 = `data: ${JSON.stringify({ data: { audio: mockAudioChunk2, status: 2 } })}\n\n`

    const mockBody = new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode(sseData1))
        controller.enqueue(new TextEncoder().encode(sseData2))
        controller.close()
      }
    })

    mockFetch.mockResolvedValueOnce({
      ok: true,
      body: mockBody
    })

    const engine = new TTSMiniMax(config)
    const result = await engine.synthetize('Hello world')

    expect(result.type).toBe('audio')
    expect(result.mimeType).toBe('audio/mp3')
    expect(result.content).toBeInstanceOf(ReadableStream)
  })

  test('returns base64 string for non-streaming mode', async () => {
    const config = {
      ...defaults,
      engines: {
        minimax: {
          apiKey: 'test-api-key',
        }
      }
    } as unknown as Configuration

    const mockAudioHex = '48656c6c6f'
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: {
          audio: mockAudioHex,
          status: 2
        }
      })
    })

    const engine = new TTSMiniMax(config)
    const result = await engine.synthetize('test', { stream: false })

    expect(result.type).toBe('audio')
    expect(result.mimeType).toBe('audio/mp3')
    expect(typeof result.content).toBe('string')
    expect(result.content).toMatch(/^data:audio\/mp3;base64,/)
  })
})

describe('TTSMiniMax Voice Fetching', () => {
  test('fetches voices from API successfully', async () => {
    const config = {
      ...defaults,
      engines: {
        minimax: {
          apiKey: 'test-api-key',
        }
      }
    } as unknown as Configuration

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        system_voice: [
          { voice_id: 'Voice_A', name: 'Voice A' },
          { voice_id: 'Voice_C', name: 'Voice C' },
          { voice_id: 'Voice_B', name: 'Voice B' }
        ]
      })
    })

    const engine = new TTSMiniMax(config)
    const voices = await engine.getVoices('speech-02-hd')

    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.minimax.io/v1/get_voice',
      expect.objectContaining({
        method: 'POST',
        headers: {
          'Authorization': 'Bearer test-api-key',
          'Content-Type': 'application/json'
        },
        body: '{ "voice_type": "all" }'
      })
    )

    expect(voices.length).toBe(3)
    // Check sorting - voices should be sorted alphabetically
    expect(voices[0].label).toBe('Voice A')
    expect(voices[1].label).toBe('Voice B')
    expect(voices[2].label).toBe('Voice C')
  })

  test('falls back to static voices on any error', async () => {
    const config = {
      ...defaults,
      engines: {
        minimax: {
          apiKey: 'test-api-key',
        }
      }
    } as unknown as Configuration

    const engine = new TTSMiniMax(config)

    // Test API error
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500
    })
    let voices = await engine.getVoices('speech-02-hd')
    expect(voices.length).toBeGreaterThan(0)
    expect(voices[0].id).toBe('Calm_Man')

    // Test missing data
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: {} })
    })
    voices = await engine.getVoices('speech-02-hd')
    expect(voices.length).toBeGreaterThan(0)
    expect(voices[0].id).toBe('Calm_Man')

    // Test network error
    mockFetch.mockRejectedValueOnce(new Error('Network error'))
    voices = await engine.getVoices('speech-02-hd')
    expect(voices.length).toBeGreaterThan(0)
    expect(voices[0].id).toBe('Calm_Man')
  })

  test('returns static voices when API key missing', async () => {
    const config = {
      ...defaults,
      engines: { minimax: {} }
    } as unknown as Configuration

    const engine = new TTSMiniMax(config)
    const voices = await engine.getVoices('speech-02-hd')

    expect(voices.length).toBeGreaterThan(0)
    expect(voices[0].id).toBe('Calm_Man')
    expect(mockFetch).not.toHaveBeenCalled()
  })
})
