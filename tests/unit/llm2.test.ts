
import { vi, expect, test } from 'vitest'
import * as _MultiLLM from 'multi-llm-ts'
import { store } from '../../src/services/store'
import LlmFactory from '../../src/llms/llm'

vi.mock('multi-llm-ts', async (importOriginal) => {
  const mod: any = await importOriginal()
  return {
    ...mod,
    loadAnthropicModels: vi.fn(() => []),
    loadCerebrasModels: vi.fn(() => []),
    loadGoogleModels: vi.fn(() => []),
    loadGroqModels: vi.fn(() => []),
    loadMistralAIModels: vi.fn(() => []),
    loadOllamaModels: vi.fn(() => []),
    loadOpenAIModels: vi.fn(() => []),
    loadXAIModels: vi.fn(() => []),
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
  expect(_MultiLLM.loadAnthropicModels).toHaveBeenCalledTimes(1)
  expect(window.api.config.save).toHaveBeenCalledTimes(1)
  
  await llmFactory.loadModels('cerebras')
  expect(_MultiLLM.loadCerebrasModels).toHaveBeenCalledTimes(1)
  expect(window.api.config.save).toHaveBeenCalledTimes(2)
  
  await llmFactory.loadModels('google')
  expect(_MultiLLM.loadGoogleModels).toHaveBeenCalledTimes(1)
  expect(window.api.config.save).toHaveBeenCalledTimes(3)
  
  await llmFactory.loadModels('groq')
  expect(_MultiLLM.loadGroqModels).toHaveBeenCalledTimes(1)
  expect(window.api.config.save).toHaveBeenCalledTimes(4)
  
  await llmFactory.loadModels('mistralai')
  expect(_MultiLLM.loadMistralAIModels).toHaveBeenCalledTimes(1)
  expect(window.api.config.save).toHaveBeenCalledTimes(5)
  
  await llmFactory.loadModels('ollama')
  expect(_MultiLLM.loadOllamaModels).toHaveBeenCalledTimes(1)
  expect(window.api.config.save).toHaveBeenCalledTimes(6)
  
  await llmFactory.loadModels('openai')
  expect(_MultiLLM.loadOpenAIModels).toHaveBeenCalledTimes(1)
  expect(window.api.config.save).toHaveBeenCalledTimes(7)
  
  await llmFactory.loadModels('xai')
  expect(_MultiLLM.loadXAIModels).toHaveBeenCalledTimes(1)
  expect(window.api.config.save).toHaveBeenCalledTimes(8)
})
