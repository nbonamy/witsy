
import { vi, beforeEach, expect, test } from 'vitest'
import { store } from '../../src/services/store'
import defaults from '../../defaults/settings.json'
import Cerebras from '../../src/services/cerebras'
import Message from '../../src/models/message'
import * as _OpenAI from 'openai'
import { loadCerebrasModels } from '../../src/services/llm'
import { Model } from '../../src/types/config.d'

window.api = {
  config: {
    save: vi.fn()
  },
}

vi.mock('openai', async () => {
  const OpenAI = vi.fn((opts: _OpenAI.ClientOptions) => {
    OpenAI.prototype.apiKey = opts.apiKey
    OpenAI.prototype.baseURL = opts.baseURL
  })
  OpenAI.prototype.chat = {
    completions: {
      create: vi.fn()
    }
  }
  return { default : OpenAI }
})

beforeEach(() => {
  store.config = defaults
  store.config.engines.cerebras.apiKey = '123'
})

test('Cerebras Load Chat Models', async () => {
  expect(await loadCerebrasModels()).toBe(true)
  const models = store.config.engines.cerebras.models.chat
  expect(models.map((m: Model) => { return { id: m.id, name: m.name }})).toStrictEqual([
    { id: 'llama3.1-8b', name: 'Llama 3.1 8b' },
    { id: 'llama3.1-70b', name: 'Llama 3.1 70b' },
  ])
  expect(store.config.engines.cerebras.model.chat).toStrictEqual(models[0].id)
})

test('Cerebras Basic', async () => {
  const cerebras = new Cerebras(store.config)
  expect(cerebras.getName()).toBe('cerebras')
  expect(cerebras.client.baseURL).toBe('https://api.cerebras.ai/v1')
  expect(cerebras.isVisionModel('llama3.1-8b')).toBe(false)
  expect(cerebras.isVisionModel('llama3.1-70b')).toBe(false)
})

test('Cerebras stream', async () => {
  const cerebras = new Cerebras(store.config)
  const response = await cerebras.stream([
    new Message('system', 'instruction'),
    new Message('user', 'prompt'),
  ], null)
  expect(_OpenAI.default.prototype.chat.completions.create).toHaveBeenCalled()
  expect(_OpenAI.default.prototype.chat.completions.create.mock.calls[0][0].tools).toBeNull()
  expect(_OpenAI.default.prototype.chat.completions.create.mock.calls[0][0].tool_choice).toBeNull()
})
