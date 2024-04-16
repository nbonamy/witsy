
import { mount, VueWrapper } from '@vue/test-utils'
import Prompt from '../../src/components/Prompt.vue'
import { vi, beforeAll, beforeEach, afterAll, expect, test } from 'vitest'
import { store } from '../../src/services/store'
import defaults from '../../defaults/settings.json'
import Chat from '../../src/models/chat'

const onEventMock = vi.fn()
const emitEventMock = vi.fn()

vi.mock('../../src/composables/useEventBus.js', async () => {
  return { default: () => {
    return {
      onEvent: onEventMock,
      emitEvent: emitEventMock
    }
  }}
})

let wrapper: VueWrapper<any>

beforeAll(() => {

  // init store
  store.config = defaults

  // wrapper
  wrapper = mount(Prompt, { attachTo: document.body })
  expect(onEventMock).toHaveBeenCalled()
})

beforeEach(() => {
  vi.clearAllMocks()
})

afterAll(() => {
  wrapper.unmount()
})

test('should render', () => {
  expect(wrapper.exists()).toBe(true)
  expect(wrapper.find('.input textarea').exists()).toBe(true)
  expect(wrapper.find('.attach').exists()).toBe(true)
  expect(wrapper.find('.send').exists()).toBe(true)
  expect(wrapper.find('.stop').exists()).toBe(false)
})

test('should send on click', async () => {
  const prompt = wrapper.find('.input textarea')
  await prompt.setValue('this is my prompt')
  await wrapper.find('.icon.send').trigger('click')
  expect(emitEventMock).toHaveBeenCalled()
  expect(emitEventMock).toHaveBeenCalledWith('sendPrompt', 'this is my prompt')
  expect(prompt.element.value).toBe('')
})

test('should send on enter', async () => {
  const prompt = wrapper.find('.input textarea')
  await prompt.setValue('this is my prompt')
  await prompt.trigger('keydown.enter')
  expect(emitEventMock).toHaveBeenCalled()
  expect(emitEventMock).toHaveBeenCalledWith('sendPrompt', 'this is my prompt')
  expect(prompt.element.value).toBe('')
})

test('should not send on shift enter', async () => {
  const prompt = wrapper.find('.input textarea')
  await prompt.setValue('this is my prompt')
  await prompt.trigger('keydown.enter.shift')
  expect(emitEventMock).not.toHaveBeenCalled()
})

// test('should autogrow', async () => {
//   const prompt = wrapper.find('.input textarea')
//   for (const char of 'this is my prompt') {
//     await prompt.trigger(`keyup.${char}`)
//   }
//   expect(prompt.element.value).toBe('this is my prompt')
//   expect(prompt.element.style.height).toBe('150px')
// })

test('should show stop button when working', async () => {
  const chat = new Chat({ messages: [ {} ] })
  chat.messages[0].transient = true
  await wrapper.setProps({ chat: chat })
  expect(wrapper.find('.send').exists()).toBe(false)
  expect(wrapper.find('.stop').exists()).toBe(true)
  await wrapper.find('.icon.stop').trigger('click')
  expect(emitEventMock).toHaveBeenCalledWith('stopAssistant')
})
