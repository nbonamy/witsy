
import { vi, beforeEach, expect, test } from 'vitest'
import { isEngineReady, igniteEngine, isEngineConfigured } from '../../src/llms/llm'
import { Anthropic, Ollama, Google, Groq, XAI, Cerebras, MistralAI } from 'multi-llm-ts'
import OpenAI from '../../src/llms/openai'
import { store } from '../../src/services/store'
import defaults from '../../defaults/settings.json'

const model = [{ id: 'llava:latest', name: 'llava:latest', meta: {} }]

window.api = {
  config: {
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

beforeEach(() => {
  store.config = defaults
  store.config.engines.openai.apiKey = '123'
})

test('Default Configuration', () => {
  expect(isEngineReady('openai')).toBe(true)
  expect(isEngineReady('ollama')).toBe(false)
  expect(isEngineReady('mistralai')).toBe(false)
  expect(isEngineReady('anthropic')).toBe(false)
  expect(isEngineReady('google')).toBe(false)
  expect(isEngineReady('xai')).toBe(false)
  expect(isEngineReady('groq')).toBe(false)
  expect(isEngineReady('cerebras')).toBe(false)
  expect(isEngineReady('aws')).toBe(false)
})

test('OpenAI Configuration', () => {
  expect(isEngineConfigured('openai')).toBe(true)
  expect(isEngineReady('openai')).toBe(true)
  store.config.engines.openai.apiKey = '123'
  expect(isEngineReady('openai')).toBe(true)
  store.config.engines.openai.models.chat = [model]
  expect(isEngineReady('openai')).toBe(true)
})

test('Ollama Configuration', () => {
  expect(isEngineConfigured('ollama')).toBe(true)
  store.config.engines.ollama.models.image = [model]
  expect(isEngineReady('ollama')).toBe(false)
  store.config.engines.ollama.models.chat = [model]
  expect(isEngineReady('ollama')).toBe(true)
})

test('MistralAI Configuration', () => {
  expect(isEngineConfigured('mistralai')).toBe(false)
  store.config.engines.mistralai.apiKey = '123'
  expect(isEngineConfigured('mistralai')).toBe(true)
  expect(isEngineReady('mistralai')).toBe(false)
  store.config.engines.mistralai.models.image = [model]
  expect(isEngineReady('mistralai')).toBe(false)
  store.config.engines.mistralai.models.chat = [model]
  expect(isEngineReady('mistralai')).toBe(true)
})

test('Anthropic Configuration', () => {
  expect(isEngineConfigured('anthropic')).toBe(false)
  store.config.engines.anthropic.models.image = [model]
  expect(isEngineReady('anthropic')).toBe(false)
  store.config.engines.anthropic.models.chat = [model]
  expect(isEngineReady('anthropic')).toBe(false)
  expect(isEngineConfigured('anthropic')).toBe(false)
  store.config.engines.anthropic.apiKey = '123'
  expect(isEngineConfigured('anthropic')).toBe(true)
  expect(isEngineReady('anthropic')).toBe(true)
})

test('Google Configuration', () => {
  expect(isEngineConfigured('google')).toBe(false)
  store.config.engines.google.models.image = [model]
  expect(isEngineReady('google')).toBe(false)
  store.config.engines.google.models.chat = [model]
  expect(isEngineReady('google')).toBe(false)
  store.config.engines.google.apiKey = '123'
  expect(isEngineConfigured('google')).toBe(true)
  expect(isEngineReady('google')).toBe(true)
})

test('xAI Configuration', () => {
  expect(isEngineConfigured('xai')).toBe(false)
  store.config.engines.xai.models.image = [model]
  expect(isEngineReady('xai')).toBe(false)
  store.config.engines.xai.models.chat = [model]
  expect(isEngineReady('xai')).toBe(false)
  expect(isEngineConfigured('xai')).toBe(false)
  store.config.engines.xai.apiKey = '123'
  expect(isEngineConfigured('xai')).toBe(true)
  expect(isEngineReady('xai')).toBe(true)
})

test('Groq Configuration', () => {
  expect(isEngineConfigured('groq')).toBe(false)
  store.config.engines.groq.models.image = [model]
  expect(isEngineReady('groq')).toBe(false)
  store.config.engines.groq.models.chat = [model]
  expect(isEngineReady('groq')).toBe(false)
  expect(isEngineConfigured('groq')).toBe(false)
  store.config.engines.groq.apiKey = '123'
  expect(isEngineConfigured('groq')).toBe(true)
  expect(isEngineReady('groq')).toBe(true)
})

test('Cerebras Configuration', () => {
  expect(isEngineConfigured('cerebras')).toBe(false)
  store.config.engines.cerebras.models.image = [model]
  expect(isEngineReady('cerebras')).toBe(false)
  store.config.engines.cerebras.models.chat = [model]
  expect(isEngineReady('cerebras')).toBe(false)
  expect(isEngineConfigured('cerebras')).toBe(false)
  store.config.engines.cerebras.apiKey = '123'
  expect(isEngineConfigured('cerebras')).toBe(true)
  expect(isEngineReady('cerebras')).toBe(true)
})

test('Ignite Engine', async () => {
  expect(await igniteEngine('openai')).toBeInstanceOf(OpenAI)
  expect(await igniteEngine('ollama')).toBeInstanceOf(Ollama)
  expect(await igniteEngine('mistralai')).toBeInstanceOf(MistralAI)
  expect(await igniteEngine('anthropic')).toBeInstanceOf(Anthropic)
  expect(await igniteEngine('google')).toBeInstanceOf(Google)
  expect(await igniteEngine('xai')).toBeInstanceOf(XAI)
  expect(await igniteEngine('groq')).toBeInstanceOf(Groq)
  expect(await igniteEngine('cerebras')).toBeInstanceOf(Cerebras)
  expect(await igniteEngine('aws')).toBeInstanceOf(OpenAI)
  expect(await igniteEngine('aws', 'aws')).toBeNull()
})

test('Anthropic Computer Use', async () => {
  const anthropic = await igniteEngine('anthropic')
  expect(anthropic.computerInfo).not.toBeNull()
})

