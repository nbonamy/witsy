
import { vi, beforeAll, beforeEach, afterAll, expect, test } from 'vitest'
import { mount, VueWrapper, enableAutoUnmount } from '@vue/test-utils'
import { store } from '../../src/services/store'
import Sidebar from '../../src/components/Sidebar.vue'
import defaults from '../../defaults/settings.json'
import Chat from '../../src/models/chat'

enableAutoUnmount(afterAll)

const onEventMock = vi.fn()
const emitEventMock = vi.fn()

window.api = {
  store: {
    get: vi.fn(() => null),
  },
}

vi.mock('../../src/composables/event_bus.js', async () => {
  return { default: () => {
    return {
      onEvent: onEventMock,
      emitEvent: emitEventMock
    }
  }}
})

beforeAll(() => {
  // init store
  store.config = defaults
  store.config.getActiveModel = () => {
    return 'chat'
  }
})

beforeEach(() => {
  vi.clearAllMocks()
  const chat = new Chat()
  chat.setEngineModel('mock', 'chat')
  store.chats = [chat]
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
  expect(emitEventMock).toHaveBeenCalledWith('new-chat')
})

test('Open Settings', async () => {
  const wrapper: VueWrapper<any> = mount(Sidebar)
  await wrapper.find('.sidebar .footer #open-settings').trigger('click')
  expect(emitEventMock).toHaveBeenCalledWith('open-settings', { initialTab: 'general'})
})

test('Start and Cancel Delete', async () => {
  const wrapper: VueWrapper<any> = mount(Sidebar)
  await wrapper.find('.sidebar .footer #start-delete').trigger('click')
  expect(wrapper.vm.deleteMode).toBe(true)
  expect(wrapper.find('.sidebar .footer.actions').exists()).toBe(true)
  await wrapper.find('.sidebar .footer.actions #cancel-delete').trigger('click')  
  expect(wrapper.vm.deleteMode).toBe(false)
  expect(wrapper.find('.sidebar .footer.actions').exists()).toBe(false)
})

test('Delete Chat', async () => {
  const wrapper: VueWrapper<any> = mount(Sidebar)
  await wrapper.find('.sidebar .footer #start-delete').trigger('click')
  await wrapper.findAll('.sidebar .chats .chat')[0].trigger('click')
  await wrapper.find('.sidebar .footer.actions #delete').trigger('click')
  expect(emitEventMock).toHaveBeenCalledWith('delete-chat', [store.chats[0].uuid])
  expect(wrapper.vm.deleteMode).toBe(false)
  expect(wrapper.find('.sidebar .footer.actions').exists()).toBe(false)
})

test('Filter Textbox', async () => {
  const wrapper: VueWrapper<any> = mount(Sidebar)
  await wrapper.find('.sidebar .toolbar #filter').setValue('Test')
  await wrapper.find('.sidebar .toolbar #filter').trigger('keyup')
  expect(store.chatFilter).toBe('Test')
})
