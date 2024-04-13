
import { beforeEach, expect, test } from 'vitest'
import { isEngineReady } from '../src/services/llm'
import { store } from '../src/services/store'
import defaults from '../defaults/settings.json'

const model = [{ id: 'llava:latest', name: 'llava:latest', meta: {} }]

beforeEach(() => {
  store.config = defaults
})

test('Default Configuration', () => {
  expect(isEngineReady('openai')).toBe(true)
  expect(isEngineReady('ollama')).toBe(false)
  expect(isEngineReady('mistralai')).toBe(false)
  expect(isEngineReady('anthropic')).toBe(false)
  expect(isEngineReady('google')).toBe(false)
})

test('OpenAI Configuration', () => {
  store.config.engines.openai.apiKey = '123'
  expect(isEngineReady('openai')).toBe(true)
  store.config.engines.openai.models.chat = [model]
  expect(isEngineReady('openai')).toBe(true)
})

test('Ollaama Configuration', () => {
  store.config.engines.ollama.models.image = [model]
  expect(isEngineReady('ollama')).toBe(false)
  store.config.engines.ollama.models.chat = [model]
  expect(isEngineReady('ollama')).toBe(true)
})

test('MistralAI Configuration', () => {
  store.config.engines.mistralai.models.image = [model]
  expect(isEngineReady('mistralai')).toBe(false)
  store.config.engines.mistralai.models.chat = [model]
  expect(isEngineReady('mistralai')).toBe(false)
})

test('Anthropic Configuration', () => {
  store.config.engines.anthropic.models.image = [{ id: 'llava:latest', name: 'llava:latest', meta: {} }]
  expect(isEngineReady('anthropic')).toBe(false)
  store.config.engines.anthropic.models.chat = [{ id: 'llava:latest', name: 'llava:latest', meta: {} }]
  expect(isEngineReady('anthropic')).toBe(false)
  store.config.engines.anthropic.apiKey = '123'
  expect(isEngineReady('anthropic')).toBe(true)
})

test('Google Configuration', () => {
  expect(isEngineReady('google')).toBe(false)
  store.config.engines.google = {
    apiKey: '123',
    models: {
      chat: [model],
      image: [model]
    }
  }
  expect(isEngineReady('google')).toBe(false)
})
