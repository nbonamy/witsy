
import { vi, beforeAll, beforeEach, afterAll, expect, test } from 'vitest'
import { mount, VueWrapper, enableAutoUnmount } from '@vue/test-utils'
import { chatCallbacksMock, withChatCallbacks } from '@root/vitest.setup'
import { useWindowMock } from '@tests/mocks/window'
import { store } from '@services/store'
import ChatSidebar from '@components/ChatSidebar.vue'
import Chat from '@models/chat'
import Message from '@models/message'
import { kHistoryVersion } from '@/consts'

enableAutoUnmount(afterAll)

beforeAll(() => {
  useWindowMock()
  store.load()
  store.isFeatureEnabled = () => true
})

beforeEach(() => {
  vi.clearAllMocks()
  const now = new Date()
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 1).getTime();
  store.history = { version: kHistoryVersion, folders: [], chats: [], quickPrompts: [] }
  for (let i = 0; i < 10; i++) {
    const chat = new Chat()
    chat.title = `Chat ${i}`
    chat.setEngineModel('mock', 'chat')
    chat.lastModified = todayStart - i * i/2 * 86400000
    chat.messages.push(new Message('system', 'System Prompt'))
    chat.messages.push(new Message('user', `Question ${i}`))
    chat.messages.push(new Message('assistant', `Subtitle ${i}`))
    store.addChat(chat)
  }
})

test('No chat', async () => {
  const wrapper: VueWrapper<any> = mount(ChatSidebar)
  expect(wrapper.exists()).toBe(true)
  expect(wrapper.find('.sp-sidebar').exists()).toBe(true)
  expect(wrapper.find('.sp-sidebar .chats').exists()).toBe(true)
  expect(wrapper.find('.sp-sidebar footer').exists()).toBe(true)
  expect(wrapper.find('.sp-sidebar footer.actions').exists()).toBe(false)
  expect(wrapper.find('.resizer').exists()).toBe(true)
})

test('New Chat', async () => {
  const wrapper: VueWrapper<any> = mount(ChatSidebar, withChatCallbacks({}))
  await wrapper.find('.sp-sidebar footer .new-chat').trigger('click')
  expect(chatCallbacksMock.onNewChat).toHaveBeenCalled()
})

test('Start and Cancel Selection', async () => {
  const wrapper: VueWrapper<any> = mount(ChatSidebar)
  await wrapper.find('.sp-sidebar .chat-list-tools button[name=select]').trigger('click')
  expect(wrapper.vm.selectMode).toBe(true)
  expect(wrapper.find('.sp-sidebar footer.select-actions').exists()).toBe(true)
  await wrapper.find('.sp-sidebar .chat-list-tools button[name=select]').trigger('click')
  expect(wrapper.vm.selectMode).toBe(false)
  expect(wrapper.find('.sp-sidebar footer.select-actions').exists()).toBe(false)
})

test('Delete Chat', async () => {
  const wrapper: VueWrapper<any> = mount(ChatSidebar, withChatCallbacks({}))
  await wrapper.find('.sp-sidebar .chat-list-tools button[name=select]').trigger('click')
  await wrapper.findAll('.sp-sidebar .chats .chat')[0].trigger('click')
  await wrapper.find('.sp-sidebar footer.select-actions button[name=delete]').trigger('click')
  expect(chatCallbacksMock.onDeleteChat).toHaveBeenLastCalledWith([store.history.chats[0].uuid])
  wrapper.vm.cancelSelectMode()
  await wrapper.vm.$nextTick()
  expect(wrapper.vm.selectMode).toBe(false)
  expect(wrapper.find('.sp-sidebar footer.actions').exists()).toBe(false)
})

test('Move Chat', async () => {
  store.config.appearance.chatList.mode = 'folder'
  const wrapper: VueWrapper<any> = mount(ChatSidebar, withChatCallbacks({}))
  await wrapper.find('.sp-sidebar .chat-list-tools button[name=select]').trigger('click')
  await wrapper.findAll('.sp-sidebar .chats .chat')[0].trigger('click')
  await wrapper.find('.sp-sidebar footer.select-actions button[name=move]').trigger('click')
  expect(chatCallbacksMock.onMoveChat).toHaveBeenLastCalledWith([store.history.chats[0].uuid])
  wrapper.vm.cancelSelectMode()
  await wrapper.vm.$nextTick()
  expect(wrapper.vm.selectMode).toBe(false)
  expect(wrapper.find('.sp-sidebar footer.select-actions button[name=move]').exists()).toBe(false)
})

test('Switches to folder mode', async () => {
  const wrapper: VueWrapper<any> = mount(ChatSidebar, { props: { displayMode: 'timeline', chat: undefined } } )
  await wrapper.find('.sp-sidebar .chat-list-tools .display-mode button[name=timeline]').trigger('click')
  expect(wrapper.vm.displayMode).toBe('timeline')
  await wrapper.find('.sp-sidebar .chat-list-tools .display-mode button[name=folders]').trigger('click')
  expect(wrapper.vm.displayMode).toBe('folder')
})

test('Filter Textbox', async () => {
  const wrapper: VueWrapper<any> = mount(ChatSidebar)
  await wrapper.find('.sp-sidebar .chat-list-tools button[name=search]').trigger('click')
  await wrapper.find('.sp-sidebar .chat-list-tools .search input[name=filter]').setValue('Test')
  await wrapper.find('.sp-sidebar .chat-list-tools .search input[name=filter]').trigger('keyup')
  expect(store.chatState.filter).toBe('Test')
})

test('Filter All', async () => {
  const wrapper: VueWrapper<any> = mount(ChatSidebar)
  wrapper.vm.filter = 'Subtitle'
  await wrapper.vm.$nextTick()
  expect(wrapper.findAll('.chat')).toHaveLength(10)
})

test('Filter Single', async () => {
  const wrapper: VueWrapper<any> = mount(ChatSidebar)
  wrapper.vm.filter = '9'
  await wrapper.vm.$nextTick()
  expect(wrapper.findAll('.chat')).toHaveLength(1)
  expect(wrapper.findAll('.chat').at(0)!.find('.title').text()).toBe('Chat 9')
})
