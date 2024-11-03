
import { vi, expect, test } from 'vitest'
import { ModelsList, loadAnthropicModels, loadCerebrasModels, loadGoogleModels, loadGroqModels, loadMistralAIModels, loadOllamaModels, loadOpenAIModels, loadXAIModels }from 'multi-llm-ts'
import { store } from '../../src/services/store'
import LlmFactory from '../../src/llms/llm'

vi.mock('multi-llm-ts', async (importOriginal) => {
  const mod: any = await importOriginal()
  return {
    ...mod,
    loadAnthropicModels: vi.fn((): ModelsList => ({ chat: [], image: [] })),
    loadCerebrasModels: vi.fn((): ModelsList => ({ chat: [], image: [] })),
    loadGoogleModels: vi.fn((): ModelsList => ({ chat: [], image: [] })),
    loadGroqModels: vi.fn((): ModelsList => ({ chat: [], image: [] })),
    loadMistralAIModels: vi.fn((): ModelsList => ({ chat: [], image: [] })),
    loadOllamaModels: vi.fn((): ModelsList => ({ chat: [], image: [] })),
    loadOpenAIModels: vi.fn((): ModelsList => ({ chat: [], image: [] })),
    loadXAIModels: vi.fn((): ModelsList => ({ chat: [], image: [] })),
  }
})

window.api = {
  config: {
    save: vi.fn()
  },
  computer: {
    isAvailable: () => true,
  }
}

store.config = {
  engines: {
    anthropic: {},
    cerebras: {},
    google: {},
    groq: {},
    mistralai: {},
    ollama: {},
    openai: {},
    xai: {},
  },
  plugins: {
    computer: {}
  }
}

const llmFactory = new LlmFactory(store.config)

test('Load models', async () => {
  await llmFactory.loadModels('anthropic')
  expect(loadAnthropicModels).toHaveBeenCalledTimes(1)
  expect(window.api.config?.save).toHaveBeenCalledTimes(1)
  
  await llmFactory.loadModels('cerebras')
  expect(loadCerebrasModels).toHaveBeenCalledTimes(1)
  expect(window.api.config?.save).toHaveBeenCalledTimes(2)
  
  await llmFactory.loadModels('google')
  expect(loadGoogleModels).toHaveBeenCalledTimes(1)
  expect(window.api.config?.save).toHaveBeenCalledTimes(3)
  
  await llmFactory.loadModels('groq')
  expect(loadGroqModels).toHaveBeenCalledTimes(1)
  expect(window.api.config?.save).toHaveBeenCalledTimes(4)
  
  await llmFactory.loadModels('mistralai')
  expect(loadMistralAIModels).toHaveBeenCalledTimes(1)
  expect(window.api.config?.save).toHaveBeenCalledTimes(5)
  
  await llmFactory.loadModels('ollama')
  expect(loadOllamaModels).toHaveBeenCalledTimes(1)
  expect(window.api.config?.save).toHaveBeenCalledTimes(6)
  
  await llmFactory.loadModels('openai')
  expect(loadOpenAIModels).toHaveBeenCalledTimes(1)
  expect(window.api.config?.save).toHaveBeenCalledTimes(7)
  
  await llmFactory.loadModels('xai')
  expect(loadXAIModels).toHaveBeenCalledTimes(1)
  expect(window.api.config?.save).toHaveBeenCalledTimes(8)
})
