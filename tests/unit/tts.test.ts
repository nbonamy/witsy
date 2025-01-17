
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

beforeEach(() => {
  store.config = defaults
})

test('Synthetizes text', async () => {
  const tts = getTTSEngine(store.config)
  const response = await tts.synthetize('hello')
  expect(response).toStrictEqual({ type: 'audio', content: 'hello' })
})
