
import { beforeAll, expect, test } from 'vitest'
import { useWindowMock } from '../mocks/window'
import { Anthropic, Azure, Ollama, Google, Groq, XAI, Cerebras, MistralAI, DeepSeek, OpenRouter, MultiToolPlugin } from 'multi-llm-ts'
import { Plugin1, Plugin2, Plugin3 } from '../mocks/plugins'
import OpenAI from '../../src/llms/openai'
import LlmFactory, { favoriteMockEngine } from '../../src/llms/llm'
import { store } from '../../src/services/store'
import defaults from '../../defaults/settings.json'

beforeAll(() => {
  useWindowMock({ customEngine: true, favoriteModels: true })
  store.loadSettings()
  store.config.engines.openai.apiKey = '123'
})

const llmManager = LlmFactory.manager(store.config)

const model = { id: 'model-id', name: 'model-name', meta: {} }

test('Custom Engine', () => {
  for (const engine of llmManager.getStandardEngines()) {
    expect(llmManager.isCustomEngine(engine)).toBe(false)
  }
  for (const engine of llmManager.getNonChatEngines()) {
    expect(llmManager.isCustomEngine(engine)).toBe(false)
  }
  expect(llmManager.isCustomEngine('__favorites__')).toBe(false)
  expect(llmManager.isCustomEngine('aws')).toBe(false)
  expect(llmManager.isCustomEngine('custom1')).toBe(true)
  expect(llmManager.isCustomEngine('custom2')).toBe(true)
})

test('Get Engines', () => {
  expect(llmManager.getChatEngines()).toStrictEqual([favoriteMockEngine, ...llmManager.getStandardEngines(), 'custom1', 'custom2' ])
  expect(llmManager.getCustomEngines()).toStrictEqual(['custom1', 'custom2'])
})

test('Get Engine name', () => {
  expect(llmManager.getEngineName('openai')).toBe('openai')
  expect(llmManager.getEngineName('custom1')).toBe('custom_openai')
  expect(llmManager.getEngineName('custom2')).toBe('custom_azure')
  expect(llmManager.getEngineName('unknown')).toBe('custom')
})

test('Default Configuration', () => {
  expect(llmManager.isEngineReady('openai')).toBe(true)
  expect(llmManager.isEngineReady('ollama')).toBe(false)
  expect(llmManager.isEngineReady('mistralai')).toBe(false)
  expect(llmManager.isEngineReady('anthropic')).toBe(false)
  expect(llmManager.isEngineReady('google')).toBe(false)
  expect(llmManager.isEngineReady('xai')).toBe(false)
  expect(llmManager.isEngineReady('deepseek')).toBe(false)
  expect(llmManager.isEngineReady('openrouter')).toBe(false)
  expect(llmManager.isEngineReady('groq')).toBe(false)
  expect(llmManager.isEngineReady('cerebras')).toBe(false)
  expect(llmManager.isEngineReady('aws')).toBe(false)
  expect(llmManager.isEngineReady('custom1')).toBe(true)
  expect(llmManager.isEngineReady('custom2')).toBe(true)
})

test('OpenAI Configuration', () => {
  expect(llmManager.isEngineConfigured('openai')).toBe(true)
  expect(llmManager.isEngineReady('openai')).toBe(true)
  store.config.engines.openai.apiKey = '123'
  expect(llmManager.isEngineReady('openai')).toBe(true)
  store.config.engines.openai.models.chat = [model]
  expect(llmManager.isEngineReady('openai')).toBe(true)
})

test('Ollama Configuration', () => {
  expect(llmManager.isEngineConfigured('ollama')).toBe(true)
  store.config.engines.ollama.models.image = [model]
  expect(llmManager.isEngineReady('ollama')).toBe(false)
  store.config.engines.ollama.models.chat = [model]
  expect(llmManager.isEngineReady('ollama')).toBe(true)
})

test('MistralAI Configuration', () => {
  expect(llmManager.isEngineConfigured('mistralai')).toBe(false)
  store.config.engines.mistralai.apiKey = '123'
  expect(llmManager.isEngineConfigured('mistralai')).toBe(true)
  expect(llmManager.isEngineReady('mistralai')).toBe(false)
  store.config.engines.mistralai.models.image = [model]
  expect(llmManager.isEngineReady('mistralai')).toBe(false)
  store.config.engines.mistralai.models.chat = [model]
  expect(llmManager.isEngineReady('mistralai')).toBe(true)
})

test('Anthropic Configuration', () => {
  expect(llmManager.isEngineConfigured('anthropic')).toBe(false)
  store.config.engines.anthropic.models.image = [model]
  expect(llmManager.isEngineReady('anthropic')).toBe(false)
  store.config.engines.anthropic.models.chat = [model]
  expect(llmManager.isEngineReady('anthropic')).toBe(false)
  expect(llmManager.isEngineConfigured('anthropic')).toBe(false)
  store.config.engines.anthropic.apiKey = '123'
  expect(llmManager.isEngineConfigured('anthropic')).toBe(true)
  expect(llmManager.isEngineReady('anthropic')).toBe(true)
})

test('Google Configuration', () => {
  expect(llmManager.isEngineConfigured('google')).toBe(false)
  store.config.engines.google.models.image = [model]
  expect(llmManager.isEngineReady('google')).toBe(false)
  store.config.engines.google.models.chat = [model]
  expect(llmManager.isEngineReady('google')).toBe(false)
  store.config.engines.google.apiKey = '123'
  expect(llmManager.isEngineConfigured('google')).toBe(true)
  expect(llmManager.isEngineReady('google')).toBe(true)
})

test('xAI Configuration', () => {
  expect(llmManager.isEngineConfigured('xai')).toBe(false)
  store.config.engines.xai.models.image = [model]
  expect(llmManager.isEngineReady('xai')).toBe(false)
  store.config.engines.xai.models.chat = [model]
  expect(llmManager.isEngineReady('xai')).toBe(false)
  expect(llmManager.isEngineConfigured('xai')).toBe(false)
  store.config.engines.xai.apiKey = '123'
  expect(llmManager.isEngineConfigured('xai')).toBe(true)
  expect(llmManager.isEngineReady('xai')).toBe(true)
})

test('DeepSeek Configuration', () => {
  expect(llmManager.isEngineConfigured('deepseek')).toBe(false)
  store.config.engines.deepseek.models.image = [model]
  expect(llmManager.isEngineReady('deepseek')).toBe(false)
  store.config.engines.deepseek.models.chat = [model]
  expect(llmManager.isEngineReady('deepseek')).toBe(false)
  expect(llmManager.isEngineConfigured('deepseek')).toBe(false)
  store.config.engines.deepseek.apiKey = '123'
  expect(llmManager.isEngineConfigured('deepseek')).toBe(true)
  expect(llmManager.isEngineReady('deepseek')).toBe(true)
})

test('OpenRouter Configuration', () => {
  expect(llmManager.isEngineConfigured('openrouter')).toBe(false)
  store.config.engines.openrouter.models.image = [model]
  expect(llmManager.isEngineReady('openrouter')).toBe(false)
  store.config.engines.openrouter.models.chat = [model]
  expect(llmManager.isEngineReady('openrouter')).toBe(false)
  expect(llmManager.isEngineConfigured('openrouter')).toBe(false)
  store.config.engines.openrouter.apiKey = '123'
  expect(llmManager.isEngineConfigured('openrouter')).toBe(true)
  expect(llmManager.isEngineReady('openrouter')).toBe(true)
})

test('Groq Configuration', () => {
  expect(llmManager.isEngineConfigured('groq')).toBe(false)
  store.config.engines.groq.models.image = [model]
  expect(llmManager.isEngineReady('groq')).toBe(false)
  store.config.engines.groq.models.chat = [model]
  expect(llmManager.isEngineReady('groq')).toBe(false)
  expect(llmManager.isEngineConfigured('groq')).toBe(false)
  store.config.engines.groq.apiKey = '123'
  expect(llmManager.isEngineConfigured('groq')).toBe(true)
  expect(llmManager.isEngineReady('groq')).toBe(true)
})

test('Cerebras Configuration', () => {
  expect(llmManager.isEngineConfigured('cerebras')).toBe(false)
  store.config.engines.cerebras.models.image = [model]
  expect(llmManager.isEngineReady('cerebras')).toBe(false)
  store.config.engines.cerebras.models.chat = [model]
  expect(llmManager.isEngineReady('cerebras')).toBe(false)
  expect(llmManager.isEngineConfigured('cerebras')).toBe(false)
  store.config.engines.cerebras.apiKey = '123'
  expect(llmManager.isEngineConfigured('cerebras')).toBe(true)
  expect(llmManager.isEngineReady('cerebras')).toBe(true)
})

test('Custom Configuration', () => {
  expect(llmManager.isEngineConfigured('custom1')).toBe(true)
  expect(llmManager.isEngineReady('custom1')).toBe(true)
  store.config.engines.custom1.models.image = [model]
  expect(llmManager.isEngineReady('custom1')).toBe(true)
})

test('Ignite Engine', async () => {
  expect(await llmManager.igniteEngine('openai')).toBeInstanceOf(OpenAI)
  expect(await llmManager.igniteEngine('ollama')).toBeInstanceOf(Ollama)
  expect(await llmManager.igniteEngine('mistralai')).toBeInstanceOf(MistralAI)
  expect(await llmManager.igniteEngine('anthropic')).toBeInstanceOf(Anthropic)
  expect(await llmManager.igniteEngine('google')).toBeInstanceOf(Google)
  expect(await llmManager.igniteEngine('xai')).toBeInstanceOf(XAI)
  expect(await llmManager.igniteEngine('groq')).toBeInstanceOf(Groq)
  expect(await llmManager.igniteEngine('cerebras')).toBeInstanceOf(Cerebras)
  expect(await llmManager.igniteEngine('deepseek')).toBeInstanceOf(DeepSeek)
  expect(await llmManager.igniteEngine('openrouter')).toBeInstanceOf(OpenRouter)
  expect(await llmManager.igniteEngine('aws')).toBeInstanceOf(OpenAI)
})

test('Ignite Favorite Engine', async () => {
  store.config.llm.favorites = [ { id: '1', engine: 'anthropic', model: 'chat1' } ]
  store.config.engines[favoriteMockEngine].model.chat = '1'
  expect(await llmManager.igniteEngine(favoriteMockEngine)).toBeInstanceOf(Anthropic)
  // fallback
  store.config.engines[favoriteMockEngine].model.chat = '2'
  expect(await llmManager.igniteEngine(favoriteMockEngine)).toBeInstanceOf(OpenAI)
})

test('Ignite Custom Engine OpenAI', async () => {
  const engine = await llmManager.igniteEngine('custom1')
  expect(engine).toBeInstanceOf(OpenAI)
  expect(engine.config.apiKey).toBe('456')
  expect(engine.config.baseURL).toBe('http://localhost/api/v1')
})

test('Ignite Custom Engine Azure', async () => {
  const engine = await llmManager.igniteEngine('custom2')
  expect(engine).toBeInstanceOf(Azure)
  expect(engine.config.apiKey).toBe('789')
  expect(engine.config.baseURL).toBe('http://witsy.azure.com/')
  expect(engine.config.deployment).toBe('witsy_deployment')
  expect(engine.config.apiVersion).toBe('2024-04-03')
})

test('No vision models for custom engine', () => {
  expect(llmManager.hasVisionModels('custom1')).toBe(false)
  expect(llmManager.isVisionModel('custom1', 'vision')).toBe(false)  
})

test('Anthropic Computer Use', async () => {
  const anthropic = await llmManager.igniteEngine('anthropic')
  expect(anthropic['computerInfo']).not.toBeNull()
})

test('Reflects configuration changes', () => {
  defaults.engines.openai.apiKey = '345'
  store.loadSettings()
  expect(llmManager.config.engines.openai.apiKey).toBe('345')
})

test('getChatEngineModel', () => {
  store.config.llm.engine = 'mock'
  store.config.engines.mock = { model: { chat: 'chat1' } }
  expect(llmManager.getChatEngineModel(true)).toStrictEqual({ engine: 'mock', model: 'chat1' })
  store.config.llm.engine = favoriteMockEngine
  store.config.engines[favoriteMockEngine] = { model: { chat: 'mock-chat2' } }
  expect(llmManager.getChatEngineModel(true)).toStrictEqual({ engine: 'mock', model: 'chat2' })
})

test('Favorite engine', () => {
  expect(llmManager.isFavoriteEngine(favoriteMockEngine)).toBe(true)
  expect(llmManager.isFavoriteEngine('openai')).toBe(false)
  expect(llmManager.isFavoriteEngine('mock')).toBe(false)
})

test('Favorite Ids', () => {
  expect(llmManager.getFavoriteId('mock', 'chat')).toBe('mock-chat')
  expect(llmManager.isFavoriteId('mock-chat1')).toBe(true)
  expect(llmManager.isFavoriteId('mocq-chat1')).toBe(false)
  expect(llmManager.isFavoriteId('mock-chat3')).toBe(false)
})

test('Favorite models', () => {
  
  store.config.engines['mock'] = {
    label: 'mock_label',
    model: { chat: '' }
  }

  expect(llmManager.getChatModels(favoriteMockEngine)).toStrictEqual([
    { id: 'mock-chat1', name: 'mock_label/chat1', meta: {} },
    { id: 'mock-chat2', name: 'mock_label/chat2', meta: {} }
  ])

  expect(llmManager.isFavoriteModel('mock', 'chat1')).toBe(true)
  expect(llmManager.isFavoriteModel('mocq', 'chat1')).toBe(false)
  expect(llmManager.isFavoriteModel('mock', 'chat3')).toBe(false)

  expect(llmManager.getFavoriteModel('mock-chat1')).toStrictEqual({ engine: 'mock', model: 'chat1' })
  expect(llmManager.getFavoriteModel('mock-chat2')).toStrictEqual({ engine: 'mock', model: 'chat2' })
  expect(llmManager.getFavoriteModel('mocq-chat1')).toBeNull()
  expect(llmManager.getFavoriteModel('mock-chat3')).toBeNull()

})

test('Favorites update', () => {

  store.config.engines['mock'] = {
    label: 'mock_label',
    model: { chat: '' }
  }

  llmManager.addFavoriteModel('mock', 'chat3')
  expect(llmManager.getChatModels(favoriteMockEngine)).toStrictEqual([
    { id: 'mock-chat1', name: 'mock_label/chat1', meta: {} },
    { id: 'mock-chat2', name: 'mock_label/chat2', meta: {} },
    { id: 'mock-chat3', name: 'mock_label/chat3', meta: {} }
  ])

  llmManager.removeFavoriteModel(favoriteMockEngine, 'mock-chat2')
  expect(llmManager.getChatModels(favoriteMockEngine)).toStrictEqual([
    { id: 'mock-chat1', name: 'mock_label/chat1', meta: {} },
    { id: 'mock-chat3', name: 'mock_label/chat3', meta: {} }
  ])

  llmManager.removeFavoriteModel('mock', 'chat3')
  expect(llmManager.getChatModels(favoriteMockEngine)).toStrictEqual([
    { id: 'mock-chat1', name: 'mock_label/chat1', meta: {} }
  ])

  store.config.llm.engine = favoriteMockEngine
  llmManager.removeFavoriteModel('mock', 'chat1')
  expect(llmManager.getChatModels(favoriteMockEngine)).toStrictEqual([])
  expect(store.config.llm.engine).toBe('mock')
  expect(store.config.engines['mock'].model.chat).toBe('chat1')
  
})

test('Load tools', async () => {

  const plugins = {
    plugin1: Plugin1,
    plugin2: Plugin2,
    plugin3: Plugin3,
  }

  const engine = await llmManager.igniteEngine('openai')
  expect(engine.plugins).toHaveLength(0)

  await llmManager.loadTools(engine, plugins, null)
  expect(engine.plugins).toHaveLength(3)
  expect((engine.plugins[2] as MultiToolPlugin).toolsEnabled).toBeNull()

  await llmManager.loadTools(engine, plugins, [])
  expect(engine.plugins).toHaveLength(0)

  await llmManager.loadTools(engine, plugins, ['plugin1'])
  expect(engine.plugins).toHaveLength(1)

  await llmManager.loadTools(engine, plugins, ['plugin1', 'plugin2'])
  expect(engine.plugins).toHaveLength(2)

  await llmManager.loadTools(engine, plugins, ['plugin1', 'plugin2', 'tool1'])
  expect(engine.plugins).toHaveLength(3)
  expect((engine.plugins[2] as MultiToolPlugin).toolsEnabled).toStrictEqual(['tool1'])

  await llmManager.loadTools(engine, plugins, ['plugin1', 'plugin2', 'tool1', 'tool2'])
  expect(engine.plugins).toHaveLength(3)
  expect((engine.plugins[2] as MultiToolPlugin).toolsEnabled).toStrictEqual(['tool1', 'tool2'])

})
