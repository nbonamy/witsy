
import { beforeEach, expect, test } from 'vitest'
import { isEngineReady, igniteEngine, hasVisionModels, isVisionModel } from '../../src/services/llm'
import { store } from '../../src/services/store'
import defaults from '../../defaults/settings.json'
import OpenAI from '../../src/services/openai'
import Ollama from '../../src/services/ollama'
import MistralAI from '../../src/services/mistralai'
import Anthropic from '../../src/services/anthropic'
import Google from '../../src/services/google'
import Groq from '../../src/services/groq'

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
  expect(isEngineReady('groq')).toBe(false)
  expect(isEngineReady('aws')).toBe(false)
})

test('OpenAI Configuration', () => {
  expect(isEngineReady('openai')).toBe(true)
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
  store.config.engines.mistralai.apiKey = '123'
  expect(isEngineReady('mistralai')).toBe(false)
  store.config.engines.mistralai.models.image = [model]
  expect(isEngineReady('mistralai')).toBe(false)
  store.config.engines.mistralai.models.chat = [model]
  expect(isEngineReady('mistralai')).toBe(true)
})

test('Anthropic Configuration', () => {
  store.config.engines.anthropic.models.image = [model]
  expect(isEngineReady('anthropic')).toBe(false)
  store.config.engines.anthropic.models.chat = [model]
  expect(isEngineReady('anthropic')).toBe(false)
  store.config.engines.anthropic.apiKey = '123'
  expect(isEngineReady('anthropic')).toBe(true)
})

test('Google Configuration', () => {
  store.config.engines.google.models.image = [model]
  expect(isEngineReady('google')).toBe(false)
  store.config.engines.google.models.chat = [model]
  expect(isEngineReady('google')).toBe(false)
  store.config.engines.google.apiKey = '123'
  expect(isEngineReady('google')).toBe(true)
})

test('Groq Configuration', () => {
  store.config.engines.groq.models.image = [model]
  expect(isEngineReady('groq')).toBe(false)
  store.config.engines.groq.models.chat = [model]
  expect(isEngineReady('groq')).toBe(false)
  store.config.engines.groq.apiKey = '123'
  expect(isEngineReady('groq')).toBe(true)
})

test('Ignite Engine', async () => {
  expect(await igniteEngine('openai', store.config)).toBeInstanceOf(OpenAI)
  expect(await igniteEngine('ollama', store.config)).toBeInstanceOf(Ollama)
  expect(await igniteEngine('mistralai', store.config)).toBeInstanceOf(MistralAI)
  expect(await igniteEngine('anthropic', store.config)).toBeInstanceOf(Anthropic)
  expect(await igniteEngine('google', store.config)).toBeInstanceOf(Google)
  expect(await igniteEngine('groq', store.config)).toBeInstanceOf(Groq)
  expect(await igniteEngine('aws', store.config)).toBeInstanceOf(OpenAI)
  expect(await igniteEngine('aws', store.config, 'aws')).toBeNull()
})

test('Has Vision Models', async () => {
  expect(hasVisionModels('openai')).toBe(true)
  expect(hasVisionModels('anthropic')).toBe(false)
})

test('Is Vision Model', async () => {
  expect(isVisionModel('openai', 'gpt-3.5')).toBe(false)
  expect(isVisionModel('openai', 'gpt-4-turbo')).toBe(true)
  expect(isVisionModel('openai', 'gpt-vision')).toBe(true)
})
