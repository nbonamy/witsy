
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

vi.mock('../../src/composables/event_bus', async () => {
  return { default: () => ({
    onEvent: onEventMock,
    emitEvent: emitEventMock
  })}
})

beforeAll(() => {
  // init store
  store.config = defaults
})

beforeEach(() => {
  vi.clearAllMocks()
  const now = new Date()
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 1).getTime();
  store.history = { folders: [], chats: [] }
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
  store.history.chats = []
  const wrapper: VueWrapper<any> = mount(ChatList, { props: { displayMode: 'timeline', chat: undefined, filter: '' } } )
  expect(wrapper.exists()).toBe(true)
})

test('Shows chats', async () => {
  const wrapper: VueWrapper<any> = mount(ChatList, { props: { displayMode: 'timeline', chat: undefined, filter: '' } } )
  expect(wrapper.findAll('.chat')).toHaveLength(10)
  expect(wrapper.findAll('.selected')).toHaveLength(0)
  expect(wrapper.findAll('.select')).toHaveLength(0)
  wrapper.findAll('.chat').forEach((chat, i) => {
    expect(chat.find('.title').text()).toBe(`Chat ${i}`)
    expect(chat.find('.subtitle').text()).toBe(`Subtitle ${i}`)
  })
})

test('Switches to folder mode', async () => {
  const wrapper: VueWrapper<any> = mount(ChatList, { props: { displayMode: 'timeline', chat: undefined, filter: '' } } )
  await wrapper.find('.button-group button:nth-child(1)').trigger('click')
  expect(emitEventMock).toHaveBeenCalledWith('chat-list-mode', 'timeline')
  await wrapper.find('.button-group button:nth-child(2)').trigger('click')
  expect(emitEventMock).toHaveBeenCalledWith('chat-list-mode', 'folder')
})

test('Shows day indicator', async () => {
  const wrapper: VueWrapper<any> = mount(ChatList, { props: { displayMode: 'timeline', chat: undefined, filter: '' } } )
  expect(wrapper.findAll('.day')).toHaveLength(6)
  expect(wrapper.findAll('.day').at(0)!.text()).toBe('Today')
  expect(wrapper.findAll('.day').at(1)!.text()).toBe('Yesterday')
  expect(wrapper.findAll('.day').at(2)!.text()).toBe('Last 7 days')
  expect(wrapper.findAll('.day').at(3)!.text()).toBe('Last 14 days')
  expect(wrapper.findAll('.day').at(4)!.text()).toBe('Last 30 days')
  expect(wrapper.findAll('.day').at(5)!.text()).toBe('Earlier')
  expect(wrapper.findAll('[data-day=Today]')).toHaveLength(1)
  expect(wrapper.findAll('[data-day=Yesterday]')).toHaveLength(1)
  expect(wrapper.findAll('[data-day="Last 7 days"]')).toHaveLength(2)
  expect(wrapper.findAll('[data-day="Last 14 days"]')).toHaveLength(2)
  expect(wrapper.findAll('[data-day="Last 30 days"]')).toHaveLength(2)
  expect(wrapper.findAll('[data-day="Earlier"]')).toHaveLength(2)
})

test('Shows folders indicator', async () => {
  store.history.folders = [
    { id: '1', name: 'Great', chats: [store.history.chats[0].uuid, store.history.chats[1].uuid ] },
    { id: '2', name: 'Wonderful', chats: [store.history.chats[2].uuid, store.history.chats[3].uuid, store.history.chats[4].uuid] }
  ]
  localStorage.setItem('expandedFolders', `${store.rootFolder.id},2`)
  const wrapper: VueWrapper<any> = mount(ChatList, { props: { displayMode: 'folder', chat: undefined, filter: '' } } )
  await wrapper.vm.$nextTick()
  expect(wrapper.findAll('section')).toHaveLength(3)
  expect(wrapper.find('section:nth-child(1) .folder').text()).toBe('▶ Great')
  expect(wrapper.find('section:nth-child(2) .folder').text()).toBe('▼ Wonderful')
  expect(wrapper.find('section:nth-child(3) .folder').text()).toBe('▼ Unsorted')
  expect(wrapper.findAll('section:nth-child(1) .chat')).toHaveLength(0)
  expect(wrapper.findAll('section:nth-child(2) .chat')).toHaveLength(3)
  expect(wrapper.findAll('section:nth-child(3) .chat')).toHaveLength(5)
})

test('Toggles folder state', async () => {
  store.history.folders = [
    { id: '1', name: 'Great', chats: [store.history.chats[0].uuid, store.history.chats[1].uuid ] },
    { id: '2', name: 'Wonderful', chats: [store.history.chats[2].uuid, store.history.chats[3].uuid, store.history.chats[4].uuid] }
  ]
  localStorage.setItem('expandedFolders', `${store.rootFolder.id},2`)
  const wrapper: VueWrapper<any> = mount(ChatList, { props: { displayMode: 'folder', chat: undefined, filter: '' } } )
  await wrapper.vm.$nextTick()
  await wrapper.find('section:nth-child(1) .folder span').trigger('click')
  await wrapper.find('section:nth-child(2) .folder span').trigger('click')
  await wrapper.vm.$nextTick()
  expect(localStorage.getItem('expandedFolders')).toBe(`${store.rootFolder.id},1`)
})

test('Select chat', async () => {
  const wrapper: VueWrapper<any> = mount(ChatList, { props: { displayMode: 'timeline', chat: undefined, filter: '' } } )
  expect(wrapper.findAll('.selected')).toHaveLength(0)
  await wrapper.findAll('.chat').at(3)!.trigger('click')
  expect(emitEventMock).toHaveBeenCalledWith('select-chat', store.history.chats[3])
})

test('Select chat', async () => {
  const wrapper: VueWrapper<any> = mount(ChatList, { props: { displayMode: 'folder', chat: undefined, filter: '' } } )
  expect(wrapper.findAll('.selected')).toHaveLength(0)
  await wrapper.findAll('.chat').at(3)!.trigger('click')
  expect(emitEventMock).toHaveBeenCalledWith('select-chat', store.history.chats[3])
})

test('Shows selection', async () => {
  const wrapper: VueWrapper<any> = mount(ChatList, { props: { displayMode: 'timeline', chat: store.history.chats[3], filter: '' } } )
  expect(wrapper.findAll('.selected')).toHaveLength(1)
  expect(wrapper.findAll('.selected').at(0)!.find('.title').text()).toBe('Chat 3')
})

test('Filter All', async () => {
  const wrapper: VueWrapper<any> = mount(ChatList, { props: { displayMode: 'timeline', chat: undefined, filter: 'Subtitle' } } )
  expect(wrapper.findAll('.chat')).toHaveLength(10)
})

test('Filter Single', async () => {
  const wrapper: VueWrapper<any> = mount(ChatList, { props: { displayMode: 'timeline', chat: undefined, filter: '9' } } )
  expect(wrapper.findAll('.chat')).toHaveLength(1)
  expect(wrapper.findAll('.chat').at(0)!.find('.title').text()).toBe('Chat 9')
})

test('Multiselect', async () => {
  const wrapper: VueWrapper<any> = mount(ChatList, { props: { displayMode: 'timeline', chat: undefined, filter: '', selectMode: true } } )
  expect(wrapper.findAll('.select')).toHaveLength(10)
  expect(wrapper.findAll('.select .selected')).toHaveLength(0)
  await wrapper.findAll('.chat').at(3)!.trigger('click')
  expect(wrapper.findAll('.select .selected')).toHaveLength(1)
  await wrapper.findAll('.chat').at(5)!.trigger('click')
  expect(wrapper.findAll('.select .selected')).toHaveLength(2)
  await wrapper.findAll('.chat').at(5)!.trigger('click')
  expect(wrapper.findAll('.select .selected')).toHaveLength(1)
})

test('Context Menu Timeline Mode', async () => {
  const wrapper: VueWrapper<any> = mount(ChatList, { ...stubTeleport, props: { displayMode: 'timeline', chat: undefined, filter: '' } } )
  expect(wrapper.findAll('.context-menu')).toHaveLength(0)
  await wrapper.findAll('.chat').at(3)!.trigger('contextmenu')
  expect(wrapper.findAll('.context-menu')).toHaveLength(1)
  expect(wrapper.vm.contextMenuActions()).toStrictEqual([
    { label: 'Rename', action: 'rename' },
    { label: 'Delete', action: 'delete' },
  ])
})

test('Context Menu Folder Mode', async () => {
  const wrapper: VueWrapper<any> = mount(ChatList, { ...stubTeleport, props: { displayMode: 'folder', chat: undefined, filter: '' } } )
  expect(wrapper.findAll('.context-menu')).toHaveLength(0)
  await wrapper.findAll('.chat').at(3)!.trigger('contextmenu')
  expect(wrapper.findAll('.context-menu')).toHaveLength(1)
  expect(wrapper.vm.contextMenuActions()).toStrictEqual([
    { label: 'Rename', action: 'rename' },
    { label: 'Move', action: 'move' },
    { label: 'Delete', action: 'delete' },
  ])
})

test('Rename Chat', async () => {
  const wrapper: VueWrapper<any> = mount(ChatList, { ...stubTeleport, props: { displayMode: 'timeline', chat: undefined, filter: '' } } )
  await wrapper.findAll('.chat').at(3)!.trigger('contextmenu')
  await wrapper.findAll('.context-menu .item')[0].trigger('click')
  expect(emitEventMock).toHaveBeenCalledWith('rename-chat', store.history.chats[3])
})

test('Delete Chat', async () => {
  const wrapper: VueWrapper<any> = mount(ChatList, { ...stubTeleport, props: { displayMode: 'timeline', chat: undefined, filter: '' } } )
  await wrapper.findAll('.chat').at(3)!.trigger('contextmenu')
  await wrapper.findAll('.context-menu .item')[1].trigger('click')
  expect(emitEventMock).toHaveBeenCalledWith('delete-chat', store.history.chats[3].uuid)
})

test('Move Chat', async () => {
  const wrapper: VueWrapper<any> = mount(ChatList, { ...stubTeleport, props: { displayMode: 'folder', chat: undefined, filter: '' } } )
  await wrapper.findAll('.chat').at(3)!.trigger('contextmenu')
  await wrapper.findAll('.context-menu .item')[1].trigger('click')
  expect(emitEventMock).toHaveBeenCalledWith('move-chat', store.history.chats[3].uuid)
})

test('Context Menu Folder', async () => {
  store.history.folders = [ { id: '1', name: 'Folder', chats: [store.history.chats[0].uuid] } ]
  const wrapper: VueWrapper<any> = mount(ChatList, { ...stubTeleport, props: { displayMode: 'folder', chat: undefined, filter: '' } } )
  expect(wrapper.findAll('.context-menu')).toHaveLength(0)
  await wrapper.findAll('section').at(0)!.find('.menu').trigger('click')
  expect(wrapper.findAll('.context-menu')).toHaveLength(1)
  expect(wrapper.findAll('.context-menu .actions > div')).toHaveLength(3)
  expect(wrapper.findAll('.context-menu .actions > div').at(0)!.text()).toBe('New chat')
  expect(wrapper.findAll('.context-menu .actions > div').at(1)!.text()).toBe('Rename')
  expect(wrapper.findAll('.context-menu .actions > div').at(2)!.text()).toBe('Delete')
})

test('New Chat', async () => {
  store.history.folders = [ { id: '1', name: 'Folder', chats: [store.history.chats[0].uuid] } ]
  const wrapper: VueWrapper<any> = mount(ChatList, { ...stubTeleport, props: { displayMode: 'folder', chat: undefined, filter: '' } } )
  await wrapper.findAll('section').at(0)!.find('.menu').trigger('click')
  await wrapper.findAll('.context-menu .actions > div').at(0)!.trigger('click')
  expect(emitEventMock).toHaveBeenCalledWith('new-chat-in-folder', '1')
})

test('Rename Folder', async () => {
  store.history.folders = [ { id: '1', name: 'Folder', chats: [store.history.chats[0].uuid] } ]
  const wrapper: VueWrapper<any> = mount(ChatList, { ...stubTeleport, props: { displayMode: 'folder', chat: undefined, filter: '' } } )
  await wrapper.findAll('section').at(0)!.find('.menu').trigger('click')
  await wrapper.findAll('.context-menu .actions > div').at(1)!.trigger('click')
  expect(emitEventMock).toHaveBeenCalledWith('rename-folder', '1')
})

test('Delete Folder', async () => {
  store.history.folders = [ { id: '1', name: 'Folder', chats: [store.history.chats[0].uuid] } ]
  const wrapper: VueWrapper<any> = mount(ChatList, { ...stubTeleport, props: { displayMode: 'folder', chat: undefined, filter: '' } } )
  await wrapper.findAll('section').at(0)!.find('.menu').trigger('click')
  await wrapper.findAll('.context-menu .actions > div').at(2)!.trigger('click')
  expect(emitEventMock).toHaveBeenCalledWith('delete-folder', '1')
})
