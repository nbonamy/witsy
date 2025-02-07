
import { vi, beforeAll, beforeEach, expect, test } from 'vitest'
import { store } from '../../src/services/store'
import defaults from '../../defaults/settings.json'
import getSTTEngine, { requiresDownload } from '../../src/voice/stt'
import STTOpenAI from '../../src/voice/stt-openai'
import STTGroq from '../../src/voice/stt-groq'
import STTWhisper from '../../src/voice/stt-whisper'

const initCallback = vi.fn()

// for an unknown reason, we cannot really mock those
// if we use vi.fn instead of direct implementation
// tests will fail. therefore we cannot test
// that api methods are indeed called correctly
// which poses the question: what are we really testing here?

vi.mock('openai', async () => {
  const OpenAI = vi.fn()
  OpenAI.prototype.audio = {
    transcriptions: {
      create: () =>  ({ text: 'transcribed' })
    }
  }
  return { default : OpenAI }
})

vi.mock('groq-sdk', async () => {
  const Groq = vi.fn()
  Groq.prototype.audio = {
    transcriptions: {
      create: () =>  ({ text: 'transcribed' })
    }
  }
  return { default : Groq }
})

vi.mock('@huggingface/transformers', async () => {
  return {
    env: { allowLocalModels: false },
    pipeline: async (task, model, opts) => {
      opts.progress_callback({ task, model, status: 'initiate' })
      return () => ({ text: 'transcribed' })
    }
  }
})

beforeAll(() => {
  window.AudioContext = vi.fn()
  // @ts-expect-error mocking
  window.AudioContext.prototype.decodeAudioData = () => {
    return { getChannelData: () => {} }
  }
})

beforeEach(() => {
  store.config = defaults
  vi.resetAllMocks()
})

test('Requires download', () => {
  expect(requiresDownload('openai')).toBe(false)
  expect(requiresDownload('groq')).toBe(false)
  expect(requiresDownload('whisper')).toBe(true)
})

test('Instanciates OpenAI by default', async () => {
  store.config.stt.engine = 'openai'
  const engine = getSTTEngine(store.config)
  expect(engine).toBeDefined()
  expect(engine).toBeInstanceOf(STTOpenAI)
  expect(engine).toHaveProperty('transcribe')
  expect(engine.isReady()).toBe(true)
  expect(engine.requiresDownload()).toBe(false)
  await engine.initialize(initCallback)
  expect(initCallback).toHaveBeenCalledWith({ task: 'openai', status: 'ready', model: expect.any(String) })
  await expect(engine.transcribe(new Blob())).resolves.toStrictEqual({ text: 'transcribed' })
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
  await expect(engine.transcribe(new Blob())).resolves.toStrictEqual({ text: 'transcribed' })
})

test('Instanciates Whisper', async () => {
  store.config.stt.engine = 'whisper'
  const engine = getSTTEngine(store.config)
  expect(engine).toBeDefined()
  expect(engine).toBeInstanceOf(STTWhisper)
  expect(engine).toHaveProperty('transcribe')
  expect(engine.isReady()).toBe(false)
  expect(engine.requiresDownload()).toBe(true)
  await engine.initialize(initCallback)
  expect(initCallback).toHaveBeenCalledWith(expect.objectContaining({ task:'automatic-speech-recognition', status: 'initiate', model: expect.any(String) }))
  await expect(engine.transcribe(new Blob())).resolves.toStrictEqual({ text: 'transcribed' })
})

test('Throws error on unknown engine', async () => {
  store.config.stt.engine = 'unknown'
  expect(() => getSTTEngine(store.config)).toThrowError('Unknown STT engine unknown')
})
