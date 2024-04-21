
import { LLmCompletionPayload } from '../../src/types/llm.d'
import { vi, beforeEach, expect, test } from 'vitest'
import { store } from '../../src/services/store'
import defaults from '../../defaults/settings.json'
import Message from '../../src/models/message'
import MistralAI from '../../src/services/mistralai'
import MistralClient from '../../src/vendor/mistralai'

vi.mock('../../src/vendor/mistralai', async() => {
  const MistralClient = vi.fn()
  MistralClient.prototype.apiKey = '123'
  MistralClient.prototype.listModels = vi.fn(() => {
    return { data: [{ id: 'model', name: 'model' }] }
  })
  MistralClient.prototype.chat = vi.fn(() => {
    return { choices: [ { message: { content: 'response' } } ] }
  })
  MistralClient.prototype.chatStream = vi.fn(() => {
    return {
      controller: {
        abort: vi.fn()
      }
    }
  })
  return { default : MistralClient }
})

beforeEach(() => {
  store.config = defaults
  store.config.engines.mistralai.apiKey = '123'
})

test('MistralAI Basic', async () => {
  const mistralai = new MistralAI(store.config)
  expect(mistralai.getName()).toBe('mistralai')
  expect(await mistralai.getModels()).toStrictEqual([{ id: 'model', name: 'model' }])
  expect(mistralai.isVisionModel('mistral-medium')).toBe(false)
  expect(mistralai.isVisionModel('mistral-large')).toBe(false)
  expect(mistralai.getRountingModel()).toBeNull()
})

test('MistralAI  completion', async () => {
  const mistralai = new MistralAI(store.config)
  const response = await mistralai.complete([
    new Message('system', 'instruction'),
    new Message('user', 'prompt'),
  ], null)
  expect(MistralClient.prototype.chat).toHaveBeenCalled()
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
  expect(MistralClient.prototype.chat).toHaveBeenCalled()
  expect(response.controller).toBeDefined()
  await mistralai.stop()
  //expect(MistralClient.prototype.abort).toHaveBeenCalled()
})

test('MistralAI  image', async () => {
  const mistralai = new MistralAI(store.config)
  const response = await mistralai.image('image', null)
  expect(response).toBeNull()
})

test('MistralAI addImageToPayload', async () => {
  const mistralai = new MistralAI(store.config)
  const message = new Message('user', 'text')
  message.attachFile({ type: 'image', url: '', format:'png', contents: 'image', downloaded: true })
  const payload: LLmCompletionPayload = { role: 'user', content: message }
  mistralai.addImageToPayload(message, payload)
  expect(payload.images).toStrictEqual([ 'image' ])
})

test('MistralAI streamChunkToLlmChunk Text', async () => {
  const mistralai = new MistralAI(store.config)
  const streamChunk = {
    choices: [{ index: 0, delta: { content: 'response' }, finish_reason: null as string }],
  }
  const llmChunk1 = await mistralai.streamChunkToLlmChunk(streamChunk, null)
  expect(llmChunk1).toStrictEqual({ text: 'response', done: false })
  streamChunk.choices[0].finish_reason = 'stop'
  const llmChunk2 = await mistralai.streamChunkToLlmChunk(streamChunk, null)
  expect(llmChunk2).toStrictEqual({ text: 'response', done: true })
})
