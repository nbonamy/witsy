
import { LLmCompletionPayload } from '../src/index.d'
import { beforeEach, expect, test } from 'vitest'
import { store } from '../src/services/store'
import defaults from '../defaults/settings.json'
import Message from '../src/models/message'
import Anthropic from '../src/services/anthropic'

beforeEach(() => {
  store.config = defaults
  store.config.engines.anthropic.apiKey = '123'
})

test('anthropic.Basic', () => {
  const anthropic = new Anthropic(store.config)
  expect(anthropic.getName()).toBe('anthropic')
  expect(anthropic.getVisionModels()).toStrictEqual([])
  expect(anthropic.isVisionModel('claude-3-haiku-20240307')).toBe(true)
  expect(anthropic.isVisionModel('claude-3-sonnet-20240229')).toBe(true)
  expect(anthropic.isVisionModel('claude-3-opus-2024022')).toBe(true)
  expect(anthropic.getRountingModel()).toBeNull()
})

test('anthropic.addImageToPayload', async () => {
  const anthropic = new Anthropic(store.config)
  const message = new Message('user', 'text')
  message.attachFile({ type: 'image', url: '', format:'png', contents: 'image', downloaded: true })
  const payload: LLmCompletionPayload = { role: 'user', content: message }
  anthropic.addImageToPayload(message, payload)
  expect(payload.content).toStrictEqual([
    { type: 'text', text: 'text' },
    { type: 'image', source: {
      type: 'base64',
      media_type: 'image/jpeg',
      data: 'image',
    }}
  ])
})

test('anthropic.streamChunkToLlmChunk Text', async () => {
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
