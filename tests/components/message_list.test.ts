
import { mount, VueWrapper, enableAutoUnmount } from '@vue/test-utils'
import { vi, beforeAll, beforeEach, afterAll, expect, test } from 'vitest'
import { store } from '../../src/services/store'
import MessageList from '../../src/components/MessageList.vue'
import defaults from '../../defaults/settings.json'
import Chat from '../../src/models/chat'
import Message from '../../src/models/message'
import { renderMarkdown } from '../../src/main/markdown'

enableAutoUnmount(afterAll)

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

  // api
  window.api = {
    markdown: {
      render: renderMarkdown
    }
  }
  
  // init store
  store.config = defaults

  // wrapper
  wrapper = mount(MessageList)
  expect(onEventMock).toHaveBeenCalled()
})

beforeEach(() => {
  vi.clearAllMocks()
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

//
// It is normal for the the wrapper not be updated
// if you add messages to the chat and hope for new messages to appear
// chat is a prop so in a normal app, the parent will detect the change,
// and repaint the whole component with the new value of the prop
// you can simulate this by calling setProps but you can't call it
// with the same chat object, you need to create a new one by cloning
// the old one and adding the new message and then call setProps
// but from a testing standpoint this really brings no value...
//

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
