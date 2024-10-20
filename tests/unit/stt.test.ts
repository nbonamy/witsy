
import { vi, beforeEach, expect, test } from 'vitest'
import { store } from '../../src/services/store'
import defaults from '../../defaults/settings.json'
import getSTTEngine from '../../src/services/stt'
import STTOpenAI from '../../src/services/stt-openai'
import STTGroq from '../../src/services/stt-groq'
import STTWhisper from '../../src/services/stt-whisper'
import exp from 'constants'

const initCallback = vi.fn()

beforeEach(() => {
  store.config = defaults
  vi.resetAllMocks()
})

test('Instanciates OpenAI by default', async () => {
  const engine = getSTTEngine(store.config)
  expect(engine).toBeDefined()
  expect(engine).toBeInstanceOf(STTOpenAI)
  expect(engine).toHaveProperty('transcribe')
  expect(engine.isReady()).toBe(true)
  expect(engine.requiresDownload()).toBe(false)
  await engine.initialize(initCallback)
  expect(initCallback).toHaveBeenCalledWith({ task: 'openai', status: 'ready', model: expect.any(String) })
})

test('Instanciates Groq', async () => {
  store.config.stt.engine = 'groq'
  const engine = getSTTEngine(store.config)
  expect(engine).toBeDefined()
  expect(engine).toBeInstanceOf(STTGroq)
  expect(engine).toHaveProperty('transcribe')
  expect(engine.isReady()).toBe(true)
  expect(engine.requiresDownload()).toBe(false)
  await engine.initialize(initCallback)
  expect(initCallback).toHaveBeenCalledWith({ task: 'groq', status: 'ready', model: expect.any(String) })
})

test('Instanciates Whisper', async () => {
  store.config.stt.engine = 'whisper'
  const engine = getSTTEngine(store.config)
  expect(engine).toBeDefined()
  expect(engine).toBeInstanceOf(STTWhisper)
  expect(engine).toHaveProperty('transcribe')
  expect(engine.isReady()).toBe(false)
  expect(engine.requiresDownload()).toBe(true)
})

test('Throws error on unknown engine', async () => {
  store.config.stt.engine = 'unknown'
  expect(() => getSTTEngine(store.config)).toThrowError('Unknown STT engine unknown')
})
