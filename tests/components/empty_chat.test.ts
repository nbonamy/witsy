
import { vi, beforeAll, beforeEach, afterAll, expect, test } from 'vitest'
import { mount, enableAutoUnmount } from '@vue/test-utils'
import { store } from '../../src/services/store'
import EmptyChat from '../../src/components/EmptyChat.vue'
import EngineLogo from '../../src/components/EngineLogo.vue'
import { availableEngines } from '../../src/services/llm'

enableAutoUnmount(afterAll)

beforeAll(() => {

  // api
  window.api = {
    config: {
      save: vi.fn()
    },
  }

})

beforeEach(() => {

  // store
  store.config = {
    llm: {
      engine: 'openai',
    },
    engines: {
      openai: {
        models: {
          chat: [
          {
            id: 'gpt-3.5-turbo',
            name: 'gpt-3.5-turbo'
           }, {
            id: 'gpt-4-turbo',
            name: 'gpt-4-turbo'
           }, {
            id: 'gpt-4o',
            name: 'gpt-4o'
           }
          ]
        },
        model: {
          chat: 'gpt-4-turbo'
        }
      }
    }
  }
  store.config.getActiveModel = () => {
    return 'gpt-4-turbo'
  }
})

test('Renders correctly', async () => {
  const wrapper = mount(EmptyChat)
  expect(wrapper.exists()).toBe(true)
  expect(wrapper.find('.empty').exists()).toBe(true)
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
  await wrapper.find('.empty .engines :nth-child(2)').trigger('click')
  expect(store.config.llm.engine).toBe(availableEngines[1])
})

test('Selects model', async () => {
  const wrapper = mount(EmptyChat)
  expect(store.config.engines.openai.model.chat).toBe('gpt-4-turbo')
  await wrapper.find('.empty select').setValue('gpt-4o')
  expect(store.config.engines.openai.model.chat).toBe('gpt-4o')
})
