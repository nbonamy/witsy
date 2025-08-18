import { vi, beforeAll, beforeEach, expect, test } from 'vitest'
import { store } from '../../src/services/store'
import defaults from '../../defaults/settings.json'
import { getSTTEngine, requiresDownload } from '../../src/voice/stt'
import STTFalAi from '../../src/voice/stt-falai'
import STTFireworks from '../../src/voice/stt-fireworks'
import STTGladia from '../../src/voice/stt-gladia'
import STTGroq from '../../src/voice/stt-groq'
import STTHuggingFace from '../../src/voice/stt-huggingface'
import STTMistral from '../../src/voice/stt-mistral'
import STTNvidia from '../../src/voice/stt-nvidia'
import STTOpenAI from '../../src/voice/stt-openai'
import STTSpeechmatics from '../../src/voice/stt-speechmatics'
import STTWhisper from '../../src/voice/stt-whisper'
import STTSoniox from '../../src/voice/stt-soniox'
import { fal } from '@fal-ai/client'
import { Configuration } from '../../src/types/config'

const initCallback = vi.fn()

// for an unknown reason, we cannot really mock those
// if we use vi.fn instead of direct implementation
// tests will fail. therefore we cannot test
// that api methods are indeed called correctly
// which poses the question: what are we really testing here?

// @ts-expect-error mocking: support (url, init)
global.fetch = vi.fn(async (url: string | Request, init?: any) => {
  if (typeof url !== 'string') url = url.url // handle Request object

  // 1) Direct transcription endpoint
  if (url.includes('/v1/audio/transcriptions')) {
    return {
      ok: true,
      status: 200,
      statusText: 'OK',
      json: async () => ({ text: 'mock-transcription' }),
      text: async () => ''
    }
  }

  // 2) File upload (chat-completion path)
  if (url.includes('/v1/files') && init?.method === 'POST') {
    return {
      ok: true,
      status: 200,
      statusText: 'OK',
      json: async () => ({ id: 'mock-file-id' }),
      text: async () => ''
    }
  }
  // 3) Signed URL fetch
  if (url.includes('/v1/files/') && url.includes('/url')) {
    return {
      ok: true,
      status: 200,
      statusText: 'OK',
      json: async () => ({ url: 'https://mock-signed-url' }),
      text: async () => ''
    }
  }
  // 4) Chat completion
  if (url.includes('/v1/chat/completions')) {
    return {
      ok: true,
      status: 200,
      statusText: 'OK',
      json: async () => ({ choices: [{ message: { content: 'mock-completion' } }] }),
      text: async () => ''
    }
  }

  if (url.includes('gladia') && url.includes('upload')) {
    return {
      json: () => ({
        audio_url: 'https://api.gladia.io/v2/upload/1234567890',
      })
    }
  }
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

  // Soniox file upload
  if (url.includes('api.soniox.com/v1/files') && init?.method === 'POST') {
    return {
      ok: true,
      status: 200,
      json: async () => ({ id: 'mock-soniox-file-id' }),
      text: async () => ''
    }
  }

  // Soniox transcription creation  
  if (url.includes('api.soniox.com/v1/transcriptions') && init?.method === 'POST') {
    return {
      ok: true,
      status: 200,
      json: async () => ({ transcription_id: 'mock-soniox-transcription-id' }),
      text: async () => ''
    }
  }

  // Soniox status check
  if (url.includes('api.soniox.com/v1/transcriptions/mock-soniox-transcription-id') && !url.includes('transcript')) {
    return {
      ok: true,
      status: 200,
      json: async () => ({ status: 'completed' }),
      text: async () => ''
    }
  }

  // Soniox transcript retrieval
  if (url.includes('api.soniox.com/v1/transcriptions/mock-soniox-transcription-id/transcript')) {
    return {
      ok: true,
      status: 200,
      json: async () => ({ text: 'transcribed' }),
      text: async () => ''
    }
  }

  // Default fallback for unmatched requests
  return {
    ok: false,
    status: 404,
    statusText: 'Not Found',
    json: async () => ({}),
    text: async () => ''
  }
})

vi.mock('openai', async () => {
  const OpenAI = vi.fn((opts: any) => {
    OpenAI.prototype.apiKey = opts.apiKey
    OpenAI.prototype.baseURL = opts.baseURL
  })
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


beforeAll(() => {
  window.AudioContext = vi.fn()
  // @ts-expect-error mocking
  window.AudioContext.prototype.decodeAudioData = () => {
    return { getChannelData: () => {} }
  }
})

beforeEach(() => {
  store.config = defaults as unknown as Configuration
  store.config.engines.falai.apiKey = 'falai-api-key'
  vi.resetAllMocks()
})

test('Requires download', () => {
  expect(requiresDownload('openai')).toBe(false)
  expect(requiresDownload('groq')).toBe(false)
  expect(requiresDownload('soniox')).toBe(false)
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

test('Instantiates Mistral Transcription', async () => {
  store.config.stt.engine = 'mistralai'
  store.config.stt.model = 'voxtral-mini-latest-transcribe' // explicit chat-completion model
  store.config.engines.mistralai = {
    apiKey: 'dummy-mistral-key',
    models: { chat: [] },      // minimal valid ModelsConfig
    model: { chat: '' }        // minimal valid ModelConfig
  }
  const engine = getSTTEngine(store.config)
  expect(engine).toBeDefined()
  expect(engine).toBeInstanceOf(STTMistral)
  expect(engine).toHaveProperty('transcribe')
  expect(engine.isReady()).toBe(true)
  expect(engine.requiresDownload()).toBe(false)
  await engine.initialize(initCallback)
  expect(initCallback).toHaveBeenLastCalledWith({ task: 'mistralai', status: 'ready', model: expect.any(String) })
  await expect(engine.transcribe(new Blob())).resolves.toStrictEqual({ text: 'mock-transcription' })
})

test('Instantiates Mistral Completion', async () => {
  store.config.stt.engine = 'mistralai'
  store.config.stt.model = 'voxtral-mini-latest'
  const engine = getSTTEngine(store.config)
  expect(engine).toBeDefined()
  expect(engine).toBeInstanceOf(STTMistral)
  await engine.initialize(initCallback)
  expect(initCallback).toHaveBeenLastCalledWith({ task: 'mistralai', status: 'ready', model: expect.any(String) })
  // @ts-expect-error mocking
  await expect(engine.transcribe({ type: 'audio/wav', arrayBuffer: async () => ([]) })).resolves.toStrictEqual({ text: 'mock-completion' })
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
  await expect(engine.transcribe(new Blob(['mock audio data'], { type: 'audio/webm' }))).resolves.toStrictEqual({ text: 'transcribed' })
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
  await expect(engine.transcribe(new Blob())).resolves.toStrictEqual({ text: 'mock-completion' })
})


test('Instantiates Fireworks', async () => {
  store.config.stt.engine = 'fireworks'
  const engine = getSTTEngine(store.config)
  expect(engine).toBeDefined()
  expect(engine).toBeInstanceOf(STTFireworks)
  expect(engine.isStreamingModel('realtime')).toBe(true)
  expect(engine.requiresPcm16bits!.call('realtime')).toBe(true)
  expect(engine).toHaveProperty('startStreaming')
  expect(engine).toHaveProperty('sendAudioChunk')
  expect(engine).toHaveProperty('endStreaming')
  expect(engine.isReady()).toBe(true)
  expect(engine.requiresDownload()).toBe(false)
  await engine.initialize(initCallback)
  expect(initCallback).toHaveBeenLastCalledWith({ task: 'fireworks', status: 'ready', model: expect.any(String) })
  await expect(engine.transcribe(new Blob())).rejects.toThrowError()
})

test('Instantiates Speechmatics', async () => {
  store.config.stt.engine = 'speechmatics'
  const engine = getSTTEngine(store.config)
  expect(engine).toBeDefined()
  expect(engine).toBeInstanceOf(STTSpeechmatics)
  expect(engine.isStreamingModel('realtime')).toBe(true)
  expect(engine.requiresPcm16bits!.call('realtime')).toBe(false)
  expect(engine).toHaveProperty('startStreaming')
  expect(engine).toHaveProperty('sendAudioChunk')
  expect(engine).toHaveProperty('endStreaming')
  expect(engine.isReady()).toBe(true)
  expect(engine.requiresDownload()).toBe(false)
  await engine.initialize(initCallback)
  expect(initCallback).toHaveBeenLastCalledWith({ task: 'speechmatics', status: 'ready', model: expect.any(String) })
  await expect(engine.transcribe(new Blob())).rejects.toThrowError()
})

test('Instantiates Custom OpenAI', async () => {
  store.config.stt.engine = 'custom'
  store.config.stt.model = 'custom-model'
  store.config.stt.customOpenAI.baseURL = 'https://api.custom.com/v1'
  const engine = getSTTEngine(store.config)
  expect(engine).toBeDefined()
  expect(engine).toBeInstanceOf(STTOpenAI)
  expect(engine).toHaveProperty('transcribe')
  expect(engine.isReady()).toBe(true)
  expect(engine.requiresDownload()).toBe(false)
  expect((engine as STTOpenAI).client.baseURL).toBe('https://api.custom.com/v1')
  await engine.initialize(initCallback)
  expect(initCallback).toHaveBeenLastCalledWith({ task: 'openai', status: 'ready', model: expect.any(String) })
  await expect(engine.transcribe(new Blob())).resolves.toStrictEqual({ text: 'transcribed' })
})

test('Instantiates Soniox', async () => {
  store.config.stt.engine = 'soniox'
  store.config.engines.soniox = {
    apiKey: 'test-soniox-key',
    models: { chat: [] },
    model: { chat: '' }
  }
  
  const engine = getSTTEngine(store.config)
  expect(engine).toBeDefined()
  expect(engine).toBeInstanceOf(STTSoniox)
  expect(engine).toHaveProperty('transcribe')
  expect(engine).toHaveProperty('transcribeFile')
  expect(engine.isReady()).toBe(true)
  expect(engine.requiresDownload()).toBe(false)
  expect(engine.isStreamingModel('realtime-transcription')).toBe(true)
  expect(engine.requiresPcm16bits('realtime-transcription')).toBe(true)
  await engine.initialize(initCallback)
  expect(initCallback).toHaveBeenLastCalledWith({ task: 'soniox', status: 'ready', model: expect.any(String) })
})

test('Throws error on unknown engine', async () => {
  store.config.stt.engine = 'unknown'
  expect(() => getSTTEngine(store.config)).toThrowError('Unknown STT engine unknown')
})
