
import { vi, beforeAll, beforeEach, afterAll, expect, test } from 'vitest'
import { mount, VueWrapper, enableAutoUnmount } from '@vue/test-utils'
import { createDialogMock } from '../mocks/index'
import { useWindowMock } from '../mocks/window'
import { stubTeleport } from '../mocks/stubs'
import { store } from '../../src/services/store'
import ChatList from '../../src/components/ChatList.vue'
import Chat from '../../src/models/chat'
import Message from '../../src/models/message'

enableAutoUnmount(afterAll)

const onEventMock = vi.fn()
const emitEventMock = vi.fn()

vi.mock('../../src/composables/dialog', async () => {
  return createDialogMock()
})

vi.mock('../../src/services/i18n', async () => {
  return {
    t: (key: string) => `${key}`,
  }
})

vi.mock('../../src/composables/event_bus', async () => {
  return { default: () => ({
    onEvent: onEventMock,
    emitEvent: emitEventMock
  })}
})

beforeAll(() => {
  useWindowMock()
  store.loadSettings()
})

beforeEach(() => {
  vi.clearAllMocks()
  const now = new Date()
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 1).getTime();
  store.history = { folders: [], chats: [], quickPrompts: [] }
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
  expect(emitEventMock).toHaveBeenLastCalledWith('chat-list-mode', 'timeline')
  await wrapper.find('.button-group button:nth-child(2)').trigger('click')
  expect(emitEventMock).toHaveBeenLastCalledWith('chat-list-mode', 'folder')
})

test('Shows day indicator', async () => {
  const wrapper: VueWrapper<any> = mount(ChatList, { props: { displayMode: 'timeline', chat: undefined, filter: '' } } )
  expect(wrapper.findAll('.day')).toHaveLength(6)
  expect(wrapper.findAll('.day').at(0)!.text()).toBe('chatList.timeline.today')
  expect(wrapper.findAll('.day').at(1)!.text()).toBe('chatList.timeline.yesterday')
  expect(wrapper.findAll('.day').at(2)!.text()).toBe('chatList.timeline.last7days')
  expect(wrapper.findAll('.day').at(3)!.text()).toBe('chatList.timeline.last14days')
  expect(wrapper.findAll('.day').at(4)!.text()).toBe('chatList.timeline.last30days')
  expect(wrapper.findAll('.day').at(5)!.text()).toBe('chatList.timeline.earlier')
  expect(wrapper.findAll('[data-day="chatList.timeline.today"]')).toHaveLength(1)
  expect(wrapper.findAll('[data-day="chatList.timeline.yesterday"]')).toHaveLength(1)
  expect(wrapper.findAll('[data-day="chatList.timeline.last7days"]')).toHaveLength(2)
  expect(wrapper.findAll('[data-day="chatList.timeline.last14days"]')).toHaveLength(2)
  expect(wrapper.findAll('[data-day="chatList.timeline.last30days"]')).toHaveLength(2)
  expect(wrapper.findAll('[data-day="chatList.timeline.earlier"]')).toHaveLength(2)
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
  expect(emitEventMock).toHaveBeenLastCalledWith('select-chat', store.history.chats[3])
})

test('Select chat', async () => {
  const wrapper: VueWrapper<any> = mount(ChatList, { props: { displayMode: 'folder', chat: undefined, filter: '' } } )
  expect(wrapper.findAll('.selected')).toHaveLength(0)
  await wrapper.findAll('.chat').at(3)!.trigger('click')
  expect(emitEventMock).toHaveBeenLastCalledWith('select-chat', store.history.chats[3])
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
    { label: 'common.rename', action: 'rename' },
    { label: 'common.delete', action: 'delete' },
  ])
})

test('Context Menu Folder Mode', async () => {
  const wrapper: VueWrapper<any> = mount(ChatList, { ...stubTeleport, props: { displayMode: 'folder', chat: undefined, filter: '' } } )
  expect(wrapper.findAll('.context-menu')).toHaveLength(0)
  await wrapper.findAll('.chat').at(3)!.trigger('contextmenu')
  expect(wrapper.findAll('.context-menu')).toHaveLength(1)
  expect(wrapper.vm.contextMenuActions()).toStrictEqual([
    { label: 'common.rename', action: 'rename' },
    { label: 'common.move', action: 'move' },
    { label: 'common.delete', action: 'delete' },
  ])
})

test('Rename Chat', async () => {
  const wrapper: VueWrapper<any> = mount(ChatList, { ...stubTeleport, props: { displayMode: 'timeline', chat: undefined, filter: '' } } )
  await wrapper.findAll('.chat').at(3)!.trigger('contextmenu')
  await wrapper.findAll('.context-menu .item')[0].trigger('click')
  expect(emitEventMock).toHaveBeenLastCalledWith('rename-chat', store.history.chats[3])
})

test('Delete Chat', async () => {
  const wrapper: VueWrapper<any> = mount(ChatList, { ...stubTeleport, props: { displayMode: 'timeline', chat: undefined, filter: '' } } )
  await wrapper.findAll('.chat').at(3)!.trigger('contextmenu')
  await wrapper.findAll('.context-menu .item')[1].trigger('click')
  expect(emitEventMock).toHaveBeenLastCalledWith('delete-chat', store.history.chats[3].uuid)
})

test('Move Chat', async () => {
  const wrapper: VueWrapper<any> = mount(ChatList, { ...stubTeleport, props: { displayMode: 'folder', chat: undefined, filter: '' } } )
  await wrapper.findAll('.chat').at(3)!.trigger('contextmenu')
  await wrapper.findAll('.context-menu .item')[1].trigger('click')
  expect(emitEventMock).toHaveBeenLastCalledWith('move-chat', store.history.chats[3].uuid)
})

test('Context Menu Folder', async () => {
  store.history.folders = [ { id: '1', name: 'Folder', chats: [store.history.chats[0].uuid] } ]
  const wrapper: VueWrapper<any> = mount(ChatList, { ...stubTeleport, props: { displayMode: 'folder', chat: undefined, filter: '' } } )
  expect(wrapper.findAll('.context-menu')).toHaveLength(0)
  await wrapper.findAll('section').at(0)!.find('.menu').trigger('click')
  expect(wrapper.findAll('.context-menu')).toHaveLength(1)
  expect(wrapper.findAll('.context-menu .actions .item')).toHaveLength(4)
  expect(wrapper.findAll('.context-menu .actions .item').at(0)!.text()).toBe('common.newChat')
  expect(wrapper.findAll('.context-menu .actions .item').at(1)!.text()).toBe('common.rename')
  expect(wrapper.findAll('.context-menu .actions .item').at(2)!.text()).toBe('chatList.folder.actions.setDefaults')
  expect(wrapper.findAll('.context-menu .actions .item').at(3)!.text()).toBe('chatList.folder.actions.delete')
})

test('New Chat', async () => {
  store.history.folders = [ { id: '1', name: 'Folder', chats: [store.history.chats[0].uuid] } ]
  const wrapper: VueWrapper<any> = mount(ChatList, { ...stubTeleport, props: { displayMode: 'folder', chat: undefined, filter: '' } } )
  await wrapper.findAll('section').at(0)!.find('.menu').trigger('click')
  await wrapper.find('.context-menu .actions .item[data-action=chat]').trigger('click')
  expect(emitEventMock).toHaveBeenLastCalledWith('new-chat-in-folder', '1')
})

test('Rename Folder', async () => {
  store.history.folders = [ { id: '1', name: 'Folder', chats: [store.history.chats[0].uuid] } ]
  const wrapper: VueWrapper<any> = mount(ChatList, { ...stubTeleport, props: { displayMode: 'folder', chat: undefined, filter: '' } } )
  await wrapper.findAll('section').at(0)!.find('.menu').trigger('click')
  await wrapper.find('.context-menu .actions .item[data-action=rename]').trigger('click')
  expect(emitEventMock).toHaveBeenLastCalledWith('rename-folder', '1')
})

test('Delete Folder', async () => {
  store.history.folders = [ { id: '1', name: 'Folder', chats: [store.history.chats[0].uuid] } ]
  const wrapper: VueWrapper<any> = mount(ChatList, { ...stubTeleport, props: { displayMode: 'folder', chat: undefined, filter: '' } } )
  await wrapper.findAll('section').at(0)!.find('.menu').trigger('click')
  await wrapper.find('.context-menu .actions .item[data-action=delete]').trigger('click')
  expect(emitEventMock).toHaveBeenLastCalledWith('delete-folder', '1')
})

test('Folder defaults', async () => {

  const chat = Chat.fromJson({
    uuid: '1',
    title: 'Chat 1',
    engine: 'mock',
    model: 'chat',
    disableStreaming: false,
    tools: [],
    instructions: 'instructions',
    locale: 'locale',
    docrepo: 'docrepo',
    messages: [],
    modelOpts: {
      temperature: 0.7,
      customOpts: {
        custom: 'custom'
      } 
    }
  })
  store.history.folders = [ { id: '1', name: 'Folder', chats: [store.history.chats[0].uuid] } ]
  const wrapper: VueWrapper<any> = mount(ChatList, { ...stubTeleport, props: { displayMode: 'folder', chat: chat, filter: '' } } )

  // set defaults
  await wrapper.findAll('section').at(0)!.find('.menu').trigger('click')
  await wrapper.find('.context-menu .actions .item[data-action=setDefaults]').trigger('click')
  expect(store.history.folders[0].defaults).toStrictEqual({
    engine: 'mock',
    model: 'chat',
    disableStreaming: false,
    tools: [],
    instructions: 'instructions',
    locale: 'locale',
    docrepo: 'docrepo',
    expert: null,//'expert',
    modelOpts: {
      temperature: 0.7,
      customOpts: {
        custom: 'custom'
      } 
    }
  })

  // experts
  chat.messages = [
    Message.fromJson({ role: 'system', content: 'System Prompt' }),
    Message.fromJson({ role: 'user', content: 'Question 1', expert: { id: 'expert' } }),
    Message.fromJson({ role: 'assistant', content: 'Subtitle 1' })
  ]

  // set defaults
  await wrapper.findAll('section').at(0)!.find('.menu').trigger('click')
  await wrapper.find('.context-menu .actions .item[data-action=setDefaults]').trigger('click')
  expect(store.history.folders[0].defaults).toStrictEqual({
    engine: 'mock',
    model: 'chat',
    disableStreaming: false,
    tools: [],
    instructions: 'instructions',
    locale: 'locale',
    docrepo: 'docrepo',
    expert: 'expert',
    modelOpts: {
      temperature: 0.7,
      customOpts: {
        custom: 'custom'
      } 
    }
  })
  
  // clear defaults
  await wrapper.findAll('section').at(0)!.find('.menu').trigger('click')
  expect(wrapper.findAll('.context-menu .actions .item')).toHaveLength(5)
  expect(wrapper.findAll('.context-menu .actions .item').at(3)!.text()).toBe('chatList.folder.actions.clearDefaults')
  expect(wrapper.findAll('.context-menu .actions .item').at(4)!.text()).toBe('chatList.folder.actions.delete')
  await wrapper.find('.context-menu .actions .item[data-action=clearDefaults]').trigger('click')
  expect(store.history.folders[0].defaults).toBeUndefined()

})
