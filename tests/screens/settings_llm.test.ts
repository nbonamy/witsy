
import { vi, beforeAll, beforeEach, expect, test } from 'vitest'
import { mount, VueWrapper } from '@vue/test-utils'
import { useWindowMock, useBrowserMock } from '../mocks/window'
import { store } from '../../src/services/store'
import { switchToTab } from './settings_utils'
import Settings from '../../src/screens/Settings.vue'
import { wait } from '../../src/main/utils'
import {
  ModelsList, loadAnthropicModels, loadCerebrasModels, loadGoogleModels, loadGroqModels, loadMistralAIModels,
  loadOllamaModels, loadOpenAIModels, loadXAIModels, loadDeepSeekModels, loadOpenRouterModels
} from 'multi-llm-ts'

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
    loadDeepSeekModels: vi.fn((): ModelsList => ({ chat: [], image: [] })),
    loadOpenRouterModels: vi.fn((): ModelsList => ({ chat: [], image: [] }))
  }
})

let wrapper: VueWrapper<any>
const llmIndex = 5

beforeAll(() => {
  useWindowMock()
  useBrowserMock()
  store.loadSettings()
    
  // wrapper
  document.body.innerHTML = `<dialog id="settings"></dialog>`
  wrapper = mount(Settings, { attachTo: '#settings' })
})

beforeEach(async () => {
  vi.clearAllMocks()
})

test('should render', async () => {
  const tab = await switchToTab(wrapper, llmIndex)
  expect(tab.find('.list-panel').exists()).toBeTruthy()
  expect(tab.findComponent({ name: 'SettingsOpenAI' }).exists()).toBeTruthy()
})

test('openai settings', async () => {
  const tab = await switchToTab(wrapper, llmIndex)
  const openai = tab.findComponent({ name: 'SettingsOpenAI' })
  await openai.findAll('input')[1].setValue('base-url')
  await openai.findAll('input')[1].trigger('blur')
  expect(store.config.engines.openai.baseURL).toBe('base-url')
  await openai.findAll('input')[0].setValue('api-key')
  await openai.findAll('input')[0].trigger('blur')
  expect(store.config.engines.openai.apiKey).toBe('api-key')
  expect(loadOpenAIModels).toHaveBeenLastCalledWith(expect.objectContaining({
    apiKey: 'api-key',
    baseURL: 'base-url'
  }))
})

test('anthropic settings', async () => {
  const tab = await switchToTab(wrapper, llmIndex)
  await tab.find('.list-panel .list .item:nth-child(2)').trigger('click')
  const anthropic = tab.findComponent({ name: 'SettingsAnthropic' })
  await anthropic.find('input').setValue('api-key')
  await anthropic.find('input').trigger('blur')
  await tab.vm.$nextTick()
  expect(store.config.engines.anthropic.apiKey).toBe('api-key')
  expect(loadAnthropicModels).toHaveBeenLastCalledWith(expect.objectContaining({
    apiKey: 'api-key'
  }), expect.anything())
})

test('google settings', async () => {
  const tab = await switchToTab(wrapper, llmIndex)
  await tab.find('.list-panel .list .item:nth-child(3)').trigger('click')
  await tab.vm.$nextTick()
  const google = tab.findComponent({ name: 'SettingsGoogle' })
  await google.find('input').setValue('api-key')
  await google.find('input').trigger('blur')
  expect(store.config.engines.google.apiKey).toBe('api-key')
  expect(loadGoogleModels).toHaveBeenLastCalledWith(expect.objectContaining({
    apiKey: 'api-key'
  }))
})

test('xai settings', async () => {
  const tab = await switchToTab(wrapper, llmIndex)
  await tab.find('.list-panel .list .item:nth-child(4)').trigger('click')
  await tab.vm.$nextTick()
  const xai = tab.findComponent({ name: 'SettingsXAI' })
  await xai.find('input').setValue('api-key')
  await xai.find('input').trigger('blur')
  expect(store.config.engines.xai.apiKey).toBe('api-key')
  expect(loadXAIModels).toHaveBeenLastCalledWith(expect.objectContaining({
    apiKey: 'api-key'
  }))
})

test('ollama settings', async () => {
  const tab = await switchToTab(wrapper, llmIndex)
  await tab.find('.list-panel .list .item:nth-child(5)').trigger('click')
  await tab.vm.$nextTick()
  const ollama = tab.findComponent({ name: 'SettingsOllama' })
  await ollama.findAll('input')[1].setValue('base-url')
  await ollama.findAll('input')[1].trigger('blur')
  expect(store.config.engines.ollama.baseURL).toBe('base-url')
  await ollama.findAll('button')[1].trigger('click')
  await wait(750) //timeout
  expect(loadOllamaModels).toHaveBeenLastCalledWith(expect.objectContaining({
  }))
})

test('mistralai settings', async () => {
  const tab = await switchToTab(wrapper, llmIndex)
  await tab.find('.list-panel .list .item:nth-child(6)').trigger('click')
  await tab.vm.$nextTick()
  const mistralai = tab.findComponent({ name: 'SettingsMistralAI' })
  await mistralai.find('input').setValue('api-key')
  await mistralai.find('input').trigger('blur')
  expect(store.config.engines.mistralai.apiKey).toBe('api-key')
  expect(loadMistralAIModels).toHaveBeenLastCalledWith(expect.objectContaining({
    apiKey: 'api-key'
  }))
})

test('deepseek settings', async () => {
  const tab = await switchToTab(wrapper, llmIndex)
  await tab.find('.list-panel .list .item:nth-child(7)').trigger('click')
  await tab.vm.$nextTick()
  const deepseek = tab.findComponent({ name: 'SettingsDeepSeek' })
  await deepseek.find('input').setValue('api-key')
  await deepseek.find('input').trigger('blur')
  expect(store.config.engines.deepseek.apiKey).toBe('api-key')
  expect(loadDeepSeekModels).toHaveBeenLastCalledWith(expect.objectContaining({
    apiKey: 'api-key'
  }))
})

test('openrouter settings', async () => {
  const tab = await switchToTab(wrapper, llmIndex)
  await tab.find('.list-panel .list .item:nth-child(8)').trigger('click')
  await tab.vm.$nextTick()
  const openrouter = tab.findComponent({ name: 'SettingsOpenRouter' })
  await openrouter.find('input').setValue('api-key')
  await openrouter.find('input').trigger('blur')
  expect(store.config.engines.openrouter.apiKey).toBe('api-key')
  expect(loadOpenRouterModels).toHaveBeenLastCalledWith(expect.objectContaining({
    apiKey: 'api-key'
  }))
})

test('groq settings', async () => {
  const tab = await switchToTab(wrapper, llmIndex)
  await tab.find('.list-panel .list .item:nth-child(9)').trigger('click')
  await tab.vm.$nextTick()
  const groq = tab.findComponent({ name: 'SettingsGroq' })
  await groq.find('input').setValue('api-key')
  await groq.find('input').trigger('blur')
  expect(store.config.engines.groq.apiKey).toBe('api-key')
  expect(loadGroqModels).toHaveBeenLastCalledWith(expect.objectContaining({
    apiKey: 'api-key'
  }))
})

test('cerebras settings', async () => {
  const tab = await switchToTab(wrapper, llmIndex)
  await tab.find('.list-panel .list .item:nth-child(10)').trigger('click')
  await tab.vm.$nextTick()
  const cerebras = tab.findComponent({ name: 'SettingsCerebras' })
  await cerebras.find('input').setValue('api-key')
  await cerebras.find('input').trigger('blur')
  expect(store.config.engines.cerebras.apiKey).toBe('api-key')
  expect(loadCerebrasModels).toHaveBeenLastCalledWith(expect.objectContaining({
    apiKey: 'api-key'
  }))
})

