
import { vi, beforeEach, afterAll, expect, test } from 'vitest'
import { mount, enableAutoUnmount } from '@vue/test-utils'
import { store } from '../../src/services/store'
import EmptyChat from '../../src/components/EmptyChat.vue'
import EngineLogo from '../../src/components/EngineLogo.vue'
import { availableEngines } from '../../src/llms/llm'

enableAutoUnmount(afterAll)

window.api = {
  showDialog: vi.fn(async () => { return { response: 0, checkboxChecked: false }}),
  config: {
    save: vi.fn()
  },
}

beforeEach(() => {

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
            { id: 'llama3-8b', name: 'llama3-70b' },
            { id: 'llama3-8b', name: 'llama3-70b' }
          ]
        }
      },
      anthropic: {
        apiKey: 'test',
      },
      mistralai: {
        models: {
          chat: [
            { id: 'llama3-8b', name: 'llama3-70b' },
            { id: 'llama3-8b', name: 'llama3-70b' }
          ]
        }
      }
    }
  }
})

test('Renders correctly', async () => {
  const wrapper = mount(EmptyChat)
  expect(wrapper.exists()).toBe(true)
  expect(wrapper.find('.empty').exists()).toBe(true)
  expect(wrapper.find('.empty .tip').exists()).toBe(true)
  expect(wrapper.find('.empty .engines').exists()).toBe(true)
  expect(wrapper.find('.empty select').exists()).toBe(true)
  expect(wrapper.vm.showAllEngines).toBe(false)
})

test('Renders engines and models', async () => {
  const wrapper = mount(EmptyChat)
  expect(wrapper.findAllComponents(EngineLogo).length).toBe(availableEngines.length)
  expect(wrapper.findAll('.empty select option')).toHaveLength(3)
})

test('Selects engine', async () => {
  const wrapper = mount(EmptyChat)
  await wrapper.find('.empty .engines :nth-child(1)').trigger('click')
  expect(wrapper.vm.showAllEngines).toBe(true)
  expect(wrapper.find('.empty .tip').exists()).toBe(false)
  await wrapper.find('.empty .engines :nth-child(2)').trigger('click')
  expect(store.config.llm.engine).toBe(availableEngines[1])
  expect(wrapper.find('.empty .tip').exists()).toBe(false)
})

test('Selects model', async () => {
  const wrapper = mount(EmptyChat)
  expect(store.config.engines.openai.model.chat).toBe('gpt-4-turbo')
  await wrapper.find('.empty select').setValue('gpt-4o')
  expect(store.config.engines.openai.model.chat).toBe('gpt-4o')
})

test('Prompts when selecting not ready engine', async () => {
  const wrapper = mount(EmptyChat)
  await wrapper.find('.empty .engines :nth-child(1)').trigger('click')
  await wrapper.find('.empty .engines :nth-child(3)').trigger('click')
  expect(window.api.showDialog).toHaveBeenCalledTimes(1)
  expect(store.config.llm.engine).toBe(availableEngines[0])
  await wrapper.find('.empty .engines :nth-child(4)').trigger('click')
  expect(window.api.showDialog).toHaveBeenCalledTimes(2)
  expect(store.config.llm.engine).toBe(availableEngines[0])
  await wrapper.find('.empty .engines :nth-child(5)').trigger('click')
  expect(window.api.showDialog).toHaveBeenCalledTimes(3)
  expect(store.config.llm.engine).toBe(availableEngines[0])
})
