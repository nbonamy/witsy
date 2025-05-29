
import { vi, beforeAll, beforeEach, afterAll, expect, test } from 'vitest'
import { mount, VueWrapper, enableAutoUnmount } from '@vue/test-utils'
import { useWindowMock } from '../mocks/window'
import { store } from '../../src/services/store'
import ChatSidebar from '../../src/components/ChatSidebar.vue'
import Chat from '../../src/models/chat'

enableAutoUnmount(afterAll)

const onEventMock = vi.fn()
const emitEventMock = vi.fn()

vi.mock('../../src/composables/event_bus', async () => {
  return { default: () => ({
    onEvent: onEventMock,
    emitEvent: emitEventMock
  })}
})

beforeAll(() => {
  useWindowMock()
  store.load()
})

beforeEach(() => {
  vi.clearAllMocks()
  const chat = new Chat()
  chat.setEngineModel('mock', 'chat')
  store.history.chats = [chat]
})

test('No chat', async () => {
  const wrapper: VueWrapper<any> = mount(ChatSidebar)
  expect(wrapper.exists()).toBe(true)
  expect(wrapper.find('.panel').exists()).toBe(true)
  expect(wrapper.find('.panel .chats').exists()).toBe(true)
  expect(wrapper.find('.panel footer').exists()).toBe(true)
  expect(wrapper.find('.panel footer.actions').exists()).toBe(false)
  expect(wrapper.find('.resizer').exists()).toBe(true)
})

test('New Chat', async () => {
  const wrapper: VueWrapper<any> = mount(ChatSidebar)
  await wrapper.find('.panel header #new-chat').trigger('click')
  expect(emitEventMock).toHaveBeenLastCalledWith('new-chat', null)
})

// test('Switch to Folder Mode', async () => {
//   const wrapper: VueWrapper<any> = mount(Sidebar)
//   emitEvent('chat-list-mode', 'folder')
//   await wrapper.vm.$nextTick()
//   expect(store.config.appearance.chatList.mode).toBe('folder')
// })

test('Start and Cancel Delete', async () => {
  const wrapper: VueWrapper<any> = mount(ChatSidebar)
  await wrapper.find('.panel footer #select').trigger('click')
  expect(wrapper.vm.selectMode).toBe(true)
  expect(wrapper.find('.panel footer.actions').exists()).toBe(true)
  await wrapper.find('.panel footer.actions #cancel-delete').trigger('click')  
  expect(wrapper.vm.selectMode).toBe(false)
  expect(wrapper.find('.panel footer.actions').exists()).toBe(false)
})

test('Delete Chat', async () => {
  const wrapper: VueWrapper<any> = mount(ChatSidebar)
  await wrapper.find('.panel footer #select').trigger('click')
  await wrapper.findAll('.panel .chats .chat')[0].trigger('click')
  await wrapper.find('.panel footer.actions #delete').trigger('click')
  expect(emitEventMock).toHaveBeenLastCalledWith('delete-chat', [store.history.chats[0].uuid])
  wrapper.vm.cancelSelectMode()
  await wrapper.vm.$nextTick()
  expect(wrapper.vm.selectMode).toBe(false)
  expect(wrapper.find('.panel footer.actions').exists()).toBe(false)
})

test('Move Chat', async () => {
  store.config.appearance.chatList.mode = 'folder'
  const wrapper: VueWrapper<any> = mount(ChatSidebar)
  await wrapper.find('.panel footer #select').trigger('click')
  await wrapper.findAll('.panel .chats .chat')[0].trigger('click')
  await wrapper.find('.panel footer #move').trigger('click')
  expect(emitEventMock).toHaveBeenLastCalledWith('move-chat', [store.history.chats[0].uuid])
  wrapper.vm.cancelSelectMode()
  await wrapper.vm.$nextTick()
  expect(wrapper.vm.selectMode).toBe(false)
  expect(wrapper.find('.panel footer #move').exists()).toBe(false)
})

test('Filter Textbox', async () => {
  const wrapper: VueWrapper<any> = mount(ChatSidebar)
  await wrapper.find('.panel header #filter').setValue('Test')
  await wrapper.find('.panel header #filter').trigger('keyup')
  expect(store.chatState.filter).toBe('Test')
})
