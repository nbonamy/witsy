
import { vi, beforeAll, beforeEach, afterAll, expect, test } from 'vitest'
import { mount, VueWrapper, enableAutoUnmount } from '@vue/test-utils'
import { useWindowMock, useBrowserMock } from '@tests/mocks/window'
import { createI18nMock } from '@tests/mocks'
import { chatCallbacksMock, withChatCallbacks } from '@root/vitest.setup'
import { stubTeleport } from '@tests/mocks/stubs'
import { store } from '@services/store'
import ChatArea from '@components/ChatArea.vue'
import Message from '@models/message'
import Chat from '@models/chat'
import { defaultCapabilities } from 'multi-llm-ts'
import Dialog from '@renderer/utils/dialog'

enableAutoUnmount(afterAll)

vi.mock('@services/i18n', async () => {
  return createI18nMock()
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
  expect(wrapper.find('.sp-main > header .menu').exists()).toBe(false)
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
  expect(wrapper.find('.sp-main > header .created-at').exists()).toBe(true)
  expect(wrapper.find('.sp-main > header .menu').exists()).toBe(true)
  expect(wrapper.find('.model-settings').exists()).toBe(true)
  expect(wrapper.find('.sp-main .model-settings').classes()).not.toContain('visible')
  expect(wrapper.find('.sp-main .messages').exists()).toBe(true)
  expect(wrapper.find('.sp-main .empty').exists()).toBe(false)
  expect(wrapper.find('.sp-main .prompt').exists()).toBe(true)

})

test('Context menu empty chat', async () => {
  const wrapper: VueWrapper<any> = mount(ChatArea, { ...stubTeleport, props: { chat: new Chat('title') } } )
  await wrapper.find('.sp-main > header .menu .trigger').trigger('click')
  expect(wrapper.find('.context-menu .item').exists()).toBe(true)
  const items = wrapper.findAll('.context-menu .item')
  expect(items.length).toBe(6)
  expect(items[2].classes()).toContain('disabled') // exportMarkdown
  expect(items[3].classes()).toContain('disabled') // exportPdf
  expect(items[4].classes()).toContain('disabled') // usage
  expect(items[5].classes()).toContain('disabled') // delete
})

test('Context menu normal chat', async () => {
  addMessagesToChat()
  const wrapper: VueWrapper<any> = mount(ChatArea, { ...stubTeleport, props: { chat: chat! } } )
  await wrapper.find('.sp-main > header .menu .trigger').trigger('click')
  expect(wrapper.find('.context-menu .item').exists()).toBe(true)
  const items = wrapper.findAll('.context-menu .item')
  expect(items.length).toBe(6)
  expect(items[2].classes()).not.toContain('disabled') // exportMarkdown
  expect(items[3].classes()).not.toContain('disabled') // exportPdf
  expect(items[4].classes()).toContain('disabled') // usage (no usage data)
  expect(items[5].classes()).toContain('disabled') // delete (not saved yet)
})

test('Context menu temporary chat', async () => {
  addMessagesToChat()
  chat!.temporary = true
  const wrapper: VueWrapper<any> = mount(ChatArea, { ...stubTeleport, props: { chat: chat! } } )
  await wrapper.find('.sp-main > header .menu .trigger').trigger('click')
  expect(wrapper.find('.context-menu .item').exists()).toBe(true)
  const items = wrapper.findAll('.context-menu .item')
  expect(items.length).toBe(6)
  expect(items[0].text()).toContain('saveChat') // toggle_temp shows "save"
})

test('Context menu temporary 1', async () => {
  expect(store.history.chats.length).toBe(0)
  const wrapper: VueWrapper<any> = mount(ChatArea, { ...stubTeleport, props: { chat: chat! } } )
  await wrapper.find('.sp-main > header .menu .trigger').trigger('click')
  const items = wrapper.findAll('.context-menu .item')
  await items[0].trigger('click') // toggle_temp
  expect(chat?.temporary).toBe(true)
  expect(store.history.chats.length).toBe(0)
})

test('Context menu temporary 2', async () => {
  addMessagesToChat()
  expect(store.history.chats.length).toBe(0)
  const wrapper: VueWrapper<any> = mount(ChatArea, { ...stubTeleport, props: { chat: chat! } } )
  await wrapper.find('.sp-main > header .menu .trigger').trigger('click')
  const items = wrapper.findAll('.context-menu .item')
  await items[0].trigger('click') // toggle_temp
  expect(chat?.temporary).toBe(true)
  expect(store.history.chats.length).toBe(0)
})

test('Context menu temporary 3', async () => {
  addMessagesToChat()
  chat!.temporary = true
  expect(store.history.chats.length).toBe(0)
  const wrapper: VueWrapper<any> = mount(ChatArea, { ...stubTeleport, props: { chat: chat! } } )
  await wrapper.find('.sp-main > header .menu .trigger').trigger('click')
  const items = wrapper.findAll('.context-menu .item')
  await items[0].trigger('click') // toggle_temp (save)
  expect(chat?.temporary).toBe(false)
  expect(store.history.chats.length).toBe(1)
})

test('Context menu rename', async () => {
  addMessagesToChat()
  const wrapper: VueWrapper<any> = mount(ChatArea, withChatCallbacks({ ...stubTeleport, props: { chat: chat! } }))
  await wrapper.find('.sp-main > header .menu .trigger').trigger('click')
  const items = wrapper.findAll('.context-menu .item')
  await items[1].trigger('click') // rename
  expect(chatCallbacksMock.onRenameChat).toHaveBeenLastCalledWith(chat)
})

test('Context menu export Markdown', async () => {
  addMessagesToChat()
  const wrapper: VueWrapper<any> = mount(ChatArea, { ...stubTeleport, props: { chat: chat! } } )
  await wrapper.find('.sp-main > header .menu .trigger').trigger('click')
  const items = wrapper.findAll('.context-menu .item')
  await items[2].trigger('click') // exportMarkdown
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
//   await wrapper.find('.sp-main > header .menu .trigger').trigger('click')
//   const items = wrapper.findAll('.context-menu .item')
//   await items[3].trigger('click') // exportPdf
// })

test('Context menu delete', async () => {
  addMessagesToChat()
  store.addChat(chat!)
  const wrapper: VueWrapper<any> = mount(ChatArea, withChatCallbacks({ ...stubTeleport, props: { chat: chat! } }))
  await wrapper.find('.sp-main > header .menu .trigger').trigger('click')
  const items = wrapper.findAll('.context-menu .item')
  await items[5].trigger('click') // delete (shifted from 4 to 5 due to usage menu item)
  expect(chatCallbacksMock.onDeleteChat).toHaveBeenLastCalledWith(chat!.uuid)
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
  const engineModelSelect = wrapper.findComponent({ name: 'EngineModelSelect' })
  await engineModelSelect.vm.$emit('modelSelected', 'mock', 'chat')
  await wrapper.vm.$nextTick()
  expect(wrapper.find<HTMLSelectElement>('.model-settings select[name=plugins]').element.value).toBe('true')
  expect(chat?.tools).toStrictEqual([])
  expect(chat?.modelOpts?.contextWindowSize).toBe(512)
  expect(chat?.modelOpts?.maxTokens).toBe(150)
  expect(chat?.modelOpts?.temperature).toBe(0.7)
  expect(chat?.modelOpts?.top_k).toBe(10)
  expect(chat?.modelOpts?.top_p).toBe(0.5)
  expect(chat?.modelOpts?.reasoning).toBe(true)

  // load engine/model without defaults
  await engineModelSelect.vm.$emit('modelSelected', 'openai', 'chat')
  await wrapper.vm.$nextTick()
  expect(chat?.tools).toStrictEqual(null)
  expect(chat?.modelOpts).toBeUndefined()

})

test('Model settings update chat', async () => {

  chat?.setEngineModel('mock', 'chat')

  const wrapper: VueWrapper<any> = mount(ChatArea, { ...stubTeleport, props: { chat: chat! } } )
  await wrapper.find('.sp-main > header .settings').trigger('click')

  expect(wrapper.findComponent({ name: 'EngineModelSelect' }).exists()).toBe(true)
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

  const engineModelSelect = wrapper.findComponent({ name: 'EngineModelSelect' })
  expect(engineModelSelect.props('engine')).toBe('mock')
  expect(engineModelSelect.props('model')).toBe('chat')
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
    modelOpts: {
      temperature: 0.7
    }
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
    modelOpts: {
      temperature: 0.7,
      top_k: 15
    }
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
    modelOpts: {
      temperature: 0.7,
      top_k: 15
    }
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

test('Context menu usage disabled when no usage data', async () => {
  addMessagesToChat()
  const wrapper: VueWrapper<any> = mount(ChatArea, { ...stubTeleport, props: { chat: chat! } } )
  await wrapper.find('.sp-main > header .menu .trigger').trigger('click')
  const items = wrapper.findAll('.context-menu .item')
  expect(items[4].text()).toContain('chat.actions.usage')
  expect(items[4].classes()).toContain('disabled') // usage (no usage data)
})

test('Context menu usage shows dialog with total usage', async () => {
  addMessagesToChat()

  // Add usage data to messages
  const message1 = chat!.messages[0]
  message1.usage = {
    prompt_tokens: 100,
    completion_tokens: 50,
  }

  const message2 = chat!.messages[1]
  message2.usage = {
    prompt_tokens: 200,
    completion_tokens: 100,
    prompt_tokens_details: {
      cached_tokens: 50,
    },
    completion_tokens_details: {
      reasoning_tokens: 25,
    }
  }

  const wrapper: VueWrapper<any> = mount(ChatArea, { ...stubTeleport, props: { chat: chat! } } )
  await wrapper.find('.sp-main > header .menu .trigger').trigger('click')
  const items = wrapper.findAll('.context-menu .item')
  expect(items[4].text()).toContain('chat.actions.usage')
  expect(items[4].classes()).not.toContain('disabled')
  await items[4].trigger('click') // usage

  // Check that Dialog.show was called
  expect(Dialog.show).toHaveBeenCalledWith({
    title: 'message.actions.usage.title_default_total=450',
    html: 'message.actions.usage.prompt_default_prompt=300<br/>message.actions.usage.cached_default_cached=50<br/>message.actions.usage.response_default_completion=150<br/>message.actions.usage.reasoning_default_reasoning=25'

  })
})
