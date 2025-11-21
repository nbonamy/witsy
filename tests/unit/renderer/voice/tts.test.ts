
import { vi, beforeEach, expect, test } from 'vitest'
import { store } from '@services/store'
import defaults from '@root/defaults/settings.json'
import getTTSEngine from '@renderer/voice/tts'
import TTSFalAi from '@renderer/voice/tts-falai'
import TTSElevenLabs from '@renderer/voice/tts-elevenlabs'
import TTSGroq from '@renderer/voice/tts-groq'
import TTSOpenAI from '@renderer/voice/tts-openai'
import TTSMiniMax from '@renderer/voice/tts-minimax'

// @ts-expect-error mocking
global.fetch = vi.fn(async (url) => ({
  blob: () => new Blob([url], { type: 'text/plain' })
}))

vi.mock('openai', async () => {
  const OpenAI = vi.fn((opts: any) => {
    OpenAI.prototype.apiKey = opts.apiKey
    OpenAI.prototype.baseURL = opts.baseURL
  })
  OpenAI.prototype.audio = {
    speech: {
      create: vi.fn((opts) => opts.input)
    }
  }
  return { default : OpenAI }
})

vi.mock('groq-sdk', async () => {
  const Groq = vi.fn()
  Groq.prototype.audio = {
    speech: {
      create: vi.fn((opts) => {
        return { blob: vi.fn(() => {
          return new Blob([opts.input], { type: 'text/plain' })
        })}
      })
    }
  }
  return { default : Groq }
})

vi.mock('elevenlabs', async () => {
  const ElevenLabsClient = vi.fn()
  ElevenLabsClient.prototype.textToSpeech = {
    convertAsStream: vi.fn((_, opts) => opts.text)
  }
  return { ElevenLabsClient }
})

vi.mock('@fal-ai/client', async () => {
  return {
    fal: {
      config: vi.fn(),
      subscribe: (model, opts) => ({ data: { audio: { url: opts.input.text } } })
    }
  }
})

beforeEach(() => {
  store.config = defaults
})

test('OpenAI data', async () => {
  expect(TTSOpenAI.models.length).toBe(3)
  expect(TTSOpenAI.voices('gpt-4o-mini-tts').length).toBe(9)
  expect(TTSOpenAI.voices('tts-1').length).toBe(9)
  expect(TTSOpenAI.voices('tts-1-hd').length).toBe(9)
})

test('OpenAI', async () => {
  const tts = getTTSEngine(store.config)
  const response = await tts.synthetize('hello openai')
  expect(response).toStrictEqual({ type: 'audio', content: 'hello openai' })
})

test('Groq data', async () => {
  expect(TTSGroq.models.length).toBe(2)
  expect(TTSGroq.voices('playai-tts').length).toBe(19)
  expect(TTSGroq.voices('playai-tts-arabic').length).toBe(4)
  expect(TTSGroq.voices('playai-tts-chinese').length).toBe(1)
})

test('Groq', async () => {
  store.config.tts.engine = 'groq'
  const tts = getTTSEngine(store.config)
  const response = await tts.synthetize('hello groq')
  expect(response).toStrictEqual({ type: 'audio', content: `data:text/plain;base64,${btoa("hello groq")}`, mimeType: 'audio/wav' })
})

test('ElevenLabs data', async () => {
  expect(TTSElevenLabs.models.length).toBe(7)
  expect(TTSElevenLabs.voices('elevenlabs-model1').length).toBe(20)
  expect(TTSElevenLabs.voices('elevenlabs-model2').length).toBe(20)
})

test('ElevenLabs', async () => {
  store.config.tts.engine = 'elevenlabs'
  const tts = getTTSEngine(store.config)
  const response = await tts.synthetize('hello elevenlabs')
  expect(response).toStrictEqual({ type: 'audio', content: 'hello elevenlabs' })
})

test('fal.ai data', async () => {
  expect(TTSFalAi.models.length).toBe(9)
  expect(TTSFalAi.voices('fal-ai/kokoro/american-english').length).toBe(20)
  expect(TTSFalAi.voices('fal-ai/kokoro/british-english').length).toBe(8)
  expect(TTSFalAi.voices('fal-ai/kokoro/spanish').length).toBe(3)
  expect(TTSFalAi.voices('fal-ai/kokoro/french').length).toBe(1)
  expect(TTSFalAi.voices('fal-ai/kokoro/italian').length).toBe(2)
  expect(TTSFalAi.voices('fal-ai/kokoro/brazilian-portuguese').length).toBe(3)
  expect(TTSFalAi.voices('fal-ai/kokoro/mandarin-chinese').length).toBe(8)
  expect(TTSFalAi.voices('fal-ai/kokoro/japanese').length).toBe(5)
  expect(TTSFalAi.voices('fal-ai/kokoro/hindi').length).toBe(4)
  expect(TTSFalAi.voices('fal-ai/kokoro/vietnamese').length).toBe(1)
  expect(TTSFalAi.voices('fal-ai/kokoro/vietnamese')[0]).toStrictEqual({ id: '', label: 'Default' })
})

test('fal.ai', async () => {
  store.config.tts.engine = 'falai'
  const tts = getTTSEngine(store.config)
  const response = await tts.synthetize('hello fal.ai')
  expect(response).toStrictEqual({ type: 'audio', content: `data:text/plain;base64,${btoa("hello fal.ai")}`, mimeType: 'audio/wav' })
})

test('Custom OpenAI', async () => {
  store.config.tts.engine = 'custom'
  store.config.tts.model = 'custom-model'
  store.config.tts.customOpenAI.baseURL = 'https://api.custom.com/v1'
  const tts = getTTSEngine(store.config)
  expect(tts).toBeDefined()
  expect(tts).toBeInstanceOf(TTSOpenAI)
  expect((tts as TTSOpenAI).client.baseURL).toBe('https://api.custom.com/v1')
  const response = await tts.synthetize('hello custom')
  expect(response).toStrictEqual({ type: 'audio', content: 'hello custom' })
})

test('MiniMax data', async () => {
  expect(TTSMiniMax.models.length).toBe(6)
  expect(TTSMiniMax.voices('speech-02-hd').length).toBeGreaterThan(0)
  expect(TTSMiniMax.voices('speech-02-hd')[0].id).toBe('Calm_Man')
})

test('MiniMax', async () => {
  store.config.tts.engine = 'minimax'
  store.config.engines.minimax = {
    apiKey: 'test-key',
  }
  const tts = getTTSEngine(store.config)
  expect(tts).toBeDefined()
  expect(tts).toBeInstanceOf(TTSMiniMax)
})
