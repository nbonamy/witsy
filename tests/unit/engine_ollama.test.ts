
import { LLmCompletionPayload } from '../../src/types/index.d'
import { vi, beforeEach, expect, test } from 'vitest'
import { store } from '../../src/services/store'
import defaults from '../../defaults/settings.json'
import Message from '../../src/models/message'
import Ollama from '../../src/services/ollama'
import * as _ollama from 'ollama'

vi.mock('ollama', async() => {
  return { default : {
    list: vi.fn(() => {
      return { models: [{ id: 'model', name: 'model' }] }
    }),
    chat: vi.fn((opts) => {
      if (opts.stream) {
        return {
          controller: {
            abort: vi.fn()
          }
        }
      }
      else {
        return { message: { content: 'response' } }
      }
    }),
    abort: vi.fn(),
  }}
})

beforeEach(() => {
  store.config = defaults
  store.config.engines.ollama.apiKey = '123'
})

test('Ollama Basic', async () => {
  const ollama = new Ollama(store.config)
  expect(ollama.getName()).toBe('ollama')
  expect(await ollama.getModels()).toStrictEqual([{ id: 'model', name: 'model' }])
  expect(ollama.isVisionModel('llava:latest')).toBe(true)
  expect(ollama.isVisionModel('llama2:latest')).toBe(false)
  expect(ollama.getRountingModel()).toBeNull()
})

test('Ollama completion', async () => {
  const ollama = new Ollama(store.config)
  const response = await ollama.complete([
    new Message('system', 'instruction'),
    new Message('user', 'prompt'),
  ], null)
  expect(_ollama.default.chat).toHaveBeenCalled()
  expect(response).toStrictEqual({
    type: 'text',
    content: 'response'
  })
})

test('Ollama stream', async () => {
  const ollama = new Ollama(store.config)
  const response = await ollama.stream([
    new Message('system', 'instruction'),
    new Message('user', 'prompt'),
  ], null)
  expect(_ollama.default.chat).toHaveBeenCalled()
  expect(response.controller).toBeDefined()
  await ollama.stop()
  expect(_ollama.default.abort).toHaveBeenCalled()
})

test('Ollama image', async () => {
  const ollama = new Ollama(store.config)
  const response = await ollama.image('image', null)
  expect(response).toBeNull()
})

test('Ollama addImageToPayload', async () => {
  const ollama = new Ollama(store.config)
  const message = new Message('user', 'text')
  message.attachFile({ type: 'image', url: '', format:'png', contents: 'image', downloaded: true })
  const payload: LLmCompletionPayload = { role: 'user', content: message }
  ollama.addImageToPayload(message, payload)
  expect(payload.images).toStrictEqual([ 'image' ])
})

test('Ollama streamChunkToLlmChunk Text', async () => {
  const ollama = new Ollama(store.config)
  const streamChunk: any = {
    message: { content: 'response'},
    done: false
  }
  const llmChunk1 = await ollama.streamChunkToLlmChunk(streamChunk, null)
  expect(llmChunk1).toStrictEqual({ text: 'response', done: false })
  streamChunk.done = true
  const llmChunk2 = await ollama.streamChunkToLlmChunk(streamChunk, null)
  expect(llmChunk2).toStrictEqual({ text: 'response', done: true })
})
