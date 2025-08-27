
import { vi, beforeAll, beforeEach, afterAll, expect, test } from 'vitest'
import { mount, enableAutoUnmount, VueWrapper } from '@vue/test-utils'
import { defaultCapabilities, loadAnthropicModels } from 'multi-llm-ts'
import { useWindowMock } from '../mocks/window'
import { store } from '../../src/services/store'
import { wait } from '../../src/main/utils'
import LlmFactory, { favoriteMockEngine } from '../../src/llms/llm'
import EmptyChat from '../../src/components/EmptyChat.vue'
import { installMockModels } from '../mocks/llm'
import { findModelSelectoPlus } from '../utils'

enableAutoUnmount(afterAll)

vi.mock('multi-llm-ts', async (importOriginal) => {
  const actual = await importOriginal() as unknown as any
  return {
    ...actual,
    loadAnthropicModels: vi.fn(async () => {
      await wait(200)
      return false
    })
  }
})

beforeAll(() => {
  useWindowMock({ customEngine: true, favoriteModels: true })
  store.loadSettings()
})

beforeEach(() => {

  vi.clearAllMocks()

  // store
  store.config.general.tips.engineSelector = true
  store.config.general.tips.modelSelector = true
  store.config.llm.engine = 'openai'
  store.config.engines.openai = {
    apiKey: 'key',
    models: {
      chat: [
        { id: 'gpt-3.5-turbo', name: 'gpt-3.5-turbo', capabilities: defaultCapabilities.capabilities },
        { id: 'gpt-4-turbo', name: 'gpt-4-turbo', capabilities: defaultCapabilities.capabilities },
        { id: 'gpt-4o', name: 'gpt-4o', capabilities: defaultCapabilities.capabilities }
      ]
    },
    model: {
      chat: 'gpt-4-turbo'
    }
  }
  store.config.engines.ollama = {
    models: {
      chat: [
        { id: 'llama3-8b', name: 'llama3-8b', capabilities: defaultCapabilities.capabilities },
        { id: 'llama3-70b', name: 'llama3-70b', capabilities: defaultCapabilities.capabilities }
      ]
    },
    model: {
      chat: 'llama3-8b'
    }
  }
  store.config.engines.mistralai =  {
    apiKey: 'test',
    models: {
      chat: [
        { id: 'llama3-8b', name: 'llama3-8b', capabilities: defaultCapabilities.capabilities },
        { id: 'llama3-70b', name: 'llama3-70b', capabilities: defaultCapabilities.capabilities }
      ]
    },
    model: {
      chat: 'llama3-8b'
    }
  }

  installMockModels()
})

test('Renders correctly', async () => {
  const wrapper: VueWrapper<any> = mount(EmptyChat)
  expect(wrapper.exists()).toBe(true)
  expect(wrapper.find('.empty').exists()).toBe(true)
  expect(wrapper.find('.empty .tip').exists()).toBe(true)
  expect(wrapper.find('.empty .engines').exists()).toBe(true)
  expect(wrapper.find('.empty .current').exists()).toBe(true)
  expect(wrapper.find('.empty .favorite').exists()).toBe(true)
  expect(wrapper.vm.showAllEngines).toBe(false)
})

test('Renders engines and models', async () => {
  const wrapper: VueWrapper<any> = mount(EmptyChat)
  expect(wrapper.findAll('.empty .engines .logo')).toHaveLength(10)
  expect(wrapper.findAll('.empty .current .logo')).toHaveLength(1)
  const modelSelector = findModelSelectoPlus(wrapper)
  await modelSelector.open()
  expect(modelSelector.getOptions()).toHaveLength(3)
  expect(modelSelector.getOptions()[0].label).toBe('gpt-3.5-turbo')
  expect(modelSelector.getOptions()[1].label).toBe('gpt-4-turbo')
  expect(modelSelector.getOptions()[2].label).toBe('gpt-4o')
})

test('Selects engine', async () => {
  const manager = LlmFactory.manager(store.config)
  const wrapper: VueWrapper<any> = mount(EmptyChat)
  expect(wrapper.find('.empty .tip.engine').exists()).toBe(true)
  expect(wrapper.find('.empty .tip.model').exists()).toBe(false)
  await wrapper.find('.empty .current .logo').trigger('click')
  expect(wrapper.vm.showAllEngines).toBe(true)
  const ollama = 1 + manager.getPriorityEngines().indexOf('ollama')
  await wrapper.find(`.empty .engines .logo:nth-child(${ollama+1})`).trigger('click')
  await wrapper.vm.$nextTick()
  expect(store.config.llm.engine).toBe('ollama')
  expect(wrapper.find('.empty .tip.engine').exists()).toBe(false)
  expect(wrapper.find('.empty .tip.model').exists()).toBe(true)
  expect(wrapper.vm.showAllEngines).toBe(false)
})

test('Selects model', async () => {
  const wrapper = mount(EmptyChat)
  expect(store.config.engines.openai.model.chat).toBe('gpt-4-turbo')
  const modelSelector = findModelSelectoPlus(wrapper)
  await modelSelector.open()
  await modelSelector.select(2)
  expect(store.config.engines.openai.model.chat).toBe('gpt-4o')
})

test('Allows API Key input', async () => {
  const wrapper: VueWrapper<any> = mount(EmptyChat)
  expect(wrapper.find('.empty .current .help').exists()).toBe(false)
  await wrapper.find('.empty .current .logo').trigger('click')
  await wrapper.find('.empty .engines .logo.anthropic').trigger('click')
  expect(wrapper.find('.empty .current input[name=apiKey]').exists()).toBe(true)
  await wrapper.find('.empty .current input[name=apiKey]').setValue('test')
  await wrapper.find('.empty .current button[name=saveApiKey]').trigger('click')
  expect(store.config.engines.anthropic.apiKey).toBe('test')
  expect(loadAnthropicModels).toHaveBeenCalledWith(store.config.engines.anthropic, expect.anything())
  expect(wrapper.find('.empty .current .help.loading').exists()).toBe(true)
  expect(wrapper.find('.empty .current .help.models').exists()).toBe(false)
  await wait(200) //vi.waitUntil(() => wrapper.find('.empty .current .help.models').exists(), { timeout: 5000 })
  expect(wrapper.find('.empty .current .help.loading').exists()).toBe(false)
  expect(wrapper.find('.empty .current .help.models').exists()).toBe(true)
})

test('Displays and selects favorites', async () => {
  store.config.general.tips.modelSelector = false
  store.config.general.tips.modelSelector = false
  const wrapper: VueWrapper<any> = mount(EmptyChat)
  await wrapper.find('.empty .current .logo').trigger('click')
  await wrapper.find('.empty .engines .logo:nth-child(1)').trigger('click')
  const modelSelector = findModelSelectoPlus(wrapper)
  await modelSelector.open()
  expect(modelSelector.getOptions()).toHaveLength(2)
  expect(modelSelector.getOptions()[0].label).toBe('mock_label/chat')
  expect(modelSelector.getOptions()[1].label).toBe('mock_label/vision')
  await modelSelector.select(0)
  expect(store.config.llm.engine).toBe(favoriteMockEngine)
  expect(store.config.engines[favoriteMockEngine].model.chat).toBe('mock-chat')
  expect(wrapper.find<HTMLElement>('.empty .favorite .shortcut').text()).toBe('emptyChat.favorites.shortcut')
  expect(wrapper.vm.modelShortcut).toBe(process.platform === 'darwin' ? '⌥+1' : 'Alt+1')
  await modelSelector.open()
  await modelSelector.select(1)
  expect(store.config.engines[favoriteMockEngine].model.chat).toBe('mock-vision')
  expect(wrapper.vm.modelShortcut).toBe(process.platform === 'darwin' ? '⌥+2' : 'Alt+2')
})

test('Activates favorites', async () => {
  mount(EmptyChat)
  document.dispatchEvent(new KeyboardEvent('keydown', { code: '2', key: '2', keyCode: 50, altKey: true }))
  expect(store.config.llm.engine).toBe(favoriteMockEngine)
  expect(store.config.engines[favoriteMockEngine].model.chat).toBe('mock-vision')
  document.dispatchEvent(new KeyboardEvent('keydown', { code: '1', key: '1', keyCode: 49, altKey: true }))
  expect(store.config.llm.engine).toBe(favoriteMockEngine)
  expect(store.config.engines[favoriteMockEngine].model.chat).toBe('mock-chat')
  document.dispatchEvent(new KeyboardEvent('keydown', { code: '2', key: '2', keyCode: 50, altKey: false }))
  expect(store.config.llm.engine).toBe(favoriteMockEngine)
  expect(store.config.engines[favoriteMockEngine].model.chat).toBe('mock-chat')
})

test('Manages favorites', async () => {

  // check init
  expect(store.config.llm.favorites).toHaveLength(2)

  // from open ai model
  const wrapper: VueWrapper<any> = mount(EmptyChat)
  await wrapper.find('.empty .current .favorite span').trigger('click')
  expect(store.config.llm.favorites).toHaveLength(3)
  expect(store.config.llm.favorites[2].engine).toBe('openai')
  expect(store.config.llm.favorites[2].model).toBe('gpt-4-turbo')
  await wrapper.find('.empty .current .favorite .action').trigger('click')
  expect(store.config.llm.favorites).toHaveLength(2)

  // from favorites
  store.config.general.tips.modelSelector = false
  await wrapper.find('.empty .current .logo').trigger('click')
  await wrapper.find('.empty .engines .logo:nth-child(1)').trigger('click')
  await wrapper.find('.empty .current .favorite .action').trigger('click')
  expect(store.config.llm.favorites).toHaveLength(1)

})
