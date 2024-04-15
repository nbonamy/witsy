
import { LLmCompletionPayload } from '../src/index.d'
import { beforeEach, expect, test } from 'vitest'
import { store } from '../src/services/store'
import defaults from '../defaults/settings.json'
import Message from '../src/models/message'
import OpenAI from '../src/services/openai'
import { ChatCompletionChunk } from 'openai/resources'

beforeEach(() => {
  store.config = defaults
  store.config.engines.openai.apiKey = '123'
})

test('OpenAI Basic', () => {
  const openAI = new OpenAI(store.config)
  expect(openAI.getName()).toBe('openai')
  expect(openAI.isVisionModel('gpt-3.5')).toBe(false)
  expect(openAI.isVisionModel('gpt-3.5-turbo')).toBe(false)
  expect(openAI.isVisionModel('gpt-4-turbo')).toBe(true)
  expect(openAI.isVisionModel('gpt-4-vision')).toBe(true)
  expect(openAI.isVisionModel('gpt-4-vision-preview')).toBe(true)
  expect(openAI.getRountingModel()).toMatch(/3.5/)
})

test('OpenAI addImageToPayload', async () => {
  const openAI = new OpenAI(store.config)
  const message = new Message('user', 'text')
  message.attachFile({ type: 'image', url: '', format:'png', contents: 'image', downloaded: true })
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
