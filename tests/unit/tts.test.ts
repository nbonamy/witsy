
import { vi, beforeEach, expect, test } from 'vitest'
import { store } from '../../src/services/store'
import defaults from '../../defaults/settings.json'
import getTTSEngine from '../../src/voice/tts'

vi.mock('openai', async () => {
  const OpenAI = vi.fn()
  OpenAI.prototype.audio = {
    speech: {
      create: vi.fn((opts) => opts.input)
    }
  }
  return { default : OpenAI }
})

vi.mock('elevenlabs', async () => {
  const ElevenLabsClient = vi.fn()
  ElevenLabsClient.prototype.textToSpeech = {
    convertAsStream: vi.fn((_, opts) => opts.text)
  }
  return { ElevenLabsClient }
})

beforeEach(() => {
  store.config = defaults
})

test('OpenAI', async () => {
  const tts = getTTSEngine(store.config)
  const response = await tts.synthetize('hello openai')
  expect(response).toStrictEqual({ type: 'audio', content: 'hello openai' })
})

test('ElevenLabs', async () => {
  store.config.tts.engine = 'elevenlabs'
  const tts = getTTSEngine(store.config)
  const response = await tts.synthetize('hello elevenlabs')
  expect(response).toStrictEqual({ type: 'audio', content: 'hello elevenlabs' })
})

// test('Kokoro', async () => {
//   store.config.tts.engine = 'kokoro'
//   const tts = getTTSEngine(store.config)
//   const response = await tts.synthetize('hello kokoro')
//   expect(response).toStrictEqual({ type: 'audio', content: 'hello kokoro' })
// })

