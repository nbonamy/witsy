
import { vi, beforeAll, beforeEach, afterAll, expect, test } from 'vitest'
import { mount, VueWrapper, enableAutoUnmount } from '@vue/test-utils'
import { useWindowMock } from '../mocks/window'
import { store } from '../../src/services/store'
import Sidebar from '../../src/components/Sidebar.vue'
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
  const wrapper: VueWrapper<any> = mount(Sidebar)
  expect(wrapper.exists()).toBe(true)
  expect(wrapper.find('.sidebar').exists()).toBe(true)
  expect(wrapper.find('.sidebar .toolbar').exists()).toBe(true)
  expect(wrapper.find('.sidebar .chats').exists()).toBe(true)
  expect(wrapper.find('.sidebar .footer').exists()).toBe(true)
  expect(wrapper.find('.sidebar .footer.actions').exists()).toBe(false)
  expect(wrapper.find('.resizer').exists()).toBe(true)
})

test('New Chat', async () => {
  const wrapper: VueWrapper<any> = mount(Sidebar)
  await wrapper.find('.sidebar .toolbar #new-chat').trigger('click')
  expect(emitEventMock).toHaveBeenCalledWith('new-chat', null)
})

test('Open Settings', async () => {
  const wrapper: VueWrapper<any> = mount(Sidebar)
  await wrapper.find('.sidebar .footer #open-settings').trigger('click')
  expect(emitEventMock).toHaveBeenCalledWith('open-settings', { initialTab: 'general'})
})

// test('Switch to Folder Mode', async () => {
//   const wrapper: VueWrapper<any> = mount(Sidebar)
//   emitEvent('chat-list-mode', 'folder')
//   await wrapper.vm.$nextTick()
//   expect(store.config.appearance.chatList.mode).toBe('folder')
// })

test('Start and Cancel Delete', async () => {
  const wrapper: VueWrapper<any> = mount(Sidebar)
  await wrapper.find('.sidebar .footer #select').trigger('click')
  expect(wrapper.vm.selectMode).toBe(true)
  expect(wrapper.find('.sidebar .footer.actions').exists()).toBe(true)
  await wrapper.find('.sidebar .footer.actions #cancel-delete').trigger('click')  
  expect(wrapper.vm.selectMode).toBe(false)
  expect(wrapper.find('.sidebar .footer.actions').exists()).toBe(false)
})

test('Delete Chat', async () => {
  const wrapper: VueWrapper<any> = mount(Sidebar)
  await wrapper.find('.sidebar .footer #select').trigger('click')
  await wrapper.findAll('.sidebar .chats .chat')[0].trigger('click')
  await wrapper.find('.sidebar .footer.actions #delete').trigger('click')
  expect(emitEventMock).toHaveBeenCalledWith('delete-chat', [store.history.chats[0].uuid])
  wrapper.vm.cancelSelectMode()
  await wrapper.vm.$nextTick()
  expect(wrapper.vm.selectMode).toBe(false)
  expect(wrapper.find('.sidebar .footer.actions').exists()).toBe(false)
})

test('Move Chat', async () => {
  store.config.appearance.chatList.mode = 'folder'
  const wrapper: VueWrapper<any> = mount(Sidebar)
  await wrapper.find('.sidebar .footer #select').trigger('click')
  await wrapper.findAll('.sidebar .chats .chat')[0].trigger('click')
  await wrapper.find('.sidebar .footer.actions #move').trigger('click')
  expect(emitEventMock).toHaveBeenCalledWith('move-chat', [store.history.chats[0].uuid])
  wrapper.vm.cancelSelectMode()
  await wrapper.vm.$nextTick()
  expect(wrapper.vm.selectMode).toBe(false)
  expect(wrapper.find('.sidebar .footer.actions').exists()).toBe(false)
})

test('Filter Textbox', async () => {
  const wrapper: VueWrapper<any> = mount(Sidebar)
  await wrapper.find('.sidebar .toolbar #filter').setValue('Test')
  await wrapper.find('.sidebar .toolbar #filter').trigger('keyup')
  expect(store.chatFilter).toBe('Test')
})
