
import { vi, beforeAll, beforeEach, afterAll, expect, test } from 'vitest'
import { mount, VueWrapper, enableAutoUnmount } from '@vue/test-utils'
import { useWindowMock } from '@tests/mocks/window'
import { store } from '@services/store'
import MessageList from '@components/MessageList.vue'
import Message from '@models/message'
import Chat from '@models/chat'

enableAutoUnmount(afterAll)

let wrapper: VueWrapper<any>

beforeAll(() => {
  useWindowMock()
  store.loadSettings()
  wrapper = mount(MessageList, { props: { chat: new Chat('MessageList test'), conversationMode: '' } })
})

beforeEach(() => {
  vi.clearAllMocks()
})

test('Render', () => {
  expect(wrapper.exists()).toBe(true)
  expect(wrapper.find('.messages').exists()).toBe(true)
  expect(wrapper.find('.overflow').exists()).toBe(false)
  expect(wrapper.findAll('.message')).toHaveLength(0)
  expect(wrapper.find('.messages').classes()).toContain('openai')
  expect(wrapper.find('.messages').classes()).toContain('size3')
  expect(wrapper.find('.fullscreen').exists()).toBe(false)
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
  chat.engine = 'openai'
  chat.addMessage(new Message('system', 'Hello'))
  chat.addMessage(new Message('user', 'Bonjour'))
  chat.addMessage(new Message('assistant', 'Hola'))
  await wrapper.setProps({ chat: chat })
  expect(wrapper.findAll('.message')).toHaveLength(2)
})

test('Lazy loading: shows only initial messages when chat has many messages', async () => {
  const chat: Chat = new Chat('MessageList test')
  chat.engine = 'openai'

  // Add 50 messages (system + 49 others)
  chat.addMessage(new Message('system', 'System'))
  for (let i = 0; i < 25; i++) {
    chat.addMessage(new Message('user', `User message ${i}`))
    chat.addMessage(new Message('assistant', `Assistant message ${i}`))
  }

  const localWrapper = mount(MessageList, {
    props: { chat: chat, conversationMode: '' }
  })
  await localWrapper.vm.$nextTick()

  // Should show only last 20 messages (INITIAL_MESSAGE_COUNT)
  expect(localWrapper.findAll('.message')).toHaveLength(20)

  // Should show load-more indicator
  expect(localWrapper.find('.load-more').exists()).toBe(true)
  expect(localWrapper.find('.tag').exists()).toBe(true)
  // Text will be i18n key in test environment
  expect(localWrapper.find('.tag').text()).toBe('chat.lazyLoad.scrollUp')
})

test('Lazy loading: does not show load-more when all messages visible', async () => {
  const chat: Chat = new Chat('MessageList test')
  chat.engine = 'openai'

  // Add only 10 messages (less than INITIAL_MESSAGE_COUNT of 20)
  for (let i = 0; i < 5; i++) {
    chat.addMessage(new Message('user', `User ${i}`))
    chat.addMessage(new Message('assistant', `Assistant ${i}`))
  }

  const localWrapper = mount(MessageList, {
    props: { chat: chat, conversationMode: '' }
  })
  await localWrapper.vm.$nextTick()

  // Should show all 10 messages
  expect(localWrapper.findAll('.message')).toHaveLength(10)

  // Should not show load-more indicator
  expect(localWrapper.find('.load-more').exists()).toBe(false)
})

test('Lazy loading: loads more messages on scroll', async () => {
  const chat: Chat = new Chat('MessageList test')
  chat.engine = 'openai'

  // Add 60 messages
  chat.addMessage(new Message('system', 'System'))
  for (let i = 0; i < 30; i++) {
    chat.addMessage(new Message('user', `User ${i}`))
    chat.addMessage(new Message('assistant', `Assistant ${i}`))
  }

  const localWrapper = mount(MessageList, {
    props: { chat: chat, conversationMode: '' },
    attachTo: document.body
  })
  await localWrapper.vm.$nextTick()

  // Initially shows 20 messages
  expect(localWrapper.findAll('.message')).toHaveLength(20)

  // Mock scroll near top to trigger loading
  const scroller = localWrapper.find('.messages').element as HTMLElement
  Object.defineProperty(scroller, 'scrollTop', { value: 50, writable: true })
  Object.defineProperty(scroller, 'scrollHeight', { value: 1000, writable: true })
  Object.defineProperty(scroller, 'clientHeight', { value: 500, writable: true })

  // Trigger scroll event
  await scroller.dispatchEvent(new Event('scroll'))
  await localWrapper.vm.$nextTick()

  // Should load 20 more (total 40)
  expect(localWrapper.findAll('.message').length).toBeGreaterThan(20)

  localWrapper.unmount()
})

test('Lazy loading: shows loading indicator while loading', async () => {
  const chat: Chat = new Chat('MessageList test')
  chat.engine = 'openai'

  // Add 50 messages
  for (let i = 0; i < 25; i++) {
    chat.addMessage(new Message('user', `User ${i}`))
    chat.addMessage(new Message('assistant', `Assistant ${i}`))
  }

  const localWrapper = mount(MessageList, {
    props: { chat: chat, conversationMode: '' },
    attachTo: document.body
  })
  await localWrapper.vm.$nextTick()

  // Set isLoadingOlder to true
  localWrapper.vm.isLoadingOlder = true
  await localWrapper.vm.$nextTick()

  // Should show loading text (i18n key in test environment)
  expect(localWrapper.find('.tag').text()).toBe('chat.lazyLoad.loading')

  localWrapper.unmount()
})

test('Lazy loading: resets message count when chat changes', async () => {
  const chat1: Chat = new Chat('Chat 1')
  chat1.engine = 'openai'

  // Add many messages to chat1
  for (let i = 0; i < 30; i++) {
    chat1.addMessage(new Message('user', `User ${i}`))
    chat1.addMessage(new Message('assistant', `Assistant ${i}`))
  }

  const localWrapper = mount(MessageList, {
    props: { chat: chat1, conversationMode: '' }
  })
  await localWrapper.vm.$nextTick()

  // Load more messages
  localWrapper.vm.displayedMessageCount = 40
  await localWrapper.vm.$nextTick()

  // Switch to a different chat
  const chat2: Chat = new Chat('Chat 2')
  chat2.engine = 'openai'
  for (let i = 0; i < 30; i++) {
    chat2.addMessage(new Message('user', `User ${i}`))
    chat2.addMessage(new Message('assistant', `Assistant ${i}`))
  }

  await localWrapper.setProps({ chat: chat2 })
  await localWrapper.vm.$nextTick()

  // Should reset to initial count (20)
  expect(localWrapper.findAll('.message')).toHaveLength(20)

  localWrapper.unmount()
})
