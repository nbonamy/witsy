
import { vi, beforeAll, beforeEach, expect, test } from 'vitest'
import { useWindowMock } from '../mocks/window'
import { store } from '../../src/services/store'
import LlmFactory from '../../src/llms/llm'
import {
  ModelsList, loadAnthropicModels, loadCerebrasModels, loadGoogleModels, loadGroqModels, loadMistralAIModels,
  loadOllamaModels, loadOpenAIModels, loadXAIModels, loadDeepSeekModels, loadOpenRouterModels
} from 'multi-llm-ts'

vi.mock('multi-llm-ts', async (importOriginal) => {
  const mod: any = await importOriginal()
  return {
    ...mod,
    loadAnthropicModels: vi.fn((): ModelsList => ({ chat: [], image: [] })),
    loadCerebrasModels: vi.fn((): ModelsList => ({ chat: [ { id: 'chat', name: 'chat' } ], image: [] })),
    loadGoogleModels: vi.fn((): ModelsList => ({ chat: [], image: [ { id: 'image', name: 'image' } ] })),
    loadGroqModels: vi.fn((): ModelsList => ({ chat: [ { id: 'chat', name: 'chat' } ], image: [{ id: 'image', name: 'image' }] })),
    loadMistralAIModels: vi.fn((): ModelsList => ({ chat: [], image: [] })),
    loadOllamaModels: vi.fn((): ModelsList => ({ chat: [], image: [] })),
    loadOpenAIModels: vi.fn((): ModelsList => ({ chat: [ { id: 'chat', name: 'chat' } ], image: [{ id: 'image', name: 'image' }] })),
    loadXAIModels: vi.fn((): ModelsList => ({ chat: [], image: [] })),
    loadDeepSeekModels: vi.fn((): ModelsList => ({ chat: [], image: [] })),
    loadOpenRouterModels: vi.fn((): ModelsList => ({ chat: [], image: [] }))
  }
})

let llmFactory: LlmFactory

beforeAll(() => {
  useWindowMock({ customEngine: true })
  llmFactory = new LlmFactory(store.config)
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
  await llmFactory.initModels()
  expect(loadAnthropicModels).toHaveBeenCalledTimes(1)
  expect(loadCerebrasModels).toHaveBeenCalledTimes(1)
  expect(loadGoogleModels).toHaveBeenCalledTimes(1)
  expect(loadGroqModels).toHaveBeenCalledTimes(1)
  expect(loadMistralAIModels).toHaveBeenCalledTimes(0)
  expect(loadOllamaModels).toHaveBeenCalledTimes(0)
  expect(loadOpenAIModels).toHaveBeenCalledTimes(0)
  expect(loadXAIModels).toHaveBeenCalledTimes(1)
  expect(loadDeepSeekModels).toHaveBeenCalledTimes(1)
  expect(loadOpenRouterModels).toHaveBeenCalledTimes(0)
})

test('Load models', async () => {
  await llmFactory.loadModels('anthropic')
  expect(loadAnthropicModels).toHaveBeenCalledTimes(1)
  expect(window.api.config?.save).toHaveBeenCalledTimes(0)
  
  await llmFactory.loadModels('cerebras')
  expect(loadCerebrasModels).toHaveBeenCalledTimes(1)
  expect(window.api.config?.save).toHaveBeenCalledTimes(1)
  
  await llmFactory.loadModels('google')
  expect(loadGoogleModels).toHaveBeenCalledTimes(1)
  expect(window.api.config?.save).toHaveBeenCalledTimes(2)
  
  await llmFactory.loadModels('groq')
  expect(loadGroqModels).toHaveBeenCalledTimes(1)
  expect(window.api.config?.save).toHaveBeenCalledTimes(3)
  
  await llmFactory.loadModels('mistralai')
  expect(loadMistralAIModels).toHaveBeenCalledTimes(1)
  expect(window.api.config?.save).toHaveBeenCalledTimes(3)
  
  await llmFactory.loadModels('ollama')
  expect(loadOllamaModels).toHaveBeenCalledTimes(1)
  expect(window.api.config?.save).toHaveBeenCalledTimes(3)
  
  await llmFactory.loadModels('openai')
  expect(loadOpenAIModels).toHaveBeenCalledTimes(1)
  expect(window.api.config?.save).toHaveBeenCalledTimes(4)
  
  await llmFactory.loadModels('xai')
  expect(loadXAIModels).toHaveBeenCalledTimes(1)
  expect(window.api.config?.save).toHaveBeenCalledTimes(4)

  await llmFactory.loadModels('deepseek')
  expect(loadDeepSeekModels).toHaveBeenCalledTimes(1)
  expect(window.api.config?.save).toHaveBeenCalledTimes(4)

  await llmFactory.loadModels('openrouter')
  expect(loadOpenRouterModels).toHaveBeenCalledTimes(1)
  expect(window.api.config?.save).toHaveBeenCalledTimes(4)

  await llmFactory.loadModels('custom')
  expect(loadOpenAIModels).toHaveBeenCalledTimes(2)
  expect(loadOpenAIModels).toHaveBeenLastCalledWith({
    apiKey: '456',
    baseURL: 'http://localhost/api/v1',
    models: { chat: [], image: [] }
  })
  expect(window.api.config?.save).toHaveBeenCalledTimes(5)

})
