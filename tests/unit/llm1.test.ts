
import { vi, expect, test } from 'vitest'
import { Anthropic, Ollama, Google, Groq, XAI, Cerebras, MistralAI } from 'multi-llm-ts'
import OpenAI from '../../src/llms/openai'
import LlmFactory from '../../src/llms/llm'
import { store } from '../../src/services/store'
import defaults from '../../defaults/settings.json'

window.api = {
  config: {
    load: vi.fn(() => JSON.parse(JSON.stringify(defaults))),
    save: vi.fn()
  },
  base64: {
    decode: (data: string) => data
  },
  file: {
    extractText: (contents) => contents
  },
  computer: {
    isAvailable: () => true,
  }
}

store.loadSettings()
store.config.engines.openai.apiKey = '123'

const llmFactory = new LlmFactory(store.config)

const model = [{ id: 'llava:latest', name: 'llava:latest', meta: {} }]

test('Default Configuration', () => {
  expect(llmFactory.isEngineReady('openai')).toBe(true)
  expect(llmFactory.isEngineReady('ollama')).toBe(false)
  expect(llmFactory.isEngineReady('mistralai')).toBe(false)
  expect(llmFactory.isEngineReady('anthropic')).toBe(false)
  expect(llmFactory.isEngineReady('google')).toBe(false)
  expect(llmFactory.isEngineReady('xai')).toBe(false)
  expect(llmFactory.isEngineReady('groq')).toBe(false)
  expect(llmFactory.isEngineReady('cerebras')).toBe(false)
  expect(llmFactory.isEngineReady('aws')).toBe(false)
})

test('OpenAI Configuration', () => {
  expect(llmFactory.isEngineConfigured('openai')).toBe(true)
  expect(llmFactory.isEngineReady('openai')).toBe(true)
  store.config.engines.openai.apiKey = '123'
  expect(llmFactory.isEngineReady('openai')).toBe(true)
  store.config.engines.openai.models.chat = [model]
  expect(llmFactory.isEngineReady('openai')).toBe(true)
})

test('Ollama Configuration', () => {
  expect(llmFactory.isEngineConfigured('ollama')).toBe(true)
  store.config.engines.ollama.models.image = [model]
  expect(llmFactory.isEngineReady('ollama')).toBe(false)
  store.config.engines.ollama.models.chat = [model]
  expect(llmFactory.isEngineReady('ollama')).toBe(true)
})

test('MistralAI Configuration', () => {
  expect(llmFactory.isEngineConfigured('mistralai')).toBe(false)
  store.config.engines.mistralai.apiKey = '123'
  expect(llmFactory.isEngineConfigured('mistralai')).toBe(true)
  expect(llmFactory.isEngineReady('mistralai')).toBe(false)
  store.config.engines.mistralai.models.image = [model]
  expect(llmFactory.isEngineReady('mistralai')).toBe(false)
  store.config.engines.mistralai.models.chat = [model]
  expect(llmFactory.isEngineReady('mistralai')).toBe(true)
})

test('Anthropic Configuration', () => {
  expect(llmFactory.isEngineConfigured('anthropic')).toBe(false)
  store.config.engines.anthropic.models.image = [model]
  expect(llmFactory.isEngineReady('anthropic')).toBe(false)
  store.config.engines.anthropic.models.chat = [model]
  expect(llmFactory.isEngineReady('anthropic')).toBe(false)
  expect(llmFactory.isEngineConfigured('anthropic')).toBe(false)
  store.config.engines.anthropic.apiKey = '123'
  expect(llmFactory.isEngineConfigured('anthropic')).toBe(true)
  expect(llmFactory.isEngineReady('anthropic')).toBe(true)
})

test('Google Configuration', () => {
  expect(llmFactory.isEngineConfigured('google')).toBe(false)
  store.config.engines.google.models.image = [model]
  expect(llmFactory.isEngineReady('google')).toBe(false)
  store.config.engines.google.models.chat = [model]
  expect(llmFactory.isEngineReady('google')).toBe(false)
  store.config.engines.google.apiKey = '123'
  expect(llmFactory.isEngineConfigured('google')).toBe(true)
  expect(llmFactory.isEngineReady('google')).toBe(true)
})

test('xAI Configuration', () => {
  expect(llmFactory.isEngineConfigured('xai')).toBe(false)
  store.config.engines.xai.models.image = [model]
  expect(llmFactory.isEngineReady('xai')).toBe(false)
  store.config.engines.xai.models.chat = [model]
  expect(llmFactory.isEngineReady('xai')).toBe(false)
  expect(llmFactory.isEngineConfigured('xai')).toBe(false)
  store.config.engines.xai.apiKey = '123'
  expect(llmFactory.isEngineConfigured('xai')).toBe(true)
  expect(llmFactory.isEngineReady('xai')).toBe(true)
})

test('Groq Configuration', () => {
  expect(llmFactory.isEngineConfigured('groq')).toBe(false)
  store.config.engines.groq.models.image = [model]
  expect(llmFactory.isEngineReady('groq')).toBe(false)
  store.config.engines.groq.models.chat = [model]
  expect(llmFactory.isEngineReady('groq')).toBe(false)
  expect(llmFactory.isEngineConfigured('groq')).toBe(false)
  store.config.engines.groq.apiKey = '123'
  expect(llmFactory.isEngineConfigured('groq')).toBe(true)
  expect(llmFactory.isEngineReady('groq')).toBe(true)
})

test('Cerebras Configuration', () => {
  expect(llmFactory.isEngineConfigured('cerebras')).toBe(false)
  store.config.engines.cerebras.models.image = [model]
  expect(llmFactory.isEngineReady('cerebras')).toBe(false)
  store.config.engines.cerebras.models.chat = [model]
  expect(llmFactory.isEngineReady('cerebras')).toBe(false)
  expect(llmFactory.isEngineConfigured('cerebras')).toBe(false)
  store.config.engines.cerebras.apiKey = '123'
  expect(llmFactory.isEngineConfigured('cerebras')).toBe(true)
  expect(llmFactory.isEngineReady('cerebras')).toBe(true)
})

test('Ignite Engine', async () => {
  expect(await llmFactory.igniteEngine('openai')).toBeInstanceOf(OpenAI)
  expect(await llmFactory.igniteEngine('ollama')).toBeInstanceOf(Ollama)
  expect(await llmFactory.igniteEngine('mistralai')).toBeInstanceOf(MistralAI)
  expect(await llmFactory.igniteEngine('anthropic')).toBeInstanceOf(Anthropic)
  expect(await llmFactory.igniteEngine('google')).toBeInstanceOf(Google)
  expect(await llmFactory.igniteEngine('xai')).toBeInstanceOf(XAI)
  expect(await llmFactory.igniteEngine('groq')).toBeInstanceOf(Groq)
  expect(await llmFactory.igniteEngine('cerebras')).toBeInstanceOf(Cerebras)
  expect(await llmFactory.igniteEngine('aws')).toBeInstanceOf(OpenAI)
  expect(await llmFactory.igniteEngine('aws', 'aws')).toBeNull()
})

test('Anthropic Computer Use', async () => {
  const anthropic = await llmFactory.igniteEngine('anthropic')
  expect(anthropic.computerInfo).not.toBeNull()
})

test('Reflects configuration changes', () => {
  defaults.engines.openai.apiKey = '345'
  store.loadSettings()
  expect(llmFactory.config.engines.openai.apiKey).toBe('345')
})
