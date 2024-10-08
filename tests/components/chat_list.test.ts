
import { vi, beforeAll, beforeEach, afterAll, expect, test } from 'vitest'
import { mount, VueWrapper, enableAutoUnmount } from '@vue/test-utils'
import { store } from '../../src/services/store'
import ChatList from '../../src/components/ChatList.vue'
import defaults from '../../defaults/settings.json'
import Chat from '../../src/models/chat'
import Message from '../../src/models/message'

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
  // init store
  store.config = defaults
  store.config.getActiveModel = () => {
    return 'chat'
  }
})

beforeEach(() => {
  const now = new Date()
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 1).getTime();
  store.chats = []
  for (let i = 0; i < 10; i++) {
    const chat = new Chat()
    chat.title = `Chat ${i}`
    chat.setEngineModel('mock', 'chat')
    chat.lastModified = todayStart - i * i/2 * 86400000
    chat.messages.push(new Message('system', 'System Prompt'))
    chat.messages.push(new Message('user', `Question ${i}`))
    chat.messages.push(new Message('assistant', `Subtitle ${i}`))
    store.chats.push(chat)
  }
})

test('No chat', async () => {
  store.chats = []
  const wrapper: VueWrapper<any> = mount(ChatList, { props: { chat: null, filter: '' } } )
  expect(wrapper.exists()).toBe(true)
  expect(wrapper.find('.chats').classes()).not.toContain('standalone')
})

test('Shows chats', async () => {
  const wrapper: VueWrapper<any> = mount(ChatList, { props: { chat: null, filter: '' } } )
  expect(wrapper.findAll('.chat')).toHaveLength(10)
  expect(wrapper.findAll('.selected')).toHaveLength(0)
  expect(wrapper.findAll('.select')).toHaveLength(0)
  wrapper.findAll('.chat').forEach((chat, i) => {
    expect(chat.find('.title').text()).toBe(`Chat ${i}`)
    expect(chat.find('.subtitle').text()).toBe(`Subtitle ${i}`)
  })
})

test('Shows day indicator', async () => {
  const wrapper: VueWrapper<any> = mount(ChatList, { props: { chat: null, filter: '' } } )
  expect(wrapper.findAll('.day')).toHaveLength(6)
  expect(wrapper.findAll('.day').at(0).text()).toBe('Today')
  expect(wrapper.findAll('.day').at(1).text()).toBe('Yesterday')
  expect(wrapper.findAll('.day').at(2).text()).toBe('Last 7 days')
  expect(wrapper.findAll('.day').at(3).text()).toBe('Last 14 days')
  expect(wrapper.findAll('.day').at(4).text()).toBe('Last 30 days')
  expect(wrapper.findAll('.day').at(5).text()).toBe('Earlier')
  expect(wrapper.findAll('[data-day=Today]')).toHaveLength(1)
  expect(wrapper.findAll('[data-day=Yesterday]')).toHaveLength(1)
  expect(wrapper.findAll('[data-day="Last 7 days"]')).toHaveLength(2)
  expect(wrapper.findAll('[data-day="Last 14 days"]')).toHaveLength(2)
  expect(wrapper.findAll('[data-day="Last 30 days"]')).toHaveLength(2)
  expect(wrapper.findAll('[data-day="Earlier"]')).toHaveLength(2)
})

test('Select chat', async () => {
  const wrapper: VueWrapper<any> = mount(ChatList, { props: { chat: null, filter: '' } } )
  expect(wrapper.findAll('.selected')).toHaveLength(0)
  await wrapper.findAll('.chat').at(3).trigger('click')
  expect(emitEventMock).toHaveBeenCalledWith('select-chat', store.chats[3])
})

test('Shows selection', async () => {
  const wrapper: VueWrapper<any> = mount(ChatList, { props: { chat: store.chats[3], filter: '' } } )
  expect(wrapper.findAll('.selected')).toHaveLength(1)
  expect(wrapper.findAll('.selected').at(0).find('.title').text()).toBe('Chat 3')
})

test('Filter All', async () => {
  const wrapper: VueWrapper<any> = mount(ChatList, { props: { chat: null, filter: 'Subtitle' } } )
  expect(wrapper.findAll('.chat')).toHaveLength(10)
})

test('Filter Single', async () => {
  const wrapper: VueWrapper<any> = mount(ChatList, { props: { chat: null, filter: '9' } } )
  expect(wrapper.findAll('.chat')).toHaveLength(1)
  expect(wrapper.findAll('.chat').at(0).find('.title').text()).toBe('Chat 9')
})

test('Multiselect', async () => {
  const wrapper: VueWrapper<any> = mount(ChatList, { props: { chat: null, filter: '', selectMode: true } } )
  expect(wrapper.findAll('.select')).toHaveLength(10)
  expect(wrapper.findAll('.select .selected')).toHaveLength(0)
  await wrapper.findAll('.chat').at(3).trigger('click')
  expect(wrapper.findAll('.select .selected')).toHaveLength(1)
  await wrapper.findAll('.chat').at(5).trigger('click')
  expect(wrapper.findAll('.select .selected')).toHaveLength(2)
  await wrapper.findAll('.chat').at(5).trigger('click')
  expect(wrapper.findAll('.select .selected')).toHaveLength(1)
})

test('Context Menu', async () => {
  const wrapper: VueWrapper<any> = mount(ChatList, { ...stubTeleport, props: { chat: null, filter: '' } } )
  expect(wrapper.findAll('.context-menu')).toHaveLength(0)
  await wrapper.findAll('.chat').at(3).trigger('contextmenu')
  expect(wrapper.findAll('.context-menu')).toHaveLength(1)
  expect(wrapper.vm.contextMenuActions).toStrictEqual([
    { label: 'Rename Chat', action: 'rename' },
    { label: 'Delete', action: 'delete' },
  ])
})

test('Rename Chat', async () => {
  const wrapper: VueWrapper<any> = mount(ChatList, { ...stubTeleport, props: { chat: null, filter: '' } } )
  await wrapper.findAll('.chat').at(3).trigger('contextmenu')
  await wrapper.findAll('.context-menu .item')[0].trigger('click')
  expect(emitEventMock).toHaveBeenCalledWith('rename-chat', store.chats[3])
})

test('Delete Chat', async () => {
  const wrapper: VueWrapper<any> = mount(ChatList, { ...stubTeleport, props: { chat: null, filter: '' } } )
  await wrapper.findAll('.chat').at(3).trigger('contextmenu')
  await wrapper.findAll('.context-menu .item')[1].trigger('click')
  expect(emitEventMock).toHaveBeenCalledWith('delete-chat', store.chats[3].uuid)
})
