
import { LLmCompletionPayload } from '../../src/types/llm.d'
import { vi, beforeEach, expect, test } from 'vitest'
import { store } from '../../src/services/store'
import defaults from '../../defaults/settings.json'
import Message from '../../src/models/message'
import Attachment from '../../src/models/attachment'
import MistralAI from '../../src/services/mistralai'
import { Mistral } from '@mistralai/mistralai'
import { CompletionEvent } from '@mistralai/mistralai/models/components'
import { loadMistralAIModels } from '../../src/services/llm'
import { Model } from '../../src/types/config.d'

window.api = {
  config: {
    save: vi.fn()
  },
  file: {
    extractText: (contents) => contents
  }
}

vi.mock('@mistralai/mistralai', async() => {
  const Mistral = vi.fn()
  Mistral.prototype.options$ = {
    apiKey: '123'
  }
  Mistral.prototype.models = {
    list: vi.fn(() => {
      return { data: [
        { id: 'model2', name: 'model2' },
        { id: 'model1', name: 'model1' },
      ] }
    })
  }
  Mistral.prototype.chat = {
    complete: vi.fn(() => {
      return { choices: [ { message: { content: 'response' } } ] }
    }),
    stream: vi.fn(() => {
      return {
        controller: {
          abort: vi.fn()
        }
      }
    })
  }
  return { Mistral }
})

beforeEach(() => {
  store.config = defaults
  store.config.engines.mistralai.apiKey = '123'
})

test('MistralAI Load Models', async () => {
  expect(await loadMistralAIModels()).toBe(true)
  const models = store.config.engines.mistralai.models.chat
  expect(models.map((m: Model) => { return { id: m.id, name: m.name }})).toStrictEqual([
    { id: 'model1', name: 'model1' },
    { id: 'model2', name: 'model2' },
  ])
  expect(store.config.engines.mistralai.model.chat).toStrictEqual(models[0].id)
})

test('MistralAI Basic', async () => {
  const mistralai = new MistralAI(store.config)
  expect(mistralai.getName()).toBe('mistralai')
  expect(mistralai.isVisionModel('mistral-medium')).toBe(false)
  expect(mistralai.isVisionModel('mistral-large')).toBe(false)
})

test('MistralAI  completion', async () => {
  const mistralai = new MistralAI(store.config)
  const response = await mistralai.complete([
    new Message('system', 'instruction'),
    new Message('user', 'prompt'),
  ], null)
  expect(Mistral.prototype.chat.complete).toHaveBeenCalled()
  expect(response).toStrictEqual({
    type: 'text',
    content: 'response'
  })
})

test('MistralAI  stream', async () => {
  const mistralai = new MistralAI(store.config)
  const response = await mistralai.stream([
    new Message('system', 'instruction'),
    new Message('user', 'prompt'),
  ], null)
  expect(Mistral.prototype.chat.stream).toHaveBeenCalled()
  expect(response.controller).toBeDefined()
  await mistralai.stop()
  //expect(Mistral.prototype.abort).toHaveBeenCalled()
})

test('MistralAI  image', async () => {
  const mistralai = new MistralAI(store.config)
  const response = await mistralai.image('image', null)
  expect(response).toBeNull()
})

test('MistralAI addImageToPayload', async () => {
  const mistralai = new MistralAI(store.config)
  const message = new Message('user', 'text')
  message.attachFile(new Attachment('', 'image/png', 'image', true ))
  const payload: LLmCompletionPayload = { role: 'user', content: message }
  mistralai.addImageToPayload(message, payload)
  expect(payload.images).toStrictEqual([ 'image' ])
})

test('MistralAI streamChunkToLlmChunk Text', async () => {
  const mistralai = new MistralAI(store.config)
  const streamChunk: CompletionEvent = { data: {
    id: '1', model: '',
    choices: [{
      index: 0, delta: { content: 'response' }, finishReason: null
    }],
  }}
  const llmChunk1 = await mistralai.streamChunkToLlmChunk(streamChunk, null)
  expect(llmChunk1).toStrictEqual({ text: 'response', done: false })
  streamChunk.data.choices[0].finishReason = 'stop'
  const llmChunk2 = await mistralai.streamChunkToLlmChunk(streamChunk, null)
  expect(llmChunk2).toStrictEqual({ text: 'response', done: true })
})
