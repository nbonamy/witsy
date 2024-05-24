
import { vi, beforeEach, expect, test } from 'vitest'
import { store } from '../../src/services/store'
import defaults from '../../defaults/settings.json'
import Message from '../../src/models/message'
import Groq from '../../src/services/groq'
import { ChatCompletionChunk } from 'groq-sdk/lib/chat_completions_ext'
import { loadGroqModels } from '../../src/services/llm'
import { Model } from '../../src/types/config.d'

vi.mock('groq-sdk', async() => {
  const Groq = vi.fn()
  Groq.prototype.apiKey = '123'
  Groq.prototype.listModels = vi.fn(() => {
    return { data: [
      { id: 'model2', name: 'model2' },
      { id: 'model1', name: 'model1' },
    ] }
  })
  Groq.prototype.chat = {
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
  return { default : Groq }
})

beforeEach(() => {
  store.config = defaults
  store.config.engines.groq.apiKey = '123'
})

test('Groq Load Models', async () => {
  expect(await loadGroqModels()).toBe(true)
  const models = store.config.engines.groq.models.chat
  expect(models.map((m: Model) => { return { id: m.id, name: m.name }})).toStrictEqual([
    { id: 'gemma-7b-it-32768', name: 'Gemma 7b' },
    { id: 'llama2-70b-4096', name: 'LLaMA2 70b' },
    { id: 'llama3-70b-8192', name: 'LLaMA3 70b' },
    { id: 'llama3-8b-8192', name: 'LLaMA3 8b' },
    { id: 'mixtral-8x7b-32768', name: 'Mixtral 8x7b' },
  ])
  expect(store.config.engines.groq.model.chat).toStrictEqual(models[0].id)
})

test('Groq Basic', async () => {
  const groq = new Groq(store.config)
  expect(groq.getName()).toBe('groq')
  expect(groq.isVisionModel('llama2-70b-4096')).toBe(false)
  expect(groq.isVisionModel('llama3-70b-8192')).toBe(false)
})

test('Groq  completion', async () => {
  const groq = new Groq(store.config)
  const response = await groq.complete([
    new Message('system', 'instruction'),
    new Message('user', 'prompt'),
  ], null)
  expect(response).toStrictEqual({
    type: 'text',
    content: 'response'
  })
})

test('Groq  stream', async () => {
  const groq = new Groq(store.config)
  const response = await groq.stream([
    new Message('system', 'instruction'),
    new Message('user', 'prompt'),
  ], null)
  expect(response.controller).toBeDefined()
  await groq.stop(response)
})

test('Groq streamChunkToLlmChunk Text', async () => {
  const groq = new Groq(store.config)
  const streamChunk: ChatCompletionChunk = {
    choices: [{ index: 0, delta: { content: 'response' }, finish_reason: null }],
  }
  const llmChunk1 = await groq.streamChunkToLlmChunk(streamChunk, null)
  expect(llmChunk1).toStrictEqual({ text: 'response', done: false })
  streamChunk.choices[0].finish_reason = 'stop'
  const llmChunk2 = await groq.streamChunkToLlmChunk(streamChunk, null)
  expect(llmChunk2).toStrictEqual({ text: '', done: true })
})
