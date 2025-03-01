
import { vi, beforeAll, beforeEach, afterAll, expect, test } from 'vitest'
import { mount, VueWrapper, enableAutoUnmount } from '@vue/test-utils'
import { useWindowMock, useBrowserMock } from '../mocks/window'
import { store } from '../../src/services/store'
import ChatArea from '../../src/components/ChatArea.vue'
import Message from '../../src/models/message'
import Chat from '../../src/models/chat'

enableAutoUnmount(afterAll)

const onEventMock = vi.fn()
const emitEventMock = vi.fn()

const stubTeleport = { global: { stubs: { teleport: true } } }

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
  useWindowMock({ modelDefaults: true })
  useBrowserMock()
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
    { label: 'chat.actions.makeTemporary', action: 'toggle_temp', disabled: false },
    { label: 'common.rename', action: 'rename', disabled: false },
    { label: 'chat.actions.exportPdf', action: 'exportPdf', disabled: true },
    { label: 'common.delete', action: 'delete', disabled: true }
  ])
})

test('Context menu normal chat', async () => {
  addMessagesToChat()
  const wrapper: VueWrapper<any> = mount(ChatArea, { props: { chat: chat! } } )
  await wrapper.find('.toolbar .menu').trigger('click')
  expect(wrapper.vm.chatMenuActions).toStrictEqual([
    { label: 'chat.actions.makeTemporary', action: 'toggle_temp', disabled: false },
    { label: 'common.rename', action: 'rename', disabled: false },
    { label: 'chat.actions.exportPdf', action: 'exportPdf', disabled: false },
    { label: 'common.delete', action: 'delete', disabled: true }
  ])
})

test('Context menu temporary chat', async () => {
  addMessagesToChat()
  chat!.temporary = true
  const wrapper: VueWrapper<any> = mount(ChatArea, { props: { chat: chat! } } )
  await wrapper.find('.toolbar .menu').trigger('click')
  expect(wrapper.vm.chatMenuActions).toStrictEqual([
    { label: 'chat.actions.saveChat', action: 'toggle_temp', disabled: false },
    { label: 'common.rename', action: 'rename', disabled: false },
    { label: 'chat.actions.exportPdf', action: 'exportPdf', disabled: false },
    { label: 'common.delete', action: 'delete', disabled: true }
  ])
})

test('Context menu temporary 1', async () => {
  expect(store.history.chats.length).toBe(0)
  const wrapper: VueWrapper<any> = mount(ChatArea, { ...stubTeleport, props: { chat: chat! } } )
  await wrapper.find('.toolbar .menu').trigger('click')
  await wrapper.find('.context-menu .item[data-action=toggle_temp]').trigger('click')
  expect(chat?.temporary).toBe(true)
  expect(store.history.chats.length).toBe(0)
})

test('Context menu temporary 2', async () => {
  addMessagesToChat()
  expect(store.history.chats.length).toBe(0)
  const wrapper: VueWrapper<any> = mount(ChatArea, { ...stubTeleport, props: { chat: chat! } } )
  await wrapper.find('.toolbar .menu').trigger('click')
  await wrapper.find('.context-menu .item[data-action=toggle_temp]').trigger('click')
  expect(chat?.temporary).toBe(true)
  expect(store.history.chats.length).toBe(0)
})

test('Context menu temporary 3', async () => {
  addMessagesToChat()
  chat!.temporary = true
  expect(store.history.chats.length).toBe(0)
  const wrapper: VueWrapper<any> = mount(ChatArea, { ...stubTeleport, props: { chat: chat! } } )
  await wrapper.find('.toolbar .menu').trigger('click')
  await wrapper.find('.context-menu .item[data-action=toggle_temp]').trigger('click')
  expect(chat?.temporary).toBe(false)
  expect(store.history.chats.length).toBe(1)
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
  store.addChat(chat!)
  const wrapper: VueWrapper<any> = mount(ChatArea, { ...stubTeleport, props: { chat: chat! } } )
  await wrapper.find('.toolbar .menu').trigger('click')
  await wrapper.find('.context-menu .item[data-action=delete]').trigger('click')
  expect(emitEventMock).toHaveBeenCalledWith('delete-chat', chat!.uuid)
})

test('Model settings visibility', async () => {

  const wrapper: VueWrapper<any> = mount(ChatArea, { props: { chat: chat! } } )
  await wrapper.find('.toolbar .settings').trigger('click')
  expect(wrapper.find('.model-settings').classes()).toContain('visible')

  await wrapper.find('.toolbar .settings').trigger('click')
  expect(wrapper.find('.model-settings').classes()).not.toContain('visible')

})

test('Model settings init chat', async () => {

  const wrapper: VueWrapper<any> = mount(ChatArea, { props: { chat: chat! } } )
  await wrapper.find('.toolbar .settings').trigger('click')

  // load engine/model with defaults
  await wrapper.find('.model-settings select[name=engine]').setValue('mock')
  await wrapper.find('.model-settings select[name=model]').setValue('chat')
  expect(wrapper.find<HTMLSelectElement>('.model-settings select[name=plugins]').element.value).toBe('true')
  expect(wrapper.find<HTMLSelectElement>('.model-settings select[name=reasoning]').element.value).toBe('true')
  expect(chat?.disableTools).toBe(true)
  expect(chat?.modelOpts?.contextWindowSize).toBe(512)
  expect(chat?.modelOpts?.maxTokens).toBe(150)
  expect(chat?.modelOpts?.temperature).toBe(0.7)
  expect(chat?.modelOpts?.top_k).toBe(10)
  expect(chat?.modelOpts?.top_p).toBe(0.5)
  expect(chat?.modelOpts?.reasoning).toBe(true)
  expect(chat?.modelOpts?.reasoningEffort).toBe('low')

  // load engine/model without defaults
  await wrapper.find('.model-settings select[name=engine]').setValue('openai')
  await wrapper.find('.model-settings select[name=model]').setValue('chat')
  expect(chat?.disableTools).toBe(false)
  expect(chat?.modelOpts).toBeUndefined()

})

test('Model settings update chat', async () => {

  chat?.setEngineModel('openai', 'chat')

  const wrapper: VueWrapper<any> = mount(ChatArea, { props: { chat: chat! } } )
  await wrapper.find('.toolbar .settings').trigger('click')

  expect(wrapper.find<HTMLSelectElement>('.model-settings select[name=engine]').element.value).toBe('openai')
  expect(wrapper.find<HTMLSelectElement>('.model-settings select[name=model]').element.value).toBe('chat')
  expect(wrapper.find<HTMLSelectElement>('.model-settings select[name=plugins]').element.value).toBe('false')
  expect(wrapper.find<HTMLInputElement>('.model-settings input[name=contextWindowSize]').exists()).toBe(false)
  expect(wrapper.find<HTMLInputElement>('.model-settings input[name=maxTokens]').element.value).toBe('')
  expect(wrapper.find<HTMLInputElement>('.model-settings input[name=temperature]').element.value).toBe('')
  expect(wrapper.find<HTMLInputElement>('.model-settings input[name=top_k]').element.value).toBe('')
  expect(wrapper.find<HTMLInputElement>('.model-settings input[name=top_k]').element.value).toBe('')
  expect(wrapper.find<HTMLSelectElement>('.model-settings select[name=reasoningEffort]').element.value).toBe('common.default')
  
  await wrapper.find('.model-settings input[name=maxTokens]').setValue('1000')
  await wrapper.find('.model-settings input[name=temperature]').setValue('0.7')
  await wrapper.find('.model-settings input[name=top_k]').setValue('15')
  await wrapper.find('.model-settings input[name=top_p]').setValue('0.8')
  await wrapper.find('.model-settings select[name=reasoningEffort]').setValue('high')

  expect(chat?.modelOpts?.maxTokens).toBe(1000)
  expect(chat?.modelOpts?.contextWindowSize).toBeUndefined()
  expect(chat?.modelOpts?.temperature).toBe(0.7)
  expect(chat?.modelOpts?.top_k).toBe(15)
  expect(chat?.modelOpts?.top_p).toBe(0.8)
  expect(chat?.modelOpts?.reasoningEffort).toBe('high')

  await wrapper.find('.model-settings input[name=temperature]').setValue('5.0')
  await wrapper.find('.model-settings input[name=top_k]').setValue('50')
  await wrapper.find('.model-settings input[name=top_p]').setValue('3.0')
  await wrapper.find('.model-settings select[name=reasoningEffort]').setValue('unknown')

  expect(chat?.modelOpts?.maxTokens).toBe(1000)
  expect(chat?.modelOpts?.contextWindowSize).toBeUndefined()
  expect(chat?.modelOpts?.temperature).toBeUndefined()
  expect(chat?.modelOpts?.top_k).toBeUndefined()
  expect(chat?.modelOpts?.top_p).toBeUndefined()
  expect(chat?.modelOpts?.reasoningEffort).toBeUndefined()

  await wrapper.find('.model-settings input[name=temperature]').setValue('not a number')
  expect(chat?.modelOpts?.temperature).toBeUndefined()

})

test('Model settings defaults', async () => {

  chat?.setEngineModel('openai', 'chat')

  const wrapper: VueWrapper<any> = mount(ChatArea, { props: { chat: chat! } } )
  await wrapper.find('.toolbar .settings').trigger('click')

  // initial state: all disabled
  expect(wrapper.find<HTMLButtonElement>('.model-settings button[name=load]').element.disabled).toBe(true)
  expect(wrapper.find<HTMLButtonElement>('.model-settings button[name=save]').element.disabled).toBe(true)
  expect(wrapper.find<HTMLButtonElement>('.model-settings button[name=clear]').element.disabled).toBe(true)

  // should enable save
  await wrapper.find('.model-settings input[name=temperature]').setValue('0.7')
  expect(wrapper.find<HTMLButtonElement>('.model-settings button[name=load]').element.disabled).toBe(true)
  expect(wrapper.find<HTMLButtonElement>('.model-settings button[name=save]').element.disabled).toBe(false)
  expect(wrapper.find<HTMLButtonElement>('.model-settings button[name=clear]').element.disabled).toBe(true)

  // click save
  await wrapper.find('.model-settings button[name=save]').trigger('click')
  expect(wrapper.find<HTMLButtonElement>('.model-settings button[name=load]').element.disabled).toBe(false)
  expect(wrapper.find<HTMLButtonElement>('.model-settings button[name=save]').element.disabled).toBe(false)
  expect(wrapper.find<HTMLButtonElement>('.model-settings button[name=clear]').element.disabled).toBe(false)
  expect(store.config.llm.defaults[1]).toStrictEqual({
    engine: 'openai',
    model: 'chat',
    disableTools: false,
    temperature: 0.7
  })

  // add one element
  await wrapper.find('.model-settings input[name=top_k]').setValue('15')
  await wrapper.find('.model-settings button[name=save]').trigger('click')
  expect(store.config.llm.defaults[1]).toStrictEqual({
    engine: 'openai',
    model: 'chat',
    disableTools: false,
    temperature: 0.7,
    top_k: 15
  })

  // update and load
  await wrapper.find('.model-settings input[name=top_p]').setValue('3.0')
  await wrapper.find('.model-settings button[name=load]').trigger('click')
  expect(wrapper.find<HTMLInputElement>('.model-settings input[name=top_p]').element.value).toBe('')
  expect(store.config.llm.defaults[1]).toStrictEqual({
    engine: 'openai',
    model: 'chat',
    disableTools: false,
    temperature: 0.7,
    top_k: 15
  })

  // clear
  await wrapper.find('.model-settings button[name=clear]').trigger('click')
  expect(store.config.llm.defaults).toHaveLength(1)
  expect(wrapper.find<HTMLInputElement>('.model-settings input[name=maxTokens]').element.value).toBe('')
  expect(wrapper.find<HTMLInputElement>('.model-settings input[name=temperature]').element.value).toBe('')
  expect(wrapper.find<HTMLInputElement>('.model-settings input[name=top_k]').element.value).toBe('')
  expect(wrapper.find<HTMLInputElement>('.model-settings input[name=top_k]').element.value).toBe('')
  expect(wrapper.find<HTMLSelectElement>('.model-settings select[name=reasoningEffort]').element.value).toBe('common.default')



})
