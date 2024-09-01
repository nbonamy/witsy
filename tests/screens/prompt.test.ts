
import { vi, beforeAll, beforeEach, expect, test, afterAll } from 'vitest'
import { enableAutoUnmount, mount } from '@vue/test-utils'
import Prompt from '../../src/components/Prompt.vue'
import PromptAnywhere from '../../src/screens/PromptAnywhere.vue'
import CustomPrompt from '../../src/screens/CustomPrompt.vue'

import useEventBus  from '../../src/composables/useEventBus'
const { emitEvent } = useEventBus()

enableAutoUnmount(afterAll)

beforeAll(() => {

  window.api = {
    on: vi.fn(),
    prompts: {
      load: vi.fn(() => {
        return [
          { actor: 'actor1', prompt: 'prompt1' },
          { actor: 'actor2', prompt: 'prompt2' },
          { actor: 'actor3', prompt: 'prompt3' }
        ]
      })
    },
    anywhere: {
      prompt: vi.fn(),
      resize: vi.fn(),
      toggleCustom: vi.fn(),
      onCustom: vi.fn(),
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
//   await wrapper.trigger('keyup', { key: 'Escape' })
//   expect(window.api.anywhere.cancel).toHaveBeenCalled()
// })

test('Prompts on Enter', async () => {
  /*const wrapper = */mount(PromptAnywhere)
  emitEvent('sendPrompt', 'prompt')
  expect(window.api.anywhere.prompt).toHaveBeenCalled()
})

test('Show custom prompts', async () => {
  const wrapper = mount(PromptAnywhere)
  const trigger = wrapper.find('.icon.custom')
  await trigger.trigger('click')
  expect(window.api.anywhere.toggleCustom).toHaveBeenCalled()
})

test('Custom Prompts renders', async () => {
  const wrapper = mount(CustomPrompt)
  expect(wrapper.exists()).toBe(true)
  expect(wrapper.find('.context-menu').exists()).toBe(true)
  expect(window.api.prompts.load).toHaveBeenCalled()
})

test('Custom Prompts sends', async () => {
  const wrapper = mount(CustomPrompt)
  const trigger = wrapper.find('.context-menu .actions :nth-child(2)')
  await trigger.trigger('click')
  expect(window.api.anywhere.onCustom).toHaveBeenCalledWith('prompt2')
})
