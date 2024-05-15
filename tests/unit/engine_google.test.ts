
import { vi, beforeEach, expect, test } from 'vitest'
import { store } from '../../src/services/store'
import defaults from '../../defaults/settings.json'
import Message from '../../src/models/message'
import Google from '../../src/services/google'
import { EnhancedGenerateContentResponse } from '@google/generative-ai'

vi.mock('@google/generative-ai', async() => {
  return {
    GoogleGenerativeAI: vi.fn((apiKey) => {
      return {
        apiKey: apiKey,
        getGenerativeModel: vi.fn(() => {
          return {
            startChat: vi.fn(() => {
              return {
                sendMessage: vi.fn(() => {
                  return {
                    response: {
                      text: () => 'response'
                    }
                  }
                }),
                sendMessageStream: vi.fn(() => {
                  return {
                    stream: vi.fn()
                  }
                })
              }
            })
          }
        }),
      }
    })
  }
})

beforeEach(() => {
  store.config = defaults
  store.config.engines.google.apiKey = '123'
})

test('Google Basic', async () => {
  const google = new Google(store.config)
  expect(google.getName()).toBe('google')
  expect(await google.getModels()).toStrictEqual([
    { id: 'models/gemini-1.5-pro-latest', name: 'Gemini 1.5 Pro' },
    { id: 'gemini-1.5-flash-latest', name: 'Gemini  1.5 Flash' },
    { id: 'models/gemini-pro', name: 'Gemini 1.0 Pro' },
])
  //expect(_Google.default.prototype.models.list).toHaveBeenCalled()
  expect(google.isVisionModel('models/gemini-pro')).toBe(false)
  expect(google.isVisionModel('gemini-1.5-flash-latest')).toBe(true)
  expect(google.isVisionModel('models/gemini-1.5-pro-latest')).toBe(true)
  expect(google.getRountingModel()).toBeNull()
})

test('Google completion', async () => {
  const google = new Google(store.config)
  const response = await google.complete([
    new Message('system', 'instruction'),
    new Message('user', 'prompt'),
  ], null)
  expect(response).toStrictEqual({
    type: 'text',
    content: 'response'
  })
})

test('Google stream', async () => {
  const google = new Google(store.config)
  const response = await google.stream([
    new Message('system', 'instruction'),
    new Message('user', 'prompt'),
  ], null)
  //expect(response.controller).toBeDefined()
  await google.stop(response)
  //expect(response.controller.abort).toHaveBeenCalled()
})

test('Google streamChunkToLlmChunk Text', async () => {
  const google = new Google(store.config)
  const streamChunk: EnhancedGenerateContentResponse = {
    candidates: [ {
      index: 0,
      content: { role: 'model', parts: [ { text: 'response' } ] },
      //finishReason: FinishReason.STOP,
    } ],
    text: vi.fn(() => 'response'),
    functionCalls: vi.fn(() => []),
    functionCall: null,
  }
  const llmChunk1 = await google.streamChunkToLlmChunk(streamChunk, null)
  expect(streamChunk.text).toHaveBeenCalled()
  expect(streamChunk.functionCalls).toHaveBeenCalled()
  expect(llmChunk1).toStrictEqual({ text: 'response', done: false })
  streamChunk.candidates[0].finishReason = 'STOP'
  streamChunk.text = vi.fn(() => '')
  const llmChunk2 = await google.streamChunkToLlmChunk(streamChunk, null)
  expect(streamChunk.text).toHaveBeenCalled()
  expect(streamChunk.functionCalls).toHaveBeenCalled()
  expect(llmChunk2).toStrictEqual({ text: '', done: true })
})
