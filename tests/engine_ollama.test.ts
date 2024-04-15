
import { LLmCompletionPayload } from '../src/index.d'
import { beforeEach, expect, test } from 'vitest'
import { store } from '../src/services/store'
import defaults from '../defaults/settings.json'
import Message from '../src/models/message'
import Ollama from '../src/services/ollama'

beforeEach(() => {
  store.config = defaults
  store.config.engines.ollama.apiKey = '123'
})

test('ollama.Basic', () => {
  const ollama = new Ollama(store.config)
  expect(ollama.getName()).toBe('ollama')
  expect(ollama.isVisionModel('llava:latest')).toBe(true)
  expect(ollama.isVisionModel('llama2:latest')).toBe(false)
  expect(ollama.getRountingModel()).toBeNull()
})

test('ollama.addImageToPayload', async () => {
  const ollama = new Ollama(store.config)
  const message = new Message('user', 'text')
  message.attachFile({ type: 'image', url: '', format:'png', contents: 'image', downloaded: true })
  const payload: LLmCompletionPayload = { role: 'user', content: message }
  ollama.addImageToPayload(message, payload)
  expect(payload.images).toStrictEqual([ 'image' ])
})

test('ollama.streamChunkToLlmChunk Text', async () => {
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
