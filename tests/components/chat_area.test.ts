
import { vi, beforeAll, beforeEach, afterAll, expect, test } from 'vitest'
import { mount, VueWrapper, enableAutoUnmount } from '@vue/test-utils'
import { renderMarkdown } from '../../src/main/markdown'
import { store } from '../../src/services/store'
import ChatArea from '../../src/components/ChatArea.vue'
import defaultSettings from '../../defaults/settings.json'
import Message from '../../src/models/message'
import Chat from '../../src/models/chat'

enableAutoUnmount(afterAll)

const onEventMock = vi.fn()
const emitEventMock = vi.fn()

const stubTeleport = { global: { stubs: { teleport: true } } }

vi.mock('../../src/composables/event_bus.js', async () => {
  return { default: () => {
    return {
      onEvent: onEventMock,
      emitEvent: emitEventMock
    }
  }}
})

beforeAll(() => {

  // eslint-disable-next-line no-global-assign
  navigator = {
    mediaDevices: {
      getUserMedia: vi.fn()
    }
  }
  
  // api
  window.api = {
    on: vi.fn(),
    history: {
      save: vi.fn()
    },
    docrepo: {
      list: vi.fn(() => []),
    },
    markdown: {
      render: renderMarkdown
    }
  }
  
  // init store
  store.loadSettings = vi.fn()
  store.config = JSON.parse(JSON.stringify(defaultSettings))
})

let chat: Chat = null
beforeEach(() => {
  chat = new Chat()
  chat.setEngineModel('mock', 'chat')
})

const addMessagesToChat = () => {
  chat.addMessage(new Message('system', 'Hello'))
  chat.addMessage(new Message('user', 'Hi'))
}

test('No chat', async () => {
  const wrapper: VueWrapper<any> = mount(ChatArea, { props: { chat: null } } )
  expect(wrapper.exists()).toBe(true)
  expect(wrapper.find('.content').classes()).not.toContain('standalone')
  expect(wrapper.find('.toolbar').exists()).toBe(true)
  expect(wrapper.find('.toolbar .title').exists()).toBe(false)
  expect(wrapper.find('.toolbar .menu').exists()).toBe(false)
  expect(wrapper.find('.messages').exists()).toBe(false)
  expect(wrapper.find('.empty').exists()).toBe(true)
  expect(wrapper.find('.prompt').exists()).toBe(true)
})

test('With chat', async () => {
  addMessagesToChat()
  const wrapper: VueWrapper<any> = mount(ChatArea, { props: { chat: chat } } )
  expect(wrapper.exists()).toBe(true)
  expect(wrapper.find('.content').classes()).not.toContain('standalone')
  expect(wrapper.find('.toolbar').exists()).toBe(true)
  expect(wrapper.find('.toolbar .title').text()).toBe('New Chat')
  expect(wrapper.find('.toolbar .menu').exists()).toBe(true)
  expect(wrapper.find('.messages').exists()).toBe(true)
  expect(wrapper.find('.empty').exists()).toBe(false)
  expect(wrapper.find('.prompt').exists()).toBe(true)

})

test('Standalone chat', async () => {
  addMessagesToChat()
  const wrapper: VueWrapper<any> = mount(ChatArea, { props: { chat: chat, standalone: true } } )
  expect(wrapper.exists()).toBe(true)
  expect(wrapper.find('.content').classes()).toContain('standalone')
  expect(wrapper.find('.toolbar').exists()).toBe(true)
  expect(wrapper.find('.toolbar .title').text()).toBe('New Chat')
  expect(wrapper.find('.toolbar .menu').exists()).toBe(true)
  expect(wrapper.find('.messages').exists()).toBe(true)
  expect(wrapper.find('.empty').exists()).toBe(false)
  expect(wrapper.find('.prompt').exists()).toBe(true)
})

test('Context menu Normal', async () => {
  addMessagesToChat()
  const wrapper: VueWrapper<any> = mount(ChatArea, { props: { chat: chat } } )
  await wrapper.find('.toolbar .menu').trigger('click')
  expect(wrapper.vm.chatMenuActions).toStrictEqual([
    { label: 'mock chat', disabled: true },
    { label: 'Rename Chat', action: 'rename', disabled: false },
    { label: 'Export as PDF', action: 'exportPdf', disabled: false },
    { label: 'Delete', action: 'delete', disabled: false }
  ])
})

test('Context menu Standalone', async () => {
  addMessagesToChat()
  const wrapper: VueWrapper<any> = mount(ChatArea, { ...stubTeleport, props: { chat: chat, standalone: true } })
  await wrapper.find('.toolbar .menu').trigger('click')
  expect(wrapper.vm.chatMenuActions).toStrictEqual([
    { label: 'mock chat', disabled: true },
    { label: 'Save', action: 'save', disabled: false },
    { label: 'Rename Chat', action: 'rename', disabled: false },
    { label: 'Export as PDF', action: 'exportPdf', disabled: false },
    { label: 'Delete', action: 'delete', disabled: true }
  ])
})

test('Context menu rename', async () => {
  addMessagesToChat()
  const wrapper: VueWrapper<any> = mount(ChatArea, { ...stubTeleport, props: { chat: chat } } )
  await wrapper.find('.toolbar .menu').trigger('click')
  await wrapper.findAll('.context-menu .item')[1].trigger('click')
  expect(emitEventMock).toHaveBeenCalledWith('rename-chat', chat)
})

test('Context menu export', async () => {
  addMessagesToChat()
  const wrapper: VueWrapper<any> = mount(ChatArea, { ...stubTeleport, props: { chat: chat } } )
  await wrapper.find('.toolbar .menu').trigger('click')
  //await wrapper.findAll('.context-menu .item')[2].trigger('click')
  //expect(emitEventMock).toHaveBeenCalledWith('delete-chat', chat)
})

test('Context menu delete', async () => {
  addMessagesToChat()
  const wrapper: VueWrapper<any> = mount(ChatArea, { ...stubTeleport, props: { chat: chat } } )
  await wrapper.find('.toolbar .menu').trigger('click')
  await wrapper.findAll('.context-menu .item')[3].trigger('click')
  expect(emitEventMock).toHaveBeenCalledWith('delete-chat', chat.uuid)
})

test('Context menu save', async () => {
  addMessagesToChat()
  const wrapper: VueWrapper<any> = mount(ChatArea, { ...stubTeleport, props: { chat: chat, standalone: true } } )
  await wrapper.find('.toolbar .menu').trigger('click')
  await wrapper.findAll('.context-menu .item')[1].trigger('click')
  expect(store.chats).toHaveLength(1)
  expect(store.chats[0]).toStrictEqual(chat)
  //TODO test store.saveHistory
})
