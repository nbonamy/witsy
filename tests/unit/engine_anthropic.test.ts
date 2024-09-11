
import { LLmCompletionPayload } from '../../src/types/llm.d'
import { vi, beforeEach, expect, test } from 'vitest'
import { store } from '../../src/services/store'
import defaults from '../../defaults/settings.json'
import Message from '../../src/models/message'
import Attachment from '../../src/models/attachment'
import Anthropic from '../../src/services/anthropic'
import * as _Anthropic from '@anthropic-ai/sdk'
import { loadAnthropicModels } from '../../src/services/llm'
import { Model } from '../../src/types/config.d'

window.api = {
  config: {
    save: vi.fn()
  },
  file: {
    extractText: (contents) => contents
  }
}

vi.mock('@anthropic-ai/sdk', async() => {
  const Anthropic = vi.fn()
  Anthropic.prototype.apiKey = '123'
  Anthropic.prototype.models = {
    list: vi.fn(() => {
      return { data: [{ id: 'model', name: 'model' }] }
    })
  }
  Anthropic.prototype.messages = {
    create: vi.fn((opts) => {
      if (opts.stream) {
        return {
          controller: {
            abort: vi.fn()
          }
        }
      }
      else {
        return { content: [{ text: 'response' }] }
      }
    })
  }
  Anthropic.prototype.images = {
    generate: vi.fn(() => {
      return {
        data: [{ revised_prompt: 'revised_prompt', url: 'url', b64_json: 'b64_json' }]
      }
    })
  }
  return { default : Anthropic }
})

beforeEach(() => {
  store.config = defaults
  store.config.engines.anthropic.apiKey = '123'
})

test('Anthropic Load Models', async () => {
  expect(await loadAnthropicModels()).toBe(true)
  const models = store.config.engines.anthropic.models.chat
  expect(models.map((m: Model) => { return { id: m.id, name: m.name }})).toStrictEqual([
    { id: 'claude-3-haiku-20240307', name: 'Claude 3 Haiku' },
    { id: 'claude-3-opus-20240229', name: 'Claude 3 Opus' },
    { id: 'claude-3-sonnet-20240229', name: 'Claude 3 Sonnet' },
    { id: 'claude-3-5-sonnet-20240620', name: 'Claude 3.5 Sonnet' },
  ])
  expect(store.config.engines.anthropic.model.chat).toStrictEqual(models[0].id)
})

test('Anthropic Basic', async () => {
  const anthropic = new Anthropic(store.config)
  expect(anthropic.getName()).toBe('anthropic')
  expect(anthropic.isVisionModel('claude-3-haiku-20240307')).toBe(true)
  expect(anthropic.isVisionModel('claude-3-sonnet-20240229')).toBe(true)
  expect(anthropic.isVisionModel('claude-3-opus-2024022')).toBe(true)
  expect(anthropic.isVisionModel('claude-3-5-sonnet-20240620')).toBe(true)
})

test('Anthropic completion', async () => {
  const anthropic = new Anthropic(store.config)
  const response = await anthropic.complete([
    new Message('system', 'instruction'),
    new Message('user', 'prompt'),
  ], null)
  expect(_Anthropic.default.prototype.messages.create).toHaveBeenCalled()
  expect(response).toStrictEqual({
    type: 'text',
    content: 'response'
  })
})

test('Anthropic stream', async () => {
  const anthropic = new Anthropic(store.config)
  const response = await anthropic.stream([
    new Message('system', 'instruction'),
    new Message('user', 'prompt'),
  ], null)
  expect(_Anthropic.default.prototype.messages.create).toHaveBeenCalled()
  expect(response.controller).toBeDefined()
  await anthropic.stop(response)
  expect(response.controller.abort).toHaveBeenCalled()
})

test('Anthropic image', async () => {
  const anthropic = new Anthropic(store.config)
  const response = await anthropic.image('image', null)
  expect(response).toBeNull()
})

test('Anthropic addImageToPayload', async () => {
  const anthropic = new Anthropic(store.config)
  const message = new Message('user', 'text')
  message.attachFile(new Attachment('', 'image/png', 'image', true ))
  const payload: LLmCompletionPayload = { role: 'user', content: message }
  anthropic.addImageToPayload(message, payload)
  expect(payload.content).toStrictEqual([
    { type: 'text', text: 'text' },
    { type: 'image', source: {
      type: 'base64',
      media_type: 'image/png',
      data: 'image',
    }}
  ])
})

test('Anthropic streamChunkToLlmChunk Text', async () => {
  const anthropic = new Anthropic(store.config)
  const streamChunk: any = {
    index: 0,
    type: 'content_block_delta',
    delta: { type: 'text_delta', text: 'response' }
  }
  const llmChunk1 = await anthropic.streamChunkToLlmChunk(streamChunk, null)
  expect(llmChunk1).toStrictEqual({ text: 'response', done: false })
  streamChunk.type = 'message_stop'
  const llmChunk2 = await anthropic.streamChunkToLlmChunk(streamChunk, null)
  expect(llmChunk2).toStrictEqual({ text: '', done: true })
})
