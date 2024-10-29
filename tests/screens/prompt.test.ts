
import { Expert } from 'types'
import { vi, beforeAll, beforeEach, expect, test, afterAll } from 'vitest'
import { enableAutoUnmount, mount } from '@vue/test-utils'
import Prompt from '../../src/components/Prompt.vue'
import PromptAnywhere from '../../src/screens/PromptAnywhere.vue'
import defaultSettings from '../../defaults/settings.json'

enableAutoUnmount(afterAll)

beforeAll(() => {

  // eslint-disable-next-line no-global-assign
  navigator = {
    // @ts-expect-error mock
    mediaDevices: {
      getUserMedia: vi.fn()
    }
  }
  
  window.api = {
    on: vi.fn(),
    off: vi.fn(),
    config: {
      load: vi.fn(() => JSON.parse(JSON.stringify(defaultSettings))),
    },
    experts: {
      load: vi.fn(() => {
        return [
          { id: 'uuid1', type: 'system', name: 'actor1', prompt: 'prompt1', state: 'enabled' },
          { id: 'uuid2', type: 'system', name: 'actor2', prompt: 'prompt2', state: 'disabled' },
          { id: 'uuid3', type: 'user', name: 'actor3', prompt: 'prompt3', state: 'enabled' }
        ] as Expert[]
      })
    },
    anywhere: {
      prompt: vi.fn(),
      cancel: vi.fn(),
    },
  }
})

beforeEach(() => {
  vi.clearAllMocks()
})

test('Renders correctly', () => {
  const wrapper = mount(PromptAnywhere)
  expect(wrapper.exists()).toBe(true)
  expect(wrapper.find('.anywhere').exists()).toBe(true)
  expect(wrapper.findComponent(Prompt).exists()).toBe(true)
})

// test('Closes on Escape', async () => {
//   const wrapper = mount(PromptAnywhere)
//   await wrapper.trigger('keyup.Escape')
//   expect(window.api.anywhere.cancel).toHaveBeenCalled()
// })
