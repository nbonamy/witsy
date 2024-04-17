
import { mount, VueWrapper } from '@vue/test-utils'
import { vi, beforeAll, beforeEach, afterAll, expect, test } from 'vitest'
import { ipcRenderer } from 'electron'
import { store } from '../../src/services/store'
import MessageList from '../../src/components/MessageList.vue'
import defaults from '../../defaults/settings.json'
import Chat from '../../src/models/chat'
import Message from '../../src/models/message'

import useEventBus from '../../src/composables/useEventBus'
const { emitEvent } = useEventBus()

// const onEventMock = vi.fn()
// const emitEventMock = vi.fn()

// vi.mock('../../src/composables/useEventBus.js', async () => {
//   return { default: () => {
//     return {
//       onEvent: onEventMock,
//       emitEvent: emitEventMock
//     }
//   }}
// })

let wrapper: VueWrapper<any>

beforeAll(() => {

  // init store
  store.config = defaults

  // wrapper
  wrapper = mount(MessageList)
  //expect(onEventMock).toHaveBeenCalled()
})

beforeEach(() => {
  vi.clearAllMocks()
})

afterAll(() => {
  wrapper.unmount()
})

test('Render', () => {
  expect(wrapper.exists()).toBe(true)
  expect(wrapper.find('.messages').exists()).toBe(true)
  expect(wrapper.find('.overflow').exists()).toBe(false)
  expect(wrapper.findAll('.message')).toHaveLength(0)
  expect(wrapper.find('.messages').attributes('class')).toContain('openai')
})

test('Theme support', async () => {
  store.config.appearance.chat.theme = 'conversation'
  await wrapper.vm.$nextTick()
  expect(wrapper.find('.messages').attributes('class')).toContain('conversation')
})

test('Does not show system messages', async () => {
  const chat: Chat = new Chat('MessageList test')
  chat.addMessage(new Message('system', 'Hello'))
  await wrapper.setProps({ chat: chat })
  expect(wrapper.findAll('.message')).toHaveLength(0)
})

test('Shows user and assistant messages', async () => {
  const chat: Chat = new Chat('MessageList test')
  chat.addMessage(new Message('system', 'Hello'))
  chat.addMessage(new Message('user', 'Bonjour'))
  chat.addMessage(new Message('assistant', 'Hola'))
  await wrapper.setProps({ chat: chat })
  expect(wrapper.findAll('.message')).toHaveLength(2)
})
