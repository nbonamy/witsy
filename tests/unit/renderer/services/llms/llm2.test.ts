
import { vi, beforeAll, beforeEach, expect, test } from 'vitest'
import { useWindowMock } from '@tests/mocks/window'
import { store } from '@services/store'
import LlmFactory, { ILlmManager } from '@services/llms/llm'
import {
  ModelsList, loadAnthropicModels, loadCerebrasModels, loadGoogleModels, loadGroqModels, loadMistralAIModels,
  loadOllamaModels, loadOpenAIModels, loadAzureModels, loadXAIModels, loadDeepSeekModels, loadOpenRouterModels,
  defaultCapabilities
} from 'multi-llm-ts'
import LlmManagerBase from '@services/llms/base'
import OpenRouter from '@services/llms/openrouter'
import { EngineConfig } from 'types/config'

vi.mock('multi-llm-ts', async (importOriginal) => {
  const mod: any = await importOriginal()
  return {
    ...mod,
    loadAnthropicModels: vi.fn((): ModelsList => ({ chat: [], image: [] })),
    loadAzureModels: vi.fn((): ModelsList => ({ chat: [], image: [] })),
    loadCerebrasModels: vi.fn((): ModelsList => ({ chat: [ { id: 'chat', name: 'chat', capabilities: defaultCapabilities.capabilities } ], image: [] })),
    loadDeepSeekModels: vi.fn((): ModelsList => ({ chat: [], image: [] })),
    loadGoogleModels: vi.fn((): ModelsList => ({ chat: [], image: [ { id: 'image', name: 'image' } ] })),
    loadGroqModels: vi.fn((): ModelsList => ({ chat: [ { id: 'chat', name: 'chat', capabilities: defaultCapabilities.capabilities } ], image: [{ id: 'image', name: 'image' }] })),
    loadMistralAIModels: vi.fn((): ModelsList => ({ chat: [], image: [] })),
    loadOllamaModels: vi.fn((): ModelsList => ({ chat: [], image: [] })),
    loadOpenAIModels: vi.fn((): ModelsList => ({
      chat: [
        { id: 'o1', name: 'o1', capabilities: defaultCapabilities.capabilities },
        { id: 'gpt-4o', name: 'gpt-4o', capabilities: defaultCapabilities.capabilities },
        { id: 'gpt-5.2', name: 'gpt-5.2', capabilities: defaultCapabilities.capabilities },
      ],
      image: [
        { id: 'image', name: 'image' }
      ]
    })),
    loadOpenRouterModels: vi.fn((): ModelsList => ({ chat: [], image: [] })),
    loadXAIModels: vi.fn((): ModelsList => ({ chat: [], image: [], video: [] })),
  }
})

let llmManager: ILlmManager

beforeAll(() => {
  useWindowMock({ customEngine: true })
  llmManager = LlmFactory.manager(store.config)
})

beforeEach(() => {
  vi.clearAllMocks()
  store.loadSettings()
  store.config.engines.openai.apiKey = '123'
  store.config.engines.anthropic.apiKey = '123'
  store.config.engines.cerebras.apiKey = '123'
  store.config.engines.google.apiKey = '123'
  store.config.engines.groq.apiKey = '123'
  store.config.engines.mistralai.apiKey = '123'
  store.config.engines.ollama.apiKey = '123'
  store.config.engines.xai.apiKey =
  store.config.engines.deepseek.apiKey = '123'
  store.config.engines.openrouter.apiKey = '123'
})

test('Init models', async () => {
  await llmManager.initModels()
  expect(loadAnthropicModels).toHaveBeenCalledTimes(0)
  expect(loadCerebrasModels).toHaveBeenCalledTimes(0)
  expect(loadGoogleModels).toHaveBeenCalledTimes(0)
  expect(loadGroqModels).toHaveBeenCalledTimes(0)
  expect(loadMistralAIModels).toHaveBeenCalledTimes(0)
  expect(loadOllamaModels).toHaveBeenCalledTimes(0)
  expect(loadOpenAIModels).toHaveBeenCalledTimes(0)
  expect(loadXAIModels).toHaveBeenCalledTimes(0)
  expect(loadDeepSeekModels).toHaveBeenCalledTimes(0)
  expect(loadOpenRouterModels).toHaveBeenCalledTimes(0)
})

test('Selects valid model', async () => {

  await llmManager.loadModels('openai')
  const manager = llmManager as LlmManagerBase

  // when current model is valid
  store.config.engines.openai.model.chat = 'gpt-4o'
  manager.selectValidModel('openai', store.config.engines.openai, 'chat')
  expect(store.config.engines.openai.model.chat).toBe('gpt-4o')

  // when current model is not valid, fallback to defaults
  store.config.engines.openai.model.chat = 'chat'
  manager.selectValidModel('openai', store.config.engines.openai, 'chat')
  expect(store.config.engines.openai.model.chat).toBe('gpt-5.2')

  // when both are invalid, fallback to 1st model
  store.config.engines.openai.model.chat = 'chat'
  store.config.engines.openai.models.chat.pop()
  manager.selectValidModel('openai', store.config.engines.openai, 'chat')
  expect(store.config.engines.openai.model.chat).toBe('o1')

  // when no models, no change in value
  store.config.engines.openai.model.chat = 'chat'
  store.config.engines.openai.models.chat = []
  manager.selectValidModel('openai', store.config.engines.openai, 'chat')
  expect(store.config.engines.openai.model.chat).toBe('chat')

})

test('Load models', async () => {
  await llmManager.loadModels('anthropic')
  expect(loadAnthropicModels).toHaveBeenCalledTimes(1)
  expect(window.api.config?.save).toHaveBeenCalledTimes(0)
  
  await llmManager.loadModels('cerebras')
  expect(loadCerebrasModels).toHaveBeenCalledTimes(1)
  expect(window.api.config?.save).toHaveBeenCalledTimes(1)
  
  await llmManager.loadModels('google')
  expect(loadGoogleModels).toHaveBeenCalledTimes(1)
  expect(window.api.config?.save).toHaveBeenCalledTimes(2)
  
  await llmManager.loadModels('groq')
  expect(loadGroqModels).toHaveBeenCalledTimes(1)
  expect(window.api.config?.save).toHaveBeenCalledTimes(3)

  await llmManager.loadModels('mistralai')
  expect(loadMistralAIModels).toHaveBeenCalledTimes(1)
  expect(window.api.config?.save).toHaveBeenCalledTimes(3)

  await llmManager.loadModels('ollama')
  expect(loadOllamaModels).toHaveBeenCalledTimes(1)
  expect(window.api.config?.save).toHaveBeenCalledTimes(3)

  await llmManager.loadModels('openai')
  expect(loadOpenAIModels).toHaveBeenCalledTimes(1)
  expect(window.api.config?.save).toHaveBeenCalledTimes(4)
  
  await llmManager.loadModels('xai')
  expect(loadXAIModels).toHaveBeenCalledTimes(1)
  expect(window.api.config?.save).toHaveBeenCalledTimes(4)

  await llmManager.loadModels('deepseek')
  expect(loadDeepSeekModels).toHaveBeenCalledTimes(1)
  expect(window.api.config?.save).toHaveBeenCalledTimes(4)

  await llmManager.loadModels('openrouter')
  expect(loadOpenRouterModels).toHaveBeenCalledTimes(1)
  expect(window.api.config?.save).toHaveBeenCalledTimes(4)

  await llmManager.loadModels('custom1')
  expect(loadOpenAIModels).toHaveBeenCalledTimes(2)
  expect(loadOpenAIModels).toHaveBeenLastCalledWith({
    apiKey: '456',
    baseURL: 'http://localhost/api/v1',
    models: { chat: [], image: [] }
  })
  expect(window.api.config?.save).toHaveBeenCalledTimes(5)

  await llmManager.loadModels('custom2')
  expect(loadAzureModels).toHaveBeenCalledTimes(1)
  expect(loadAzureModels).toHaveBeenLastCalledWith({
    apiKey: '789',
    baseURL: 'http://witsy.azure.com/',
    deployment: 'witsy_deployment',
    apiVersion: '2024-04-03',
  })
  expect(window.api.config?.save).toHaveBeenCalledTimes(6)

})

test('Can process format', async () => {

  store.config.engines.openrouter = {
    models: {
      chat: [
        { id: 'chat', name: 'chat', capabilities: { vision: false, tools: true, reasoning: false, caching: false } }, 
        { id: 'vision', name: 'vision', capabilities: { vision: true, tools: true, reasoning: false, caching: false } }, 
      ],
      image: []
    },
    model: {
    }
  }

  // text formats are supported
  expect(llmManager.canProcessFormat('openrouter', 'chat', 'py')).toBe(true)
  expect(llmManager.canProcessFormat('openrouter', 'chat', 'js')).toBe(true)
  expect(llmManager.canProcessFormat('openrouter', 'chat', 'ts')).toBe(true)
  expect(llmManager.canProcessFormat('openrouter', 'chat', 'txt')).toBe(true)
  expect(llmManager.canProcessFormat('openrouter', 'chat', 'json')).toBe(true)
  expect(llmManager.canProcessFormat('openrouter', 'chat', 'html')).toBe(true)
  expect(llmManager.canProcessFormat('openrouter', 'chat', 'pdf')).toBe(true)
  expect(llmManager.canProcessFormat('openrouter', 'chat', 'docx')).toBe(true)
  expect(llmManager.canProcessFormat('openrouter', 'chat', 'xlsx')).toBe(true)
  expect(llmManager.canProcessFormat('openrouter', 'chat', 'pptx')).toBe(true)

  // some other binary formats
  expect(llmManager.canProcessFormat('openrouter', 'chat', 'exe')).toBe(false)
  expect(llmManager.canProcessFormat('openrouter', 'chat', 'mp3')).toBe(false)
  expect(llmManager.canProcessFormat('openrouter', 'chat', 'wav')).toBe(false)
  expect(llmManager.canProcessFormat('openrouter', 'chat', 'zip')).toBe(false)
  expect(llmManager.canProcessFormat('openrouter', 'chat', 'dmg')).toBe(false)
  expect(llmManager.canProcessFormat('openrouter', 'chat', 'xsl')).toBe(false)
  expect(llmManager.canProcessFormat('openrouter', 'chat', 'doc')).toBe(false)
  expect(llmManager.canProcessFormat('openrouter', 'chat', 'ppt')).toBe(false)

  // without autoVisionSwitch
  expect(llmManager.canProcessFormat('openrouter', 'chat', 'jpg')).toBe(false)
  expect(llmManager.canProcessFormat('openrouter', 'vision', 'jpg')).toBe(true)

  // with autoVisionSwitch
  store.config.engines.openrouter.model.vision = 'vision'
  expect(llmManager.canProcessFormat('openrouter', 'chat', 'jpg')).toBe(true)
  expect(llmManager.canProcessFormat('openrouter', 'vision', 'jpg')).toBe(true)

})

test('OpenRouter getCompletionOpts', () => {

  store.config.engines.openrouter = {
    apiKey: '123',
  } as EngineConfig

  const llmManager = LlmFactory.manager(store.config)
  const openrouter = llmManager.igniteEngine('openrouter') as OpenRouter
  
  const opts1 = openrouter.getCompletionOpts({ id: 'model', name: 'model', capabilities: defaultCapabilities.capabilities })
  // @ts-expect-error openai api
  expect(opts1?.provider).toBeUndefined()
  
  store.config.engines.openrouter.providerOrder = 'provider1\nprovider2'  
  const opts2 = openrouter.getCompletionOpts({ id: 'model', name: 'model', capabilities: defaultCapabilities.capabilities })

  // @ts-expect-error openai api
  expect(opts2.provider.allow_fallbacks).toBe(true)
  // @ts-expect-error openai api
  expect(opts2.provider.order).toStrictEqual(['provider1', 'provider2'])

})
