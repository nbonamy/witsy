
import { vi, beforeEach, expect, test } from 'vitest'
import { isEngineReady, igniteEngine, hasVisionModels, isVisionModel, loadOpenAIModels } from '../../src/services/llm'
import { store } from '../../src/services/store'
import defaults from '../../defaults/settings.json'
import Message from '../../src/models/message'
import Attachment from '../../src/models/attachment'
import OpenAI from '../../src/services/openai'
import Ollama from '../../src/services/ollama'
import MistralAI from '../../src/services/mistralai'
import Anthropic from '../../src/services/anthropic'
import Google from '../../src/services/google'
import Groq from '../../src/services/groq'
import { Model } from '../../src/types/config.d'

const model = [{ id: 'llava:latest', name: 'llava:latest', meta: {} }]

vi.mock('openai', async() => {
  const OpenAI = vi.fn()
  OpenAI.prototype.apiKey = '123'
  OpenAI.prototype.models = {
    list: vi.fn(() => {
      return { data: [
        { id: 'gpt-model2', name: 'model2' },
        { id: 'gpt-model1', name: 'model1' },
        { id: 'dall-e-model2', name: 'model2' },
        { id: 'dall-e-model1', name: 'model1' },
      ] }
    })
  }
  return { default: OpenAI }
})

window.api = {
  base64: {
    decode: (data: string) => data
  },
  file: {
    extractText: (contents) => contents
  }
}

beforeEach(() => {
  store.config = defaults
})

test('Default Configuration', () => {
  expect(isEngineReady('openai')).toBe(true)
  expect(isEngineReady('ollama')).toBe(false)
  expect(isEngineReady('mistralai')).toBe(false)
  expect(isEngineReady('anthropic')).toBe(false)
  expect(isEngineReady('google')).toBe(false)
  expect(isEngineReady('groq')).toBe(false)
  expect(isEngineReady('aws')).toBe(false)
})

test('OpenAI Configuration', () => {
  expect(isEngineReady('openai')).toBe(true)
  store.config.engines.openai.apiKey = '123'
  expect(isEngineReady('openai')).toBe(true)
  store.config.engines.openai.models.chat = [model]
  expect(isEngineReady('openai')).toBe(true)
})

test('Ollaama Configuration', () => {
  store.config.engines.ollama.models.image = [model]
  expect(isEngineReady('ollama')).toBe(false)
  store.config.engines.ollama.models.chat = [model]
  expect(isEngineReady('ollama')).toBe(true)
})

test('MistralAI Configuration', () => {
  store.config.engines.mistralai.apiKey = '123'
  expect(isEngineReady('mistralai')).toBe(false)
  store.config.engines.mistralai.models.image = [model]
  expect(isEngineReady('mistralai')).toBe(false)
  store.config.engines.mistralai.models.chat = [model]
  expect(isEngineReady('mistralai')).toBe(true)
})

test('Anthropic Configuration', () => {
  store.config.engines.anthropic.models.image = [model]
  expect(isEngineReady('anthropic')).toBe(false)
  store.config.engines.anthropic.models.chat = [model]
  expect(isEngineReady('anthropic')).toBe(false)
  store.config.engines.anthropic.apiKey = '123'
  expect(isEngineReady('anthropic')).toBe(true)
})

test('Google Configuration', () => {
  store.config.engines.google.models.image = [model]
  expect(isEngineReady('google')).toBe(false)
  store.config.engines.google.models.chat = [model]
  expect(isEngineReady('google')).toBe(false)
  store.config.engines.google.apiKey = '123'
  expect(isEngineReady('google')).toBe(true)
})

test('Groq Configuration', () => {
  store.config.engines.groq.models.image = [model]
  expect(isEngineReady('groq')).toBe(false)
  store.config.engines.groq.models.chat = [model]
  expect(isEngineReady('groq')).toBe(false)
  store.config.engines.groq.apiKey = '123'
  expect(isEngineReady('groq')).toBe(true)
})

test('Ignite Engine', async () => {
  expect(await igniteEngine('openai', store.config)).toBeInstanceOf(OpenAI)
  expect(await igniteEngine('ollama', store.config)).toBeInstanceOf(Ollama)
  expect(await igniteEngine('mistralai', store.config)).toBeInstanceOf(MistralAI)
  expect(await igniteEngine('anthropic', store.config)).toBeInstanceOf(Anthropic)
  expect(await igniteEngine('google', store.config)).toBeInstanceOf(Google)
  expect(await igniteEngine('groq', store.config)).toBeInstanceOf(Groq)
  expect(await igniteEngine('aws', store.config)).toBeInstanceOf(OpenAI)
  expect(await igniteEngine('aws', store.config, 'aws')).toBeNull()
})

test('Has Vision Models', async () => {
  expect(hasVisionModels('openai')).toBe(true)
  expect(hasVisionModels('anthropic')).toBe(false)
})

test('Is Vision Model', async () => {
  expect(isVisionModel('openai', 'gpt-3.5')).toBe(false)
  expect(isVisionModel('openai', 'gpt-4-turbo')).toBe(true)
  expect(isVisionModel('openai', 'gpt-vision')).toBe(true)
})

test('Get Chat Models', async () => {
  await loadOpenAIModels()
  const openai = new OpenAI(store.config)
  expect(openai.getChatModel()).toBe('gpt-model1')
  expect(openai.getChatModels().map((m: Model) => { return { id: m.id, name: m.name }})).toStrictEqual([
    { id: 'gpt-model1', name: 'gpt-model1' },
    { id: 'gpt-model2', name: 'gpt-model2' },
  ])
})

test('Find Models', async () => {
  const models = [
    { id: 'gpt-model1', name: 'gpt-model1', meta: {} },
    { id: 'gpt-model2', name: 'gpt-model2', meta: {} },
  ]
  const openai = new OpenAI(store.config)
  expect(openai.findModel(models, ['gpt-model'])).toBeNull()
  expect(openai.findModel(models, ['gpt-vision*'])).toBeNull()
  expect(openai.findModel(models, ['*']).id).toBe('gpt-model1')
  expect(openai.findModel(models, ['gpt-model2']).id).toBe('gpt-model2')
  expect(openai.findModel(models, ['gpt-model*']).id).toBe('gpt-model1')
  expect(openai.findModel(models, ['gpt-vision', '*gpt*2*']).id).toBe('gpt-model2')
})

test('Build payload no attachment', async () => {
  const openai = new OpenAI(store.config)
  expect(openai.buildPayload([], 'gpt-model1')).toStrictEqual([]) 
  expect(openai.buildPayload('content', 'gpt-model1')).toStrictEqual([{ role: 'user', content: 'content' }])
  expect(openai.buildPayload([
    new Message('system', { role: 'system', type: 'text', content: 'instructions' }),
    new Message('user', { role: 'user', type: 'text', content: 'prompt1' }),
    new Message('assistant', { role: 'assistant', type: 'image', content: 'response1' }), 
    new Message('user', { role: 'user', type: 'text', content: 'prompt2' }),
    new Message('assistant', { role: 'assistant', type: 'text', content: 'response2' }), 
  ], 'gpt-model1')).toStrictEqual([
    { role: 'system', content: 'instructions' },
    { role: 'user', content: 'prompt1' },
    { role: 'user', content: 'prompt2' },
    { role: 'assistant', content: 'response2'}
  ])
})

test('Build payload with text attachment', async () => {
  const openai = new OpenAI(store.config)
  const messages = [
    new Message('system', { role: 'system', type: 'text', content: 'instructions' }),
    new Message('user', { role: 'user', type: 'text', content: 'prompt1' }),
  ]
  messages[1].attachFile(new Attachment('', 'txt', 'attachment', true))
  expect(openai.buildPayload(messages, 'gpt-model1')).toStrictEqual([
    { role: 'system', content: 'instructions' },
    { role: 'user', content: 'prompt1\n\nattachment' },
  ])
})

test('Build payload with image attachment', async () => {
  const openai = new OpenAI(store.config)
  const messages = [
    new Message('system', { role: 'system', type: 'text', content: 'instructions' }),
    new Message('user', { role: 'user', type: 'text', content: 'prompt1' }),
  ]
  messages[1].attachFile(new Attachment('', 'png', 'attachment', true))
  expect(openai.buildPayload(messages, 'gpt-model1')).toStrictEqual([
    { role: 'system', content: 'instructions' },
    { role: 'user', content: 'prompt1' },
  ])
  expect(openai.buildPayload(messages, 'gpt-4-vision')).toStrictEqual([
    { role: 'system', content: 'instructions' },
    { role: 'user', content: [
      { type: 'text', text: 'prompt1' },
      { 'type': 'image_url', 'image_url': { 'url': 'data:image/jpeg;base64,attachment' } },
    ]},
  ])
})
