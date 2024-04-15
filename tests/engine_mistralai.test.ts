
import { LLmCompletionPayload } from '../src/index.d'
import { beforeEach, expect, test } from 'vitest'
import { store } from '../src/services/store'
import defaults from '../defaults/settings.json'
import Message from '../src/models/message'
import MistralAI from '../src/services/mistralai'

beforeEach(() => {
  store.config = defaults
  store.config.engines.mistralai.apiKey = '123'
})

test('mistralai.Basic', () => {
  const mistralai = new MistralAI(store.config)
  expect(mistralai.getName()).toBe('mistralai')
  expect(mistralai.isVisionModel('mistral-medium')).toBe(false)
  expect(mistralai.isVisionModel('mistral-large')).toBe(false)
  expect(mistralai.getRountingModel()).toBeNull()
})

test('mistralai.addImageToPayload', async () => {
  const mistralai = new MistralAI(store.config)
  const message = new Message('user', 'text')
  message.attachFile({ type: 'image', url: '', format:'png', contents: 'image', downloaded: true })
  const payload: LLmCompletionPayload = { role: 'user', content: message }
  mistralai.addImageToPayload(message, payload)
  expect(payload.images).toStrictEqual([ 'image' ])
})

test('mistralai.streamChunkToLlmChunk Text', async () => {
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
