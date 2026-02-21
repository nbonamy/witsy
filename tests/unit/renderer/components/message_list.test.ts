
import { vi, beforeAll, beforeEach, afterAll, afterEach, expect, test } from 'vitest'
import { mount, VueWrapper, enableAutoUnmount } from '@vue/test-utils'
import { SearchState } from '@/renderer/screens/Chat.vue'
import { useWindowMock } from '@tests/mocks/window'
import { store } from '@services/store'
import MessageList from '@components/MessageList.vue'
import Message from '@models/message'
import Chat from '@models/chat'
import { ref } from 'vue'

enableAutoUnmount(afterAll)

const searchState: SearchState = { filter: ref<string | null>(null), navigate: ref(0), localSearch: ref(false) }

const mountOptions = {
  global: { provide: { searchState } },
}

let wrapper: VueWrapper<any>

beforeAll(() => {
  useWindowMock()
  store.loadSettings()
  wrapper = mount(MessageList, { props: { chat: new Chat('MessageList test'), conversationMode: '' }, ...mountOptions })
})

beforeEach(() => {
  vi.clearAllMocks()
})

afterEach(() => {
  searchState.filter.value = null
  searchState.navigate.value = 0
  searchState.localSearch.value = false
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

test('Exposes scroller ref', () => {
  expect(wrapper.vm.scroller).toBeDefined()
  expect(wrapper.vm.scroller).toBeInstanceOf(HTMLElement)
})
