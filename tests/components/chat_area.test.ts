
import { mount, VueWrapper, enableAutoUnmount } from '@vue/test-utils'
import { vi, beforeAll, beforeEach, afterAll, expect, test } from 'vitest'
import ChatArea from '../../src/components/ChatArea.vue'
import { store } from '../../src/services/store'
import defaults from '../../defaults/settings.json'
import Chat from '../../src/models/chat'
import Message from '../../src/models/message'

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

beforeAll(() => {
  store.config = defaults
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
  expect(wrapper.find('.toolbar .title').text()).toBe('')
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
    { label: 'Delete', action: 'delete', disabled: false }
  ])
})

test('Context menu Standalone', async () => {
  addMessagesToChat()
  const wrapper: VueWrapper<any> = mount(ChatArea, { props: { chat: chat, standalone: true } } )
  await wrapper.find('.toolbar .menu').trigger('click')
  expect(wrapper.vm.chatMenuActions).toStrictEqual([
    { label: 'mock chat', disabled: true },
    { label: 'Save', action: 'save', disabled: false },
    { label: 'Rename Chat', action: 'rename', disabled: false },
    { label: 'Delete', action: 'delete', disabled: true }
  ])
})

test('Context menu rename', async () => {
  addMessagesToChat()
  const wrapper: VueWrapper<any> = mount(ChatArea, { props: { chat: chat } } )
  await wrapper.find('.toolbar .menu').trigger('click')
  await wrapper.findAll('.context-menu .item')[1].trigger('click')
  expect(emitEventMock).toHaveBeenCalledWith('renameChat', chat)
})

test('Context menu delete', async () => {
  addMessagesToChat()
  const wrapper: VueWrapper<any> = mount(ChatArea, { props: { chat: chat } } )
  await wrapper.find('.toolbar .menu').trigger('click')
  await wrapper.findAll('.context-menu .item')[2].trigger('click')
  expect(emitEventMock).toHaveBeenCalledWith('deleteChat', chat)
})

test('Context menu save', async () => {
  addMessagesToChat()
  const wrapper: VueWrapper<any> = mount(ChatArea, { props: { chat: chat, standalone: true } } )
  await wrapper.find('.toolbar .menu').trigger('click')
  await wrapper.findAll('.context-menu .item')[1].trigger('click')
  expect(store.chats).toHaveLength(1)
  expect(store.chats[0]).toStrictEqual(chat)
  //TODO test store.saveHistory
})
