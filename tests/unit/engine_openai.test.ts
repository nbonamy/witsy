
import { LLmCompletionPayload, LlmChunk } from '../../src/types/llm.d'
import { vi, beforeEach, expect, test } from 'vitest'
import { Plugin1, Plugin2, Plugin3 } from '../mocks/plugins'
import { store } from '../../src/services/store'
import defaults from '../../defaults/settings.json'
import Message from '../../src/models/message'
import Attachment from '../../src/models/attachment'
import OpenAI from '../../src/services/openai'
import * as _OpenAI from 'openai'
import { ChatCompletionChunk } from 'openai/resources'
import { loadOpenAIModels } from '../../src/services/llm'
import { Model } from '../../src/types/config.d'

window.api = {
  config: {
    save: vi.fn()
  },
  file: {
    extractText: (contents) => contents
  }
}

Plugin2.prototype.execute = vi.fn((parameters: any): Promise<string> => Promise.resolve('result2'))

vi.mock('../../src/plugins/plugins', async () => {
  return {
    availablePlugins: {
      plugin1: Plugin1,
      plugin2: Plugin2,
      plugin3: Plugin3,
    }
  }
})

vi.mock('openai', async () => {
  const OpenAI = vi.fn((opts: _OpenAI.ClientOptions) => {
    OpenAI.prototype.apiKey = opts.apiKey
    OpenAI.prototype.baseURL = opts.baseURL
  })
  OpenAI.prototype.models = {
    list: vi.fn(() => {
      return {
        data: [
          { id: 'gpt-model2', name: 'model2' },
          { id: 'gpt-model1', name: 'model1' },
          { id: 'dall-e-model2', name: 'model2' },
          { id: 'dall-e-model1', name: 'model1' },
        ]
      }
    })
  }
  OpenAI.prototype.chat = {
    completions: {
      create: vi.fn((opts) => {
        if (opts.stream) {
          return {
            async * [Symbol.asyncIterator]() {
              
              // first we yield tool call chunks
              yield { choices: [{ delta: { tool_calls: [ { id: 1, function: { name: 'plugin2', arguments: '[ "ar' }} ] }, finish_reason: 'none' } ] }
              yield { choices: [{ delta: { tool_calls: [ { function: { arguments: [ 'g" ]' ] } }] }, finish_reason: 'none' } ] }
              yield { choices: [{ finish_reason: 'tool_calls' } ] }
              
              // now the text response
              const content = 'response'
              for (let i = 0; i < content.length; i++) {
                yield { choices: [{ delta: { content: content[i], finish_reason: 'none' } }] }
              }
              yield { choices: [{ delta: { content: '', finish_reason: 'done' } }] }
            },
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
  return { default: OpenAI }
})

beforeEach(() => {
  store.config = defaults
  store.config.engines.openai.apiKey = '123'
})

test('OpenAI Load Chat Models', async () => {
  expect(await loadOpenAIModels()).toBe(true)
  const models = store.config.engines.openai.models.chat
  expect(_OpenAI.default.prototype.models.list).toHaveBeenCalled()
  expect(models.map((m: Model) => { return { id: m.id, name: m.name } })).toStrictEqual([
    { id: 'gpt-model1', name: 'gpt-model1' },
    { id: 'gpt-model2', name: 'gpt-model2' },
  ])
  expect(store.config.engines.openai.model.chat).toStrictEqual(models[0].id)
})

test('OpenAI Load Image Models', async () => {
  expect(await loadOpenAIModels()).toBe(true)
  const models = store.config.engines.openai.models.image
  expect(_OpenAI.default.prototype.models.list).toHaveBeenCalled()
  expect(models.map((m: Model) => { return { id: m.id, name: m.name } })).toStrictEqual([
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

test('OpenAI stream', async () => {
  const openAI = new OpenAI(store.config)
  const stream = await openAI.stream([
    new Message('system', 'instruction'),
    new Message('user', 'prompt'),
  ], null)
  expect(_OpenAI.default.prototype.chat.completions.create).toHaveBeenCalled()
  expect(stream).toBeDefined()
  expect(stream.controller).toBeDefined()
  let response = ''
  const eventCallback = vi.fn()
  for await (const streamChunk of stream) {
    const chunk: LlmChunk = await openAI.streamChunkToLlmChunk(streamChunk, eventCallback)
    if (chunk) {
      if (chunk.done) break
      response += chunk.text
    }
  }
  expect(response).toBe('response')
  expect(eventCallback).toHaveBeenNthCalledWith(1, { type: 'tool', content: 'prep2' })
  expect(eventCallback).toHaveBeenNthCalledWith(2, { type: 'tool', content: 'run2' })
  expect(Plugin2.prototype.execute).toHaveBeenCalledWith(['arg'])
  expect(eventCallback).toHaveBeenNthCalledWith(3, { type: 'tool', content: null })
  expect(eventCallback).toHaveBeenNthCalledWith(4, { type: 'stream', content: expect.any(Object) })
  await openAI.stop(stream)
  expect(stream.controller.abort).toHaveBeenCalled()
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
  message.attachFile(new Attachment('', 'image/png', 'image', true))
  const payload: LLmCompletionPayload = { role: 'user', content: message }
  openAI.addImageToPayload(message, payload)
  expect(payload.content).toStrictEqual([
    { type: 'text', text: 'text' },
    { type: 'image_url', image_url: { url: 'data:image/png;base64,image' } }
  ])
})
