
import { Model } from '../../src/types/config.d'
import { LlmChunk } from 'types/llm.d'
import { vi, beforeEach, expect, test } from 'vitest'
import { Plugin1, Plugin2, Plugin3 } from '../mocks/plugins'
import { store } from '../../src/services/store'
import defaults from '../../defaults/settings.json'
import XAI from '../../src/llms/xai'
import Message from '../../src/models/message'
import * as _OpenAI from 'openai'
import { loadXAIModels } from '../../src/llms/llm'

window.api = {
  config: {
    save: vi.fn()
  },
}

Plugin2.prototype.execute = vi.fn((): Promise<string> => Promise.resolve('result2'))

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
  OpenAI.prototype.chat = {
    completions: {
      create: vi.fn((opts) => {
        if (opts.stream) {
          return {
            async * [Symbol.asyncIterator]() {
              
              // first we yield tool call chunks
              yield { choices: [{ delta: { tool_calls: [ { id: 1, function: { name: 'plugin2', arguments: '[ "ar' }} ] }, finish_reason: 'none' } ] }
              yield { choices: [{ delta: { tool_calls: [ { function: { arguments: [ 'g" ]' ] } }] }, finish_reason: 'none' } ] }
              yield { choices: [{ finish_reason: 'stop' } ] }
              
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
  return { default : OpenAI }
})

beforeEach(() => {
  store.config = defaults
  store.config.engines.xai.apiKey = '123'
})

test('xAI Load Chat Models', async () => {
  expect(await loadXAIModels()).toBe(true)
  const models = store.config.engines.xai.models.chat
  expect(models.map((m: Model) => { return { id: m.id, name: m.name }})).toStrictEqual([
    { id: 'grok-beta', name: 'Grok Beta' },
  ])
  expect(store.config.engines.xai.model.chat).toStrictEqual(models[0].id)
})

test('xAI Basic', async () => {
  const xai = new XAI(store.config)
  expect(xai.getName()).toBe('xai')
  expect(xai.client.apiKey).toBe('123')
  expect(xai.client.baseURL).toBe('https://api.x.ai/v1')
  expect(xai.isVisionModel('grok-beta')).toBe(false)
})

test('xAI stream', async () => {
  const xai = new XAI(store.config)
  const stream = await xai.stream([
    new Message('system', 'instruction'),
    new Message('user', 'prompt'),
  ], null)
  expect(_OpenAI.default.prototype.chat.completions.create).toHaveBeenCalled()
  expect(stream).toBeDefined()
  expect(stream.controller).toBeDefined()
  let response = ''
  const eventCallback = vi.fn()
  for await (const streamChunk of stream) {
    const chunk: LlmChunk = await xai.streamChunkToLlmChunk(streamChunk, eventCallback)
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
  await xai.stop(stream)
  expect(stream.controller.abort).toHaveBeenCalled()
})
