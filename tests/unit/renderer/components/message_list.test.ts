
import { vi, beforeAll, beforeEach, afterAll, afterEach, expect, test } from 'vitest'
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

afterEach(() => {
  store.chatState.filter = null
  store.chatState.navigateMatch = 0
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

test('Search nav not shown when no filter', () => {
  expect(wrapper.find('.search-nav').exists()).toBe(false)
})

test('Search nav not shown when filter set but no matches', async () => {
  store.chatState.filter = 'zzzznotfound'
  await wrapper.vm.$nextTick()
  // wait for the 200ms timeout
  await vi.waitFor(() => {
    expect(wrapper.find('.search-nav').exists()).toBe(false)
  }, { timeout: 500 })
})

test('Search nav shown when marks exist', async () => {
  // manually inject mark elements to simulate highlights
  const scroller = wrapper.find('.messages').element
  scroller.innerHTML = '<mark>test</mark> some text <mark>test</mark> more <mark>test</mark>'

  store.chatState.filter = 'test'
  await wrapper.vm.$nextTick()
  await vi.waitFor(() => {
    expect(wrapper.find('.search-nav').exists()).toBe(true)
  }, { timeout: 500 })
  expect(wrapper.find('.match-count').text()).toContain('chat.search.matchCount')
})

test('Navigate to next match', async () => {
  const scroller = wrapper.find('.messages').element
  scroller.innerHTML = '<mark>test</mark> some text <mark>test</mark>'

  store.chatState.filter = 'test'
  await wrapper.vm.$nextTick()
  await vi.waitFor(() => {
    expect(wrapper.find('.search-nav').exists()).toBe(true)
  }, { timeout: 500 })

  // first match is active
  expect(scroller.querySelectorAll('mark')[0].classList.contains('active')).toBe(true)

  // navigate to next
  await wrapper.find('.nav-next').trigger('click')
  expect(scroller.querySelectorAll('mark')[1].classList.contains('active')).toBe(true)
  expect(scroller.querySelectorAll('mark')[0].classList.contains('active')).toBe(false)
})

test('Navigate wraps around', async () => {
  const scroller = wrapper.find('.messages').element
  scroller.innerHTML = '<mark>test</mark> some text <mark>test</mark>'

  store.chatState.filter = 'test'
  await wrapper.vm.$nextTick()
  await vi.waitFor(() => {
    expect(wrapper.find('.search-nav').exists()).toBe(true)
  }, { timeout: 500 })

  // navigate to last
  await wrapper.find('.nav-next').trigger('click')
  expect(scroller.querySelectorAll('mark')[1].classList.contains('active')).toBe(true)

  // navigate past last wraps to first
  await wrapper.find('.nav-next').trigger('click')
  expect(scroller.querySelectorAll('mark')[0].classList.contains('active')).toBe(true)

  // navigate before first wraps to last
  await wrapper.find('.nav-prev').trigger('click')
  expect(scroller.querySelectorAll('mark')[1].classList.contains('active')).toBe(true)
})

test('Search nav disappears when filter cleared', async () => {
  const scroller = wrapper.find('.messages').element
  scroller.innerHTML = '<mark>test</mark>'

  store.chatState.filter = 'test'
  await wrapper.vm.$nextTick()
  await vi.waitFor(() => {
    expect(wrapper.find('.search-nav').exists()).toBe(true)
  }, { timeout: 500 })

  store.chatState.filter = null
  await wrapper.vm.$nextTick()
  expect(wrapper.find('.search-nav').exists()).toBe(false)
})

test('Search nav re-appears on chat switch while filter active', async () => {
  const chat1 = new Chat('Chat 1')
  chat1.addMessage(new Message('user', 'hello'))
  chat1.addMessage(new Message('assistant', 'world keyword here'))

  const w = mount(MessageList, { props: { chat: chat1, conversationMode: '' } })
  store.chatState.filter = 'keyword'
  await w.vm.$nextTick()
  await vi.waitFor(() => {
    expect(w.find('.search-nav').exists()).toBe(true)
  }, { timeout: 500 })

  // switch to another chat that also has the keyword
  const chat2 = new Chat('Chat 2')
  chat2.addMessage(new Message('user', 'question'))
  chat2.addMessage(new Message('assistant', 'answer with keyword too'))
  await w.setProps({ chat: chat2 })
  await w.vm.$nextTick()
  await vi.waitFor(() => {
    expect(w.find('.search-nav').exists()).toBe(true)
  }, { timeout: 500 })
  w.unmount()
})

test('Search nav hidden on chat switch when no marks', async () => {
  const chat1 = new Chat('Chat 1')
  chat1.addMessage(new Message('user', 'hello'))
  chat1.addMessage(new Message('assistant', 'world keyword here'))

  const w = mount(MessageList, { props: { chat: chat1, conversationMode: '' } })
  store.chatState.filter = 'keyword'
  await w.vm.$nextTick()
  await vi.waitFor(() => {
    expect(w.find('.search-nav').exists()).toBe(true)
  }, { timeout: 500 })

  // switch to a chat without the keyword
  const chat2 = new Chat('Chat 2')
  chat2.addMessage(new Message('user', 'question'))
  chat2.addMessage(new Message('assistant', 'answer without match'))
  await w.setProps({ chat: chat2 })
  await w.vm.$nextTick()
  await vi.waitFor(() => {
    expect(w.find('.search-nav').exists()).toBe(false)
  }, { timeout: 500 })
  w.unmount()
})

test('Store navigateMatch triggers navigation', async () => {
  const scroller = wrapper.find('.messages').element
  scroller.innerHTML = '<mark>test</mark> text <mark>test</mark> text <mark>test</mark>'

  store.chatState.filter = 'test'
  await wrapper.vm.$nextTick()
  await vi.waitFor(() => {
    expect(wrapper.find('.search-nav').exists()).toBe(true)
  }, { timeout: 500 })

  // first match is active
  expect(scroller.querySelectorAll('mark')[0].classList.contains('active')).toBe(true)

  // trigger navigate via store
  store.chatState.navigateMatch = 1
  await wrapper.vm.$nextTick()
  expect(scroller.querySelectorAll('mark')[1].classList.contains('active')).toBe(true)
  expect(store.chatState.navigateMatch).toBe(0)

  // trigger navigate backward via store
  store.chatState.navigateMatch = -1
  await wrapper.vm.$nextTick()
  expect(scroller.querySelectorAll('mark')[0].classList.contains('active')).toBe(true)
  expect(store.chatState.navigateMatch).toBe(0)
})
