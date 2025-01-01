
import { vi, beforeAll, beforeEach, afterAll, expect, test } from 'vitest'
import { mount, enableAutoUnmount, VueWrapper } from '@vue/test-utils'
import { useWindowMock } from '../mocks/window'
import { store } from '../../src/services/store'
import EmptyChat from '../../src/components/EmptyChat.vue'
import EngineLogo from '../../src/components/EngineLogo.vue'
import { availableEngines } from '../../src/llms/llm'

enableAutoUnmount(afterAll)

beforeAll(() => {
  useWindowMock()
})

beforeEach(() => {

  vi.clearAllMocks()

  // store
  store.config = {
    general: {
      tips: {
        engineSelector: true
      }
    },
    llm: {
      engine: 'openai',
    },
    engines: {
      openai: {
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
      },
      ollama: {
        models: {
          chat: [
            { id: 'llama3-8b', name: 'llama3-8b' },
            { id: 'llama3-70b', name: 'llama3-70b' }
          ]
        }
      },
      anthropic: {
        apiKey: 'test',
      },
      mistralai: {
        apiKey: 'test',
        models: {
          chat: [
            { id: 'llama3-8b', name: 'llama3-8b' },
            { id: 'llama3-70b', name: 'llama3-70b' }
          ]
        }
      }
    }
  }
})

test('Renders correctly', async () => {
  const wrapper: VueWrapper<any> = mount(EmptyChat)
  expect(wrapper.exists()).toBe(true)
  expect(wrapper.find('.empty').exists()).toBe(true)
  expect(wrapper.find('.empty .tip').exists()).toBe(true)
  expect(wrapper.find('.empty .engines').exists()).toBe(true)
  expect(wrapper.find('.empty select').exists()).toBe(true)
  expect(wrapper.vm.showAllEngines).toBe(false)
})

test('Renders engines and models', async () => {
  const wrapper: VueWrapper<any> = mount(EmptyChat)
  expect(wrapper.findAllComponents(EngineLogo).length).toBe(availableEngines.length+1)
  expect(wrapper.findAll('.empty select option')).toHaveLength(3)
})

test('Selects engine', async () => {
  const wrapper: VueWrapper<any> = mount(EmptyChat)
  await wrapper.find('.empty .engines :nth-child(1)').trigger('click')
  expect(wrapper.vm.showAllEngines).toBe(true)
  expect(wrapper.find('.empty .tip').exists()).toBe(false)
  const ollama = availableEngines.indexOf('ollama')
  await wrapper.find(`.empty .engines :nth-child(${ollama+1})`).trigger('click')
  expect(store.config.llm.engine).toBe('ollama')
  expect(wrapper.find('.empty .tip').exists()).toBe(false)
})

test('Selects model', async () => {
  const wrapper = mount(EmptyChat)
  expect(store.config.engines.openai.model.chat).toBe('gpt-4-turbo')
  await wrapper.find('.empty select').setValue('gpt-4o')
  expect(store.config.engines.openai.model.chat).toBe('gpt-4o')
})

test('Prompts when selecting not ready engine', async () => {
  const wrapper: VueWrapper<any> = mount(EmptyChat)

  // openai is ready
  wrapper.vm.showAllEngines = true
  await wrapper.find('.empty .engines .logo:nth-child(1)').trigger('click')
  expect(window.api.showDialog).toHaveBeenCalledTimes(0)
  
  // anthropic is not
  wrapper.vm.showAllEngines = true
  const anthropic = availableEngines.indexOf('anthropic')
  await wrapper.find(`.empty .engines .logo:nth-child(${anthropic+1})`).trigger('click')
  expect(window.api.showDialog).toHaveBeenCalledTimes(1)
  expect(store.config.llm.engine).toBe('openai')

  // mistralai is
  wrapper.vm.showAllEngines = true
  const mistralai = availableEngines.indexOf('mistralai')
  await wrapper.find(`.empty .engines .logo:nth-child(${mistralai+1})`).trigger('click')
  expect(window.api.showDialog).toHaveBeenCalledTimes(1)
  expect(store.config.llm.engine).toBe('mistralai')

})
