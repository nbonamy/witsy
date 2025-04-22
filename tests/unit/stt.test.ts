
import { vi, beforeAll, beforeEach, expect, test } from 'vitest'
import { store } from '../../src/services/store'
import defaults from '../../defaults/settings.json'
import getSTTEngine, { requiresDownload } from '../../src/voice/stt'
import STTOpenAI from '../../src/voice/stt-openai'
import STTGroq from '../../src/voice/stt-groq'
import STTFalAi from '../../src/voice/stt-falai'
import STTWhisper from '../../src/voice/stt-whisper'
import STTGladia from '../../src/voice/stt-gladia'
import STTHuggingFace from '../../src/voice/stt-huggingface'
import STTNvidia from '../../src/voice/stt-nvidia'
import { fal } from '@fal-ai/client'

const initCallback = vi.fn()

// for an unknown reason, we cannot really mock those
// if we use vi.fn instead of direct implementation
// tests will fail. therefore we cannot test
// that api methods are indeed called correctly
// which poses the question: what are we really testing here?

// @ts-expect-error mocking
global.fetch = async (url) => {
  console.log('fetch', url)
  if (url.includes('gladia') && url.includes('pre-recorded')) {
    return {
      json: () => ({
        result_url: 'https://api.gladia.io/v2/transcription/1234567890',
      })
    }
  }
  if (url.includes('gladia') && url.includes('transcription')) {
    return {
      json: () => ({
        status: 'done',
        result: { transcription: { full_transcript: 'transcribed' } }
      })
    }
  }
  if (url.includes('nvidia')) {
    return {
      ok: true,
      json: () => ({
        choices: [ { message: { content: 'transcribed' } } ]
      })
    }
  }
}

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

vi.mock('@fal-ai/client', async () => {
  return {
    fal: {
      config: vi.fn(),
      subscribe: () => ({ data: { text: 'transcribed' } })
    }
  }
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

vi.mock('@huggingface/inference', async () => {
  const HfInference = vi.fn()
  HfInference.prototype.automaticSpeechRecognition = async () => {
    return { text: 'transcribed' }
  }
  return { HfInference }
})

vi.mock('webm-to-wav-converter', async () => {
  return {
    getWaveBlob: async (blob) => {
      return new Blob([blob], { type: 'audio/wav' })
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
  store.config.engines.falai.apiKey = 'falai-api-key'
  vi.resetAllMocks()
})

test('Requires download', () => {
  expect(requiresDownload('openai')).toBe(false)
  expect(requiresDownload('groq')).toBe(false)
  expect(requiresDownload('whisper')).toBe(true)
})

test('Instantiates OpenAI by default', async () => {
  store.config.stt.engine = 'openai'
  const engine = getSTTEngine(store.config)
  expect(engine).toBeDefined()
  expect(engine).toBeInstanceOf(STTOpenAI)
  expect(engine).toHaveProperty('transcribe')
  expect(engine.isReady()).toBe(true)
  expect(engine.requiresDownload()).toBe(false)
  await engine.initialize(initCallback)
  expect(initCallback).toHaveBeenLastCalledWith({ task: 'openai', status: 'ready', model: expect.any(String) })
  await expect(engine.transcribe(new Blob())).resolves.toStrictEqual({ text: 'transcribed' })
})

test('Instantiates Groq', async () => {
  store.config.stt.engine = 'groq'
  const engine = getSTTEngine(store.config)
  expect(engine).toBeDefined()
  expect(engine).toBeInstanceOf(STTGroq)
  expect(engine).toHaveProperty('transcribe')
  expect(engine.isReady()).toBe(true)
  expect(engine.requiresDownload()).toBe(false)
  await engine.initialize(initCallback)
  expect(initCallback).toHaveBeenLastCalledWith({ task: 'groq', status: 'ready', model: expect.any(String) })
  await expect(engine.transcribe(new Blob())).resolves.toStrictEqual({ text: 'transcribed' })
})

test('Instantiates fal.ai', async () => {
  store.config.stt.engine = 'falai'
  const engine = getSTTEngine(store.config)
  expect(engine).toBeDefined()
  expect(engine).toBeInstanceOf(STTFalAi)
  expect(engine).toHaveProperty('transcribe')
  expect(engine.isReady()).toBe(true)
  expect(engine.requiresDownload()).toBe(false)
  await engine.initialize(initCallback)
  expect(initCallback).toHaveBeenLastCalledWith({ task: 'fal.ai', status: 'ready', model: expect.any(String) })
  await expect(engine.transcribe(new Blob())).resolves.toStrictEqual({ text: 'transcribed' })
  expect(fal.config).toHaveBeenCalledWith({ credentials: 'falai-api-key'  })
})

test('Instantiates Whisper', async () => {
  store.config.stt.engine = 'whisper'
  const engine = getSTTEngine(store.config)
  expect(engine).toBeDefined()
  expect(engine).toBeInstanceOf(STTWhisper)
  expect(engine).toHaveProperty('transcribe')
  expect(engine.isReady()).toBe(false)
  expect(engine.requiresDownload()).toBe(true)
  await engine.initialize(initCallback)
  expect(initCallback).toHaveBeenLastCalledWith(expect.objectContaining({ task:'automatic-speech-recognition', status: 'initiate', model: expect.any(String) }))
  await expect(engine.transcribe(new Blob())).resolves.toStrictEqual({ text: 'transcribed' })
})

test('Instantiates Gladia', async () => {
  store.config.stt.engine = 'gladia'
  const engine = getSTTEngine(store.config)
  expect(engine).toBeDefined()
  expect(engine).toBeInstanceOf(STTGladia)
  expect(engine).toHaveProperty('transcribe')
  expect(engine.isReady()).toBe(true)
  expect(engine.requiresDownload()).toBe(false)
  await engine.initialize(initCallback)
  expect(initCallback).toHaveBeenLastCalledWith({ task: 'gladia', status: 'ready', model: expect.any(String) })
  await expect(engine.transcribe({
    type: 'audio/wav',
    // @ts-expect-error mocking
    arrayBuffer: async () => ([])
  })).resolves.toStrictEqual({ text: 'transcribed' })
})

test('Instantiates HuggingFace', async () => {
  store.config.stt.engine = 'huggingface'
  const engine = getSTTEngine(store.config)
  expect(engine).toBeDefined()
  expect(engine).toBeInstanceOf(STTHuggingFace)
  expect(engine).toHaveProperty('transcribe')
  expect(engine.isReady()).toBe(true)
  expect(engine.requiresDownload()).toBe(false)
  await engine.initialize(initCallback)
  expect(initCallback).toHaveBeenLastCalledWith({ task: 'huggingface', status: 'ready', model: expect.any(String) })
  await expect(engine.transcribe(new Blob())).resolves.toStrictEqual({ text: 'transcribed' })

})

test('Instantiates nVidia', async () => {
  store.config.stt.engine = 'nvidia'
  const engine = getSTTEngine(store.config)
  expect(engine).toBeDefined()
  expect(engine).toBeInstanceOf(STTNvidia)
  expect(engine).toHaveProperty('transcribe')
  expect(engine.isReady()).toBe(true)
  expect(engine.requiresDownload()).toBe(false)
  await engine.initialize(initCallback)
  expect(initCallback).toHaveBeenLastCalledWith({ task: 'nvidia', status: 'ready', model: expect.any(String) })
  await expect(engine.transcribe(new Blob())).resolves.toStrictEqual({ text: 'transcribed' })
})

test('Throws error on unknown engine', async () => {
  store.config.stt.engine = 'unknown'
  expect(() => getSTTEngine(store.config)).toThrowError('Unknown STT engine unknown')
})
