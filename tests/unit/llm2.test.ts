
import { vi, expect, test } from 'vitest'
import { loadModels } from '../../src/llms/llm'
import * as _MultiLLM from 'multi-llm-ts'
import { store } from '../../src/services/store'

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
  }
}

test('Load models', async () => {
  await loadModels('anthropic')
  expect(_MultiLLM.loadAnthropicModels).toHaveBeenCalledTimes(1)
  expect(window.api.config.save).toHaveBeenCalledTimes(1)
  
  await loadModels('cerebras')
  expect(_MultiLLM.loadCerebrasModels).toHaveBeenCalledTimes(1)
  expect(window.api.config.save).toHaveBeenCalledTimes(2)
  
  await loadModels('google')
  expect(_MultiLLM.loadGoogleModels).toHaveBeenCalledTimes(1)
  expect(window.api.config.save).toHaveBeenCalledTimes(3)
  
  await loadModels('groq')
  expect(_MultiLLM.loadGroqModels).toHaveBeenCalledTimes(1)
  expect(window.api.config.save).toHaveBeenCalledTimes(4)
  
  await loadModels('mistralai')
  expect(_MultiLLM.loadMistralAIModels).toHaveBeenCalledTimes(1)
  expect(window.api.config.save).toHaveBeenCalledTimes(5)
  
  await loadModels('ollama')
  expect(_MultiLLM.loadOllamaModels).toHaveBeenCalledTimes(1)
  expect(window.api.config.save).toHaveBeenCalledTimes(6)
  
  await loadModels('openai')
  expect(_MultiLLM.loadOpenAIModels).toHaveBeenCalledTimes(1)
  expect(window.api.config.save).toHaveBeenCalledTimes(7)
  
  await loadModels('xai')
  expect(_MultiLLM.loadXAIModels).toHaveBeenCalledTimes(1)
  expect(window.api.config.save).toHaveBeenCalledTimes(8)
})
