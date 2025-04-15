
import { vi, beforeAll, beforeEach, expect, test } from 'vitest'
import { useWindowMock } from '../mocks/window'
import { store } from '../../src/services/store'
import LlmFactory, { ILlmManager } from '../../src/llms/llm'
import {
  ModelsList, loadAnthropicModels, loadCerebrasModels, loadGoogleModels, loadGroqModels, loadMistralAIModels,
  loadOllamaModels, loadOpenAIModels, loadAzureModels, loadXAIModels, loadDeepSeekModels, loadOpenRouterModels
} from 'multi-llm-ts'

vi.mock('multi-llm-ts', async (importOriginal) => {
  const mod: any = await importOriginal()
  return {
    ...mod,
    loadAnthropicModels: vi.fn((): ModelsList => ({ chat: [], image: [] })),
    loadAzureModels: vi.fn((): ModelsList => ({ chat: [], image: [] })),
    loadCerebrasModels: vi.fn((): ModelsList => ({ chat: [ { id: 'chat', name: 'chat' } ], image: [] })),
    loadDeepSeekModels: vi.fn((): ModelsList => ({ chat: [], image: [] })),
    loadGoogleModels: vi.fn((): ModelsList => ({ chat: [], image: [ { id: 'image', name: 'image' } ] })),
    loadGroqModels: vi.fn((): ModelsList => ({ chat: [ { id: 'chat', name: 'chat' } ], image: [{ id: 'image', name: 'image' }] })),
    loadMistralAIModels: vi.fn((): ModelsList => ({ chat: [], image: [] })),
    loadOllamaModels: vi.fn((): ModelsList => ({ chat: [], image: [] })),
    loadOpenAIModels: vi.fn((): ModelsList => ({ chat: [ { id: 'chat', name: 'chat' } ], image: [{ id: 'image', name: 'image' }] })),
    loadOpenRouterModels: vi.fn((): ModelsList => ({ chat: [], image: [] })),
    loadXAIModels: vi.fn((): ModelsList => ({ chat: [], image: [] })),
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
