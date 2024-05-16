
import { LLmCompletionPayload } from '../../src/types/llm.d'
import { vi, beforeEach, expect, test } from 'vitest'
import { store } from '../../src/services/store'
import defaults from '../../defaults/settings.json'
import Message from '../../src/models/message'
import OpenAI from '../../src/services/openai'
import * as _OpenAI from 'openai'
import { ChatCompletionChunk } from 'openai/resources'
import { loadOpenAIModels } from '../../src/services/llm'
import { Model } from '../../src/types/config.d'

vi.mock('openai', async () => {
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
  OpenAI.prototype.chat = {
    completions: {
      create: vi.fn((opts) => {
        if (opts.stream) {
          return {
            controller: {
              abort: vi.fn()
            }
          }
        }
        else {
          return { choices: [{ message: { content: 'response' } }] }
        }
      })
    }
  }
  OpenAI.prototype.images = {
    generate: vi.fn(() => {
      return {
        data: [{ revised_prompt: 'revised_prompt', url: 'url', b64_json: 'b64_json' }]
      }
    })
  }
  return { default : OpenAI }
})

beforeEach(() => {
  store.config = defaults
  store.config.engines.openai.apiKey = '123'
})

test('OpenAI Load Chat Models', async () => {
  expect(await loadOpenAIModels()).toBe(true)
  const models = store.config.engines.openai.models.chat
  expect(_OpenAI.default.prototype.models.list).toHaveBeenCalled()
  expect(models.map((m: Model) => { return { id: m.id, name: m.name }})).toStrictEqual([
    { id: 'gpt-model1', name: 'gpt-model1' },
    { id: 'gpt-model2', name: 'gpt-model2' },
  ])
  expect(store.config.engines.openai.model.chat).toStrictEqual(models[0].id)
})

test('OpenAI Load Image Models', async () => {
  expect(await loadOpenAIModels()).toBe(true)
  const models = store.config.engines.openai.models.image
  expect(_OpenAI.default.prototype.models.list).toHaveBeenCalled()
  expect(models.map((m: Model) => { return { id: m.id, name: m.name }})).toStrictEqual([
    { id: 'dall-e-model1', name: 'dall-e-model1' },
    { id: 'dall-e-model2', name: 'dall-e-model2' },
  ])
  expect(store.config.engines.openai.model.image).toStrictEqual(models[0].id)
})

test('OpenAI Basic', async () => {
  const openAI = new OpenAI(store.config)
  expect(openAI.getName()).toBe('openai')
  expect(openAI.isVisionModel('gpt-3.5')).toBe(false)
  expect(openAI.isVisionModel('gpt-3.5-turbo')).toBe(false)
  expect(openAI.isVisionModel('gpt-4')).toBe(false)
  expect(openAI.isVisionModel('gpt-4-turbo')).toBe(true)
  expect(openAI.isVisionModel('gpt-4-vision')).toBe(true)
  expect(openAI.isVisionModel('gpt-4-vision-preview')).toBe(true)
  expect(openAI.getRountingModel()).toMatch(/3.5/)
})

test('OpenAI completion', async () => {
  const openAI = new OpenAI(store.config)
  const response = await openAI.complete([
    new Message('system', 'instruction'),
    new Message('user', 'prompt'),
  ], null)
  expect(_OpenAI.default.prototype.chat.completions.create).toHaveBeenCalled()
  expect(response).toStrictEqual({
    type: 'text',
    content: 'response'
  })
})

test('OpenAI stream', async () => {
  const openAI = new OpenAI(store.config)
  const response = await openAI.stream([
    new Message('system', 'instruction'),
    new Message('user', 'prompt'),
  ], null)
  expect(_OpenAI.default.prototype.chat.completions.create).toHaveBeenCalled()
  expect(response.controller).toBeDefined()
  await openAI.stop(response)
  expect(response.controller.abort).toHaveBeenCalled()
})

test('OpenAI image', async () => {
  const openAI = new OpenAI(store.config)
  const response = await openAI.image('image', null)
  expect(_OpenAI.default.prototype.images.generate).toHaveBeenCalled()
  expect(response).toStrictEqual({
    content: 'b64_json',
    original_prompt: 'image',
    revised_prompt: 'revised_prompt',
    type: 'image',
    url: 'url',
  })
})

test('OpenAI addImageToPayload', async () => {
  const openAI = new OpenAI(store.config)
  const message = new Message('user', 'text')
  message.attachFile({ url: '', format:'png', contents: 'image', downloaded: true })
  const payload: LLmCompletionPayload = { role: 'user', content: message }
  openAI.addImageToPayload(message, payload)
  expect(payload.content).toStrictEqual([
    { type: 'text', text: 'text' },
    { type: 'image_url', image_url: { url: 'data:image/jpeg;base64,image' } }
  ])
})

test('OpenAI streamChunkToLlmChunk Text', async () => {
  const openAI = new OpenAI(store.config)
  const streamChunk: ChatCompletionChunk = {
    id: 'id',
    created: 1,
    model: 'model',
    object: 'chat.completion.chunk',
    choices: [{ index: 0, delta: { content: 'response' }, finish_reason: null }],
  }
  const llmChunk1 = await openAI.streamChunkToLlmChunk(streamChunk, null)
  expect(llmChunk1).toStrictEqual({ text: 'response', done: false })
  streamChunk.choices[0].delta.content = null
  streamChunk.choices[0].finish_reason = 'stop'
  const llmChunk2 = await openAI.streamChunkToLlmChunk(streamChunk, null)
  expect(llmChunk2).toStrictEqual({ text: '', done: true })
})
