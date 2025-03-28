
import { vi, beforeAll, beforeEach, afterAll, expect, test } from 'vitest'
import { mount, enableAutoUnmount, VueWrapper } from '@vue/test-utils'
import { useWindowMock } from '../mocks/window'
import { store } from '../../src/services/store'
import { favoriteMockEngine, standardEngines } from '../../src/llms/llm'
import EmptyChat from '../../src/components/EmptyChat.vue'

enableAutoUnmount(afterAll)

beforeAll(() => {
  useWindowMock({ customEngine: true, favoriteModels: true })
  store.loadSettings()
})

beforeEach(() => {

  vi.clearAllMocks()

  // store
  store.config.general.tips.engineSelector = true
  store.config.llm.engine = 'openai'
  store.config.engines.openai = {
    apiKey: 'key',
    models: {
      chat: [
        { id: 'gpt-3.5-turbo', name: 'gpt-3.5-turbo' },
        { id: 'gpt-4-turbo', name: 'gpt-4-turbo' },
        { id: 'gpt-4o', name: 'gpt-4o' }
      ]
    },
    model: {
      chat: 'gpt-4-turbo'
    }
  }
  store.config.engines.ollama = {
    models: {
      chat: [
        { id: 'llama3-8b', name: 'llama3-8b' },
        { id: 'llama3-70b', name: 'llama3-70b' }
      ]
    }
  }
  store.config.engines.anthropic = {
    apiKey: 'test',
  }
  store.config.engines.mistralai =  {
    apiKey: 'test',
    models: {
      chat: [
        { id: 'llama3-8b', name: 'llama3-8b' },
        { id: 'llama3-70b', name: 'llama3-70b' }
      ]
    }
  }
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
  expect(wrapper.findAll('.empty .engines .logo')).toHaveLength(standardEngines.length+2)
  expect(wrapper.findAll('.empty .current .logo')).toHaveLength(1)
  expect(wrapper.findAll('.empty .current select option')).toHaveLength(3)
  expect(wrapper.find<HTMLOptionElement>('.empty select option:nth-child(1)').element.value).toBe('gpt-3.5-turbo')
  expect(wrapper.find<HTMLOptionElement>('.empty select option:nth-child(2)').element.value).toBe('gpt-4-turbo')
  expect(wrapper.find<HTMLOptionElement>('.empty select option:nth-child(3)').element.value).toBe('gpt-4o')
})

test('Selects engine', async () => {
  const wrapper: VueWrapper<any> = mount(EmptyChat)
  await wrapper.find('.empty .current .logo').trigger('click')
  expect(wrapper.vm.showAllEngines).toBe(true)
  expect(wrapper.find('.empty .tip').exists()).toBe(false)
  const ollama = 1 + standardEngines.indexOf('ollama')
  await wrapper.find(`.empty .engines .logo:nth-child(${ollama+1})`).trigger('click')
  expect(store.config.llm.engine).toBe('ollama')
  expect(wrapper.find('.empty .tip').exists()).toBe(true)
  expect(wrapper.vm.showAllEngines).toBe(false)
})

test('Selects model', async () => {
  const wrapper = mount(EmptyChat)
  expect(store.config.engines.openai.model.chat).toBe('gpt-4-turbo')
  await wrapper.find('.empty .current select').setValue('gpt-4o')
  expect(store.config.engines.openai.model.chat).toBe('gpt-4o')
})

test('Prompts when selecting not ready engine', async () => {
  const wrapper: VueWrapper<any> = mount(EmptyChat)

  // openai is ready
  wrapper.vm.showAllEngines = true
  await wrapper.find('.empty .engines .logo:nth-child(2)').trigger('click')
  expect(window.api.showDialog).toHaveBeenCalledTimes(0)
  
  // anthropic is not
  wrapper.vm.showAllEngines = true
  const anthropic = 1 + standardEngines.indexOf('anthropic')
  await wrapper.find(`.empty .engines .logo:nth-child(${anthropic+1})`).trigger('click')
  expect(window.api.showDialog).toHaveBeenCalledTimes(1)
  expect(store.config.llm.engine).toBe('openai')

  // mistralai is
  wrapper.vm.showAllEngines = true
  const mistralai = 1 + standardEngines.indexOf('mistralai')
  await wrapper.find(`.empty .engines .logo:nth-child(${mistralai+1})`).trigger('click')
  expect(window.api.showDialog).toHaveBeenCalledTimes(1)
  expect(store.config.llm.engine).toBe('mistralai')

})

test('Displays and selects favorites', async () => {
  const wrapper: VueWrapper<any> = mount(EmptyChat)
  await wrapper.find('.empty .current .logo').trigger('click')
  await wrapper.find('.empty .engines .logo:nth-child(1)').trigger('click')
  expect(wrapper.findAll<HTMLOptionElement>('.empty .current select option')).toHaveLength(2)
  expect(wrapper.find<HTMLOptionElement>('.empty .current select option:nth-child(1)').element.value).toBe('mock-chat1')
  expect(wrapper.find<HTMLOptionElement>('.empty .current select option:nth-child(2)').element.value).toBe('mock-chat2')
  await wrapper.find<HTMLSelectElement>('.empty .current select').setValue('mock-chat1')
  expect(store.config.llm.engine).toBe(favoriteMockEngine)
  expect(store.config.engines[favoriteMockEngine].model.chat).toBe('mock-chat1')
})

test('Manages favorites', async () => {

  // check init
  expect(store.config.llm.favorites).toHaveLength(2)
  store.config.engines['mock'] = {
    models: { chat: [] },
    model: { chat: '' }
  }

  // from open ai model
  const wrapper: VueWrapper<any> = mount(EmptyChat)
  await wrapper.find('.empty .current .favorite span').trigger('click')
  expect(store.config.llm.favorites).toHaveLength(3)
  expect(store.config.llm.favorites[2].engine).toBe('openai')
  expect(store.config.llm.favorites[2].model).toBe('gpt-4-turbo')
  await wrapper.find('.empty .current .favorite span').trigger('click')
  expect(store.config.llm.favorites).toHaveLength(2)

  // from favorites
  store.config.general.tips.modelSelector = false
  await wrapper.find('.empty .current .logo').trigger('click')
  await wrapper.find('.empty .engines .logo:nth-child(1)').trigger('click')
  await wrapper.find('.empty .current .favorite span').trigger('click')
  expect(store.config.llm.favorites).toHaveLength(1)

})
