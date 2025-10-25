
import { expect, test, vi, beforeEach, afterEach } from 'vitest'
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

test('TTSMiniMax Models', () => {
  expect(TTSMiniMax.models.length).toBe(4)
  expect(TTSMiniMax.models[0]).toHaveProperty('id')
  expect(TTSMiniMax.models[0]).toHaveProperty('label')
  expect(TTSMiniMax.models[0].id).toBe('speech-02-hd')
})

test('TTSMiniMax Voices', () => {
  const voices = TTSMiniMax.voices('speech-02-hd')
  expect(voices.length).toBeGreaterThan(0)
  expect(voices[0]).toHaveProperty('id')
  expect(voices[0]).toHaveProperty('label')
  expect(voices[0].id).toBe('Wise_Woman')
})

test('TTSMiniMax Constructor', () => {
  const config = defaults as unknown as Configuration
  const engine = new TTSMiniMax(config)
  expect(engine).toBeDefined()
  expect(engine.config).toBe(config)
})

test('TTSMiniMax synthetize throws error when API key not configured', async () => {
  const config = { ...defaults, engines: { minimax: {} } } as unknown as Configuration
  const engine = new TTSMiniMax(config)
  await expect(engine.synthetize('test')).rejects.toThrow('MiniMax API key not configured')
})

test('TTSMiniMax synthetize throws error when Group ID not configured', async () => {
  const config = {
    ...defaults,
    engines: { minimax: { apiKey: 'test-key' } }
  } as unknown as Configuration
  const engine = new TTSMiniMax(config)
  await expect(engine.synthetize('test')).rejects.toThrow('MiniMax Group ID not configured')
})

test('TTSMiniMax synthetize makes correct API request', async () => {
  const config = {
    ...defaults,
    engines: {
      minimax: {
        apiKey: 'test-api-key',
        groupId: 'test-group-id'
      }
    },
    tts: {
      engine: 'minimax',
      model: 'speech-02-hd',
      voice: 'Wise_Woman'
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
  const result = await engine.synthetize('Hello world')

  expect(mockFetch).toHaveBeenCalledWith(
    'https://api.minimaxi.chat/v1/t2a_v2?GroupId=test-group-id',
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

test('TTSMiniMax synthetize handles API error', async () => {
  const config = {
    ...defaults,
    engines: {
      minimax: {
        apiKey: 'test-api-key',
        groupId: 'test-group-id'
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

test('TTSMiniMax synthetize handles missing audio data', async () => {
  const config = {
    ...defaults,
    engines: {
      minimax: {
        apiKey: 'test-api-key',
        groupId: 'test-group-id'
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
  await expect(engine.synthetize('test')).rejects.toThrow('No audio data in response')
})
