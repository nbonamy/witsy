
import { vi, beforeEach, expect, test } from 'vitest'
import { mount } from '@vue/test-utils'
import Prompt from '../../src/components/Prompt.vue'
import PromptAnywhere from '../../src/screens/PromptAnywhere.vue'
import defaults from '../../defaults/settings.json'

import useEventBus  from '../../src/composables/useEventBus'
const { emitEvent } = useEventBus()

window.api = {
  config: {
    load: vi.fn(() => defaults),
  },
  anywhere: {
    prompt: vi.fn(),
    cancel: vi.fn(),
    resize: vi.fn(),
  },
}

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
  const wrapper = mount(PromptAnywhere)
  emitEvent('sendPrompt', 'prompt')
  expect(window.api.anywhere.prompt).toHaveBeenCalled()
})
