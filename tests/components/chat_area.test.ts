
import { vi, beforeAll, beforeEach, afterAll, expect, test } from 'vitest'
import { mount, VueWrapper, enableAutoUnmount } from '@vue/test-utils'
import { useWindowMock, useBrowserMock } from '../mocks/window'
import { createDialogMock, createEventBusMock, createI18nMock, emitEventMock } from '../mocks'
import { stubTeleport } from '../mocks/stubs'
import { findModelSelectoPlus } from '../utils'
import { store } from '../../src/services/store'
import ChatArea from '../../src/components/ChatArea.vue'
import Message from '../../src/models/message'
import Chat from '../../src/models/chat'
import { defaultCapabilities } from 'multi-llm-ts'

enableAutoUnmount(afterAll)

vi.mock('../../src/composables/dialog', async () => {
  return createDialogMock()
})

vi.mock('../../src/services/i18n', async () => {
  return createI18nMock()
})

vi.mock('../../src/composables/event_bus', async () => {
  return createEventBusMock()
})

beforeAll(() => {
  useWindowMock({ modelDefaults: true })
  useBrowserMock()
  store.load()
  store.config.engines.mock = {
    label: 'mock',
    models: { chat: [ { id: 'chat', name: 'chat', capabilities: defaultCapabilities.capabilities } ], image: [] },
    model: { chat: 'chat', image: '' }
  }
  store.config.engines.openai = {
    label: 'openai',
    models: { chat: [ { id: 'chat', name: 'chat', capabilities: defaultCapabilities.capabilities } ], image: [] },
    model: { chat: 'chat', image: '' }
  }

  // @ts-expect-error mock
  Element.prototype.showModal = vi.fn()

})

let chat: Chat|null = null
beforeEach(() => {
  chat = new Chat('New Chat')
  chat.setEngineModel('mock', 'chat')
  store.isFeatureEnabled = () => true
})

const addMessagesToChat = () => {
  chat!.addMessage(new Message('system', 'Hello'))
  chat!.addMessage(new Message('user', 'Hi'))
}

test('Empty chat', async () => {
  store.isFeatureEnabled = (feature: string) => feature != 'chat.temporary'
  const wrapper: VueWrapper<any> = mount(ChatArea, { props: { chat: new Chat() } } )
  expect(wrapper.exists()).toBe(true)
  expect(wrapper.find('.sp-main > header').exists()).toBe(true)
  expect(wrapper.find('.sp-main > header .title').text()).toBe('')
  expect(wrapper.find('.sp-main > header .icon.menu').exists()).toBe(false)
  expect(wrapper.find('.sp-main .model-settings').exists()).toBe(true)
  expect(wrapper.find('.sp-main .model-settings').classes()).not.toContain('visible')
  expect(wrapper.find('.sp-main .messages').exists()).toBe(false)
  expect(wrapper.find('.sp-main .empty').exists()).toBe(true)
  expect(wrapper.find('.sp-main .prompt').exists()).toBe(true)
})

test('With chat', async () => {
  addMessagesToChat()
  const wrapper: VueWrapper<any> = mount(ChatArea, { props: { chat: chat! } } )
  expect(wrapper.exists()).toBe(true)
  expect(wrapper.find('.sp-main > header').exists()).toBe(true)
  expect(wrapper.find('.sp-main > header .title').text()).toBe('New Chat')
  expect(wrapper.find('.sp-main > header .icon.menu').exists()).toBe(true)
  expect(wrapper.find('.model-settings').exists()).toBe(true)
  expect(wrapper.find('.sp-main .model-settings').classes()).not.toContain('visible')
  expect(wrapper.find('.sp-main .messages').exists()).toBe(true)
  expect(wrapper.find('.sp-main .empty').exists()).toBe(false)
  expect(wrapper.find('.sp-main .prompt').exists()).toBe(true)

})

test('Context menu empty chat', async () => {
  addMessagesToChat()
  const wrapper: VueWrapper<any> = mount(ChatArea, { props: { chat: new Chat('title') } } )
  await wrapper.find('.sp-main > header .icon.menu').trigger('click')
  expect(wrapper.vm.chatMenuActions).toStrictEqual([
    { label: 'chat.actions.makeTemporary', action: 'toggle_temp', disabled: false },
    { label: 'common.rename', action: 'rename', disabled: false },
    { label: 'chat.actions.exportMarkdown', action: 'exportMarkdown', disabled: true },
    { label: 'chat.actions.exportPdf', action: 'exportPdf', disabled: true },
    { label: 'common.delete', action: 'delete', disabled: true }
  ])
})

test('Context menu normal chat', async () => {
  addMessagesToChat()
  const wrapper: VueWrapper<any> = mount(ChatArea, { props: { chat: chat! } } )
  await wrapper.find('.sp-main > header .icon.menu').trigger('click')
  expect(wrapper.vm.chatMenuActions).toStrictEqual([
    { label: 'chat.actions.makeTemporary', action: 'toggle_temp', disabled: false },
    { label: 'common.rename', action: 'rename', disabled: false },
    { label: 'chat.actions.exportMarkdown', action: 'exportMarkdown', disabled: false },
    { label: 'chat.actions.exportPdf', action: 'exportPdf', disabled: false },
    { label: 'common.delete', action: 'delete', disabled: true }
  ])
})

test('Context menu temporary chat', async () => {
  addMessagesToChat()
  chat!.temporary = true
  const wrapper: VueWrapper<any> = mount(ChatArea, { props: { chat: chat! } } )
  await wrapper.find('.sp-main > header .icon.menu').trigger('click')
  expect(wrapper.vm.chatMenuActions).toStrictEqual([
    { label: 'chat.actions.saveChat', action: 'toggle_temp', disabled: false },
    { label: 'common.rename', action: 'rename', disabled: false },
    { label: 'chat.actions.exportMarkdown', action: 'exportMarkdown', disabled: false },
    { label: 'chat.actions.exportPdf', action: 'exportPdf', disabled: false },
    { label: 'common.delete', action: 'delete', disabled: true }
  ])
})

test('Context menu temporary 1', async () => {
  expect(store.history.chats.length).toBe(0)
  const wrapper: VueWrapper<any> = mount(ChatArea, { ...stubTeleport, props: { chat: chat! } } )
  await wrapper.find('.sp-main > header .icon.menu').trigger('click')
  await wrapper.find('.context-menu .item[data-action=toggle_temp]').trigger('click')
  expect(chat?.temporary).toBe(true)
  expect(store.history.chats.length).toBe(0)
})

test('Context menu temporary 2', async () => {
  addMessagesToChat()
  expect(store.history.chats.length).toBe(0)
  const wrapper: VueWrapper<any> = mount(ChatArea, { ...stubTeleport, props: { chat: chat! } } )
  await wrapper.find('.sp-main > header .icon.menu').trigger('click')
  await wrapper.find('.context-menu .item[data-action=toggle_temp]').trigger('click')
  expect(chat?.temporary).toBe(true)
  expect(store.history.chats.length).toBe(0)
})

test('Context menu temporary 3', async () => {
  addMessagesToChat()
  chat!.temporary = true
  expect(store.history.chats.length).toBe(0)
  const wrapper: VueWrapper<any> = mount(ChatArea, { ...stubTeleport, props: { chat: chat! } } )
  await wrapper.find('.sp-main > header .icon.menu').trigger('click')
  await wrapper.find('.context-menu .item[data-action=toggle_temp]').trigger('click')
  expect(chat?.temporary).toBe(false)
  expect(store.history.chats.length).toBe(1)
})

test('Context menu rename', async () => {
  addMessagesToChat()
  const wrapper: VueWrapper<any> = mount(ChatArea, { ...stubTeleport, props: { chat: chat! } } )
  await wrapper.find('.sp-main > header .icon.menu').trigger('click')
  await wrapper.find('.context-menu .item[data-action=rename]').trigger('click')
  expect(emitEventMock).toHaveBeenLastCalledWith('rename-chat', chat)
})

test('Context menu export Markdown', async () => {
  addMessagesToChat()
  const wrapper: VueWrapper<any> = mount(ChatArea, { ...stubTeleport, props: { chat: chat! } } )
  await wrapper.find('.sp-main > header .icon.menu').trigger('click')
  await wrapper.find('.context-menu .item[data-action=exportMarkdown]').trigger('click')
  expect(window.api.file.save).toHaveBeenCalledWith({
    contents: '# New Chat\n\n## chat.role.system\n\nHello\n\n## chat.role.user\n\nHi\n\n_encoded',
    url: 'New Chat.md',
    properties: {
      directory: 'documents',
      prompt: true
    }
  })
})

// test('Context menu export PDF', async () => {
//   addMessagesToChat()
//   const wrapper: VueWrapper<any> = mount(ChatArea, { ...stubTeleport, props: { chat: chat! } } )
//   await wrapper.find('.sp-main > header .icon.menu').trigger('click')
//   await wrapper.find('.context-menu .item[data-action=exportPdf]').trigger('click')
// })

test('Context menu delete', async () => {
  addMessagesToChat()
  store.addChat(chat!)
  const wrapper: VueWrapper<any> = mount(ChatArea, { ...stubTeleport, props: { chat: chat! } } )
  await wrapper.find('.sp-main > header .icon.menu').trigger('click')
  await wrapper.find('.context-menu .item[data-action=delete]').trigger('click')
  expect(emitEventMock).toHaveBeenLastCalledWith('delete-chat', chat!.uuid)
})

test('Model settings visibility', async () => {

  const wrapper: VueWrapper<any> = mount(ChatArea, { props: { chat: chat! } } )
  await wrapper.find('.sp-main > header .settings').trigger('click')
  expect(wrapper.find('.model-settings').classes()).toContain('visible')

  await wrapper.find('header .settings').trigger('click')
  expect(wrapper.find('.model-settings').classes()).not.toContain('visible')

})

test('Model settings init chat', async () => {

  const wrapper: VueWrapper<any> = mount(ChatArea, { props: { chat: chat! } } )
  await wrapper.find('.sp-main > header .settings').trigger('click')

  // load engine/model with defaults
  await wrapper.find('.model-settings select[name=engine]').setValue('mock')
  const modelSelect = findModelSelectoPlus(wrapper)
  await modelSelect.open()
  await modelSelect.select(0)
  expect(wrapper.find<HTMLSelectElement>('.model-settings select[name=plugins]').element.value).toBe('true')
  expect(wrapper.find<HTMLSelectElement>('.model-settings select[name=reasoning]').element.value).toBe('true')
  expect(chat?.tools).toStrictEqual([])
  expect(chat?.modelOpts?.contextWindowSize).toBe(512)
  expect(chat?.modelOpts?.maxTokens).toBe(150)
  expect(chat?.modelOpts?.temperature).toBe(0.7)
  expect(chat?.modelOpts?.top_k).toBe(10)
  expect(chat?.modelOpts?.top_p).toBe(0.5)
  expect(chat?.modelOpts?.reasoning).toBe(true)

  // load engine/model without defaults
  await wrapper.find('.model-settings select[name=engine]').setValue('openai')
  await modelSelect.open()
  await modelSelect.select(0)
  expect(chat?.tools).toStrictEqual(null)
  expect(chat?.modelOpts).toBeUndefined()

})

test('Model settings update chat', async () => {

  chat?.setEngineModel('mock', 'chat')

  const wrapper: VueWrapper<any> = mount(ChatArea, { ...stubTeleport, props: { chat: chat! } } )
  await wrapper.find('.sp-main > header .settings').trigger('click')

  expect(wrapper.find<HTMLSelectElement>('.model-settings select[name=engine]').exists()).toBe(true)
  expect(findModelSelectoPlus(wrapper).exists()).toBe(true)
  expect(wrapper.find<HTMLSelectElement>('.model-settings select[name=plugins]').exists()).toBe(true)
  expect(wrapper.find<HTMLSelectElement>('.model-settings select[name=locale]').exists()).toBe(true)
  expect(wrapper.find<HTMLTextAreaElement>('.model-settings textarea[name=instructions]').exists()).toBe(true)
  expect(wrapper.find<HTMLSelectElement>('.model-settings select[name=streaming]').exists()).toBe(false)
  expect(wrapper.find<HTMLInputElement>('.model-settings input[name=contextWindowSize]').exists()).toBe(false)
  expect(wrapper.find<HTMLInputElement>('.model-settings input[name=maxTokens]').exists()).toBe(false)
  expect(wrapper.find<HTMLInputElement>('.model-settings input[name=temperature]').exists()).toBe(false)
  expect(wrapper.find<HTMLInputElement>('.model-settings input[name=top_k]').exists()).toBe(false)
  expect(wrapper.find<HTMLInputElement>('.model-settings input[name=top_k]').exists()).toBe(false)
  expect(wrapper.find<HTMLElement>('.model-settings .form-field.custom').exists()).toBe(false)

  await wrapper.find('.model-settings .toggle').trigger('click')

  expect(wrapper.find<HTMLSelectElement>('.model-settings select[name=engine]').element.value).toBe('mock')
  expect(findModelSelectoPlus(wrapper).value).toBe('chat')
  expect(wrapper.find<HTMLSelectElement>('.model-settings select[name=plugins]').element.value).toBe('false')
  expect(wrapper.find<HTMLSelectElement>('.model-settings select[name=locale]').element.value).toBe('')
  expect(wrapper.find<HTMLTextAreaElement>('.model-settings textarea[name=instructions]').element.value).toBe('')
  expect(wrapper.find<HTMLSelectElement>('.model-settings select[name=streaming]').element.value).toBe('false')
  expect(wrapper.find<HTMLInputElement>('.model-settings input[name=contextWindowSize]').exists()).toBe(false)
  expect(wrapper.find<HTMLInputElement>('.model-settings input[name=maxTokens]').element.value).toBe('')
  expect(wrapper.find<HTMLInputElement>('.model-settings input[name=temperature]').element.value).toBe('')
  expect(wrapper.find<HTMLInputElement>('.model-settings input[name=top_k]').element.value).toBe('')
  expect(wrapper.find<HTMLInputElement>('.model-settings input[name=top_k]').element.value).toBe('')
  expect(wrapper.find<HTMLElement>('.model-settings .form-field.custom').exists()).toBe(true)
  
  await wrapper.find('.model-settings select[name=locale]').setValue('fr-FR')
  await wrapper.find('.model-settings input[name=maxTokens]').setValue('1000')
  await wrapper.find('.model-settings input[name=temperature]').setValue('0.7')
  await wrapper.find('.model-settings input[name=top_k]').setValue('15')
  await wrapper.find('.model-settings input[name=top_p]').setValue('0.8')
  await wrapper.find('.model-settings select[name=streaming]').setValue(true)

  const table = wrapper.findComponent({ name: 'VariableTable' })
  await table.find<HTMLButtonElement>('.button.add').trigger('click')

  const editor = wrapper.findComponent({ name: 'VariableEditor' })
  await editor.find<HTMLSelectElement>('[name=key]').setValue('string')
  await editor.find<HTMLSelectElement>('[name=value]').setValue('value')
  await editor.find<HTMLButtonElement>('[name=save]').trigger('click')

  await editor.find<HTMLSelectElement>('[name=key]').setValue('number')
  await editor.find<HTMLSelectElement>('[name=value]').setValue('100')
  await editor.find<HTMLButtonElement>('[name=save]').trigger('click')

  await editor.find<HTMLSelectElement>('[name=key]').setValue('boolean')
  await editor.find<HTMLSelectElement>('[name=value]').setValue('true')
  await editor.find<HTMLButtonElement>('[name=save]').trigger('click')

  expect(chat?.locale).toBe('fr-FR')
  expect(chat?.instructions).toBeUndefined()
  expect(chat?.disableStreaming).toBe(true)
  expect(chat?.modelOpts?.maxTokens).toBe(1000)
  expect(chat?.modelOpts?.contextWindowSize).toBeUndefined()
  expect(chat?.modelOpts?.temperature).toBe(0.7)
  expect(chat?.modelOpts?.top_k).toBe(15)
  expect(chat?.modelOpts?.top_p).toBe(0.8)
  expect(chat?.modelOpts?.customOpts).toStrictEqual({
    string: 'value',
    number: 100,
    boolean: true,
  })

  await wrapper.find('.model-settings select[name=locale]').setValue('')
  await wrapper.find('.model-settings textarea[name=instructions]').setValue('Instructions')
  await wrapper.find('.model-settings input[name=temperature]').setValue('5.0')
  await wrapper.find('.model-settings input[name=top_k]').setValue('150')
  await wrapper.find('.model-settings input[name=top_p]').setValue('3.0')
  await wrapper.find('.model-settings select[name=streaming]').setValue(false)

  await table.find<HTMLTableRowElement>('tbody tr:nth-child(2)').trigger('click')
  await table.find<HTMLButtonElement>('.button.remove').trigger('click')

  expect(chat?.locale).toBeUndefined()
  expect(chat?.instructions).toBe('Instructions')
  expect(chat?.disableStreaming).toBe(false)
  expect(chat?.modelOpts?.maxTokens).toBe(1000)
  expect(chat?.modelOpts?.contextWindowSize).toBeUndefined()
  expect(chat?.modelOpts?.temperature).toBeUndefined()
  expect(chat?.modelOpts?.top_k).toBeUndefined()
  expect(chat?.modelOpts?.top_p).toBeUndefined()
  expect(chat?.modelOpts?.customOpts).toStrictEqual({
    string: 'value',
    boolean: true,
  })

  await wrapper.find('.model-settings input[name=temperature]').setValue('not a number')
  expect(chat?.modelOpts?.temperature).toBeUndefined()

})

test('Model settings defaults', async () => {

  chat?.setEngineModel('mock', 'chat')

  const wrapper: VueWrapper<any> = mount(ChatArea, { props: { chat: chat! } } )
  await wrapper.find('.sp-main > header .settings').trigger('click')
  await wrapper.find('.model-settings .toggle').trigger('click')

  // initial state
  expect(wrapper.find<HTMLButtonElement>('.model-settings button[name=load]').element.disabled).toBe(false)
  expect(wrapper.find<HTMLButtonElement>('.model-settings button[name=save]').element.disabled).toBe(true)
  expect(wrapper.find<HTMLButtonElement>('.model-settings button[name=clear]').element.disabled).toBe(false)

  // should enable save
  await wrapper.find('.model-settings input[name=temperature]').setValue('0.7')
  expect(wrapper.find<HTMLButtonElement>('.model-settings button[name=load]').element.disabled).toBe(false)
  expect(wrapper.find<HTMLButtonElement>('.model-settings button[name=save]').element.disabled).toBe(false)
  expect(wrapper.find<HTMLButtonElement>('.model-settings button[name=clear]').element.disabled).toBe(false)

  // click save
  await wrapper.find('.model-settings button[name=save]').trigger('click')
  expect(wrapper.find<HTMLButtonElement>('.model-settings button[name=load]').element.disabled).toBe(false)
  expect(wrapper.find<HTMLButtonElement>('.model-settings button[name=save]').element.disabled).toBe(false)
  expect(wrapper.find<HTMLButtonElement>('.model-settings button[name=clear]').element.disabled).toBe(false)
  expect(store.config.llm.defaults[0]).toStrictEqual({
    engine: 'mock',
    model: 'chat',
    disableStreaming: false,
    tools: null,
    temperature: 0.7
  })

  // add stuff
  await wrapper.find('.model-settings input[name=top_k]').setValue('15')
  await wrapper.find('.model-settings select[name=plugins]').setValue(true)
  await wrapper.find('.model-settings select[name=locale]').setValue('fr-FR')
  await wrapper.find('.model-settings select[name=streaming]').setValue(true)
  await wrapper.find('.model-settings button[name=save]').trigger('click')
  expect(store.config.llm.defaults[0]).toStrictEqual({
    engine: 'mock',
    model: 'chat',
    locale: 'fr-FR',
    disableStreaming: true,
    tools: [],
    temperature: 0.7,
    top_k: 15
  })

  // update and load
  await wrapper.find('.model-settings input[name=top_p]').setValue('3.0')
  await wrapper.find('.model-settings select[name=plugins]').setValue(false)
  await wrapper.find('.model-settings button[name=load]').trigger('click')
  expect(wrapper.find<HTMLInputElement>('.model-settings input[name=top_p]').element.value).toBe('')
  expect(store.config.llm.defaults[0]).toStrictEqual({
    engine: 'mock',
    model: 'chat',
    locale: 'fr-FR',
    disableStreaming: true,
    tools: [],
    temperature: 0.7,
    top_k: 15
  })

  // clear
  await wrapper.find('.model-settings button[name=clear]').trigger('click')
  expect(store.config.llm.defaults).toHaveLength(0)
  expect(wrapper.find<HTMLSelectElement>('.model-settings select[name=streaming]').element.value).toBe('false')
  expect(wrapper.find<HTMLInputElement>('.model-settings input[name=maxTokens]').element.value).toBe('')
  expect(wrapper.find<HTMLInputElement>('.model-settings input[name=temperature]').element.value).toBe('')
  expect(wrapper.find<HTMLInputElement>('.model-settings input[name=top_k]').element.value).toBe('')
  expect(wrapper.find<HTMLInputElement>('.model-settings input[name=top_k]').element.value).toBe('')

})
