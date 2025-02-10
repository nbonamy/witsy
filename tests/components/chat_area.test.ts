
import { vi, beforeAll, beforeEach, afterAll, expect, test } from 'vitest'
import { mount, VueWrapper, enableAutoUnmount } from '@vue/test-utils'
import { useWindowMock, useNavigatorMock } from '../mocks/window'
import { store } from '../../src/services/store'
import ChatArea from '../../src/components/ChatArea.vue'
import Message from '../../src/models/message'
import Chat from '../../src/models/chat'

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
  useNavigatorMock()
  useWindowMock()
  store.load()
  store.config.engines.mock = {
    label: 'mock',
    models: { chat: [ { id: 'chat', name: 'chat'} ], image: [] },
    model: { chat: 'chat', image: '' }
  }
  store.config.engines.openai = {
    label: 'openai',
    models: { chat: [ { id: 'chat', name: 'chat'} ], image: [] },
    model: { chat: 'chat', image: '' }
  }
})

let chat: Chat|null = null
beforeEach(() => {
  chat = new Chat('New Chat')
  chat.setEngineModel('mock', 'chat')
})

const addMessagesToChat = () => {
  chat!.addMessage(new Message('system', 'Hello'))
  chat!.addMessage(new Message('user', 'Hi'))
}

test('Empty chat', async () => {
  const wrapper: VueWrapper<any> = mount(ChatArea, { props: { chat: new Chat() } } )
  expect(wrapper.exists()).toBe(true)
  expect(wrapper.find('.toolbar').exists()).toBe(true)
  expect(wrapper.find('.toolbar .title').exists()).toBe(false)
  expect(wrapper.find('.toolbar .menu').exists()).toBe(true)
  expect(wrapper.find('.model-settings').exists()).toBe(true)
  expect(wrapper.find('.model-settings').classes()).not.toContain('visible')
  expect(wrapper.find('.messages').exists()).toBe(false)
  expect(wrapper.find('.empty').exists()).toBe(true)
  expect(wrapper.find('.prompt').exists()).toBe(true)
})

test('With chat', async () => {
  addMessagesToChat()
  const wrapper: VueWrapper<any> = mount(ChatArea, { props: { chat: chat! } } )
  expect(wrapper.exists()).toBe(true)
  expect(wrapper.find('.toolbar').exists()).toBe(true)
  expect(wrapper.find('.toolbar .title').text()).toBe('New Chat')
  expect(wrapper.find('.toolbar .menu').exists()).toBe(true)
  expect(wrapper.find('.model-settings').exists()).toBe(true)
  expect(wrapper.find('.model-settings').classes()).not.toContain('visible')
  expect(wrapper.find('.messages').exists()).toBe(true)
  expect(wrapper.find('.empty').exists()).toBe(false)
  expect(wrapper.find('.prompt').exists()).toBe(true)

})

test('Context menu empty chat', async () => {
  addMessagesToChat()
  const wrapper: VueWrapper<any> = mount(ChatArea, { props: { chat: new Chat() } } )
  await wrapper.find('.toolbar .menu').trigger('click')
  expect(wrapper.vm.chatMenuActions).toStrictEqual([
    // { label: 'mock chat', disabled: true },
    // { label: 'Disable plugins', action: 'toogleTools', disabled: false },
    // { label: 'Model Settings', action: 'modelSettings', disabled: false },
    { label: 'Rename Chat', action: 'rename', disabled: false },
    { label: 'Export as PDF', action: 'exportPdf', disabled: true },
    { label: 'Delete', action: 'delete', disabled: true }
  ])
})

test('Context menu normal chat', async () => {
  addMessagesToChat()
  const wrapper: VueWrapper<any> = mount(ChatArea, { props: { chat: chat! } } )
  await wrapper.find('.toolbar .menu').trigger('click')
  expect(wrapper.vm.chatMenuActions).toStrictEqual([
    // { label: 'mock chat', disabled: true },
    // { label: 'Disable plugins', action: 'toogleTools', disabled: false },
    // { label: 'Model Settings', action: 'modelSettings', disabled: false },
    { label: 'Rename Chat', action: 'rename', disabled: false },
    { label: 'Export as PDF', action: 'exportPdf', disabled: false },
    { label: 'Delete', action: 'delete', disabled: true }
  ])
})

test('Context menu rename', async () => {
  addMessagesToChat()
  const wrapper: VueWrapper<any> = mount(ChatArea, { ...stubTeleport, props: { chat: chat! } } )
  await wrapper.find('.toolbar .menu').trigger('click')
  await wrapper.find('.context-menu .item[data-action=rename]').trigger('click')
  expect(emitEventMock).toHaveBeenCalledWith('rename-chat', chat)
})

// test('Context menu export', async () => {
//   addMessagesToChat()
//   const wrapper: VueWrapper<any> = mount(ChatArea, { ...stubTeleport, props: { chat: chat! } } )
//   await wrapper.find('.toolbar .menu').trigger('click')
//   await wrapper.find('.context-menu .item[data-action=exportPdf]').trigger('click')
//   await wrapper.findAll('.context-menu .item')[4].trigger('click')
//   expect(emitEventMock).toHaveBeenCalledWith('delete-chat', chat)
// })

test('Context menu delete', async () => {
  addMessagesToChat()
  store.history.chats.push(chat!)
  const wrapper: VueWrapper<any> = mount(ChatArea, { ...stubTeleport, props: { chat: chat! } } )
  await wrapper.find('.toolbar .menu').trigger('click')
  await wrapper.find('.context-menu .item[data-action=delete]').trigger('click')
  expect(emitEventMock).toHaveBeenCalledWith('delete-chat', chat!.uuid)
})

test('Model settings', async () => {

  chat?.setEngineModel('openai', 'chat')

  const wrapper: VueWrapper<any> = mount(ChatArea, { props: { chat: chat! } } )
  await wrapper.find('.toolbar .settings').trigger('click')
  expect(wrapper.find('.model-settings').classes()).toContain('visible')

  expect(wrapper.find<HTMLSelectElement>('.model-settings select[name=engine]').element.value).toBe('openai')
  expect(wrapper.find<HTMLSelectElement>('.model-settings select[name=model]').element.value).toBe('chat')
  expect(wrapper.find<HTMLSelectElement>('.model-settings select[name=plugins]').element.value).toBe('false')
  expect(wrapper.find<HTMLInputElement>('.model-settings input[name=contextWindowSize]').exists()).toBe(false)
  expect(wrapper.find<HTMLInputElement>('.model-settings input[name=maxTokens]').element.value).toBe('')
  expect(wrapper.find<HTMLInputElement>('.model-settings input[name=temperature]').element.value).toBe('')
  expect(wrapper.find<HTMLInputElement>('.model-settings input[name=top_k]').element.value).toBe('')
  expect(wrapper.find<HTMLInputElement>('.model-settings input[name=top_k]').element.value).toBe('')
  expect(wrapper.find<HTMLSelectElement>('.model-settings select[name=reasoningEffort]').element.value).toBe('Default')
  
  await wrapper.find('.model-settings input[name=maxTokens]').setValue('1000')
  await wrapper.find('.model-settings input[name=temperature]').setValue('0.7')
  await wrapper.find('.model-settings input[name=top_k]').setValue('15')
  await wrapper.find('.model-settings input[name=top_p]').setValue('0.8')
  await wrapper.find('.model-settings select[name=reasoningEffort]').setValue('high')

  expect(chat?.modelOpts?.maxTokens).toBe(1000)
  expect(chat?.modelOpts?.temperature).toBe(0.7)
  expect(chat?.modelOpts?.top_k).toBe(15)
  expect(chat?.modelOpts?.top_p).toBe(0.8)
  expect(chat?.modelOpts?.reasoningEffort).toBe('high')

  await wrapper.find('.model-settings input[name=temperature]').setValue('5.0')
  await wrapper.find('.model-settings input[name=top_k]').setValue('50')
  await wrapper.find('.model-settings input[name=top_p]').setValue('3.0')
  await wrapper.find('.model-settings select[name=reasoningEffort]').setValue('unknown')

  expect(chat?.modelOpts?.temperature).toBeUndefined()
  expect(chat?.modelOpts?.top_k).toBeUndefined()
  expect(chat?.modelOpts?.top_p).toBeUndefined()
  expect(chat?.modelOpts?.reasoningEffort).toBeUndefined()

  await wrapper.find('.model-settings input[name=temperature]').setValue('not a number')
  expect(chat?.modelOpts?.temperature).toBeUndefined()

  await wrapper.find('.toolbar .settings').trigger('click')
  expect(wrapper.find('.model-settings').classes()).not.toContain('visible')

})