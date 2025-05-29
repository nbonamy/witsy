
import { vi, beforeAll, beforeEach, afterAll, expect, test } from 'vitest'
import { mount, VueWrapper, enableAutoUnmount } from '@vue/test-utils'
import { useWindowMock, useBrowserMock } from '../mocks/window'
import { stubTeleport } from '../mocks/stubs'
import { store } from '../../src/services/store'
import Prompt from '../../src/components/Prompt.vue'
import Chat from '../../src/models/chat'
import Attachment from '../../src/models/attachment'

enableAutoUnmount(afterAll)

const onEventMock = vi.fn()
const emitEventMock = vi.fn((event, ...args) => {
  // this is called when mounting so discard it
  if (event === 'prompt-resize' && args[0] === '0px') {
    emitEventMock.mockClear()
  }
})

vi.mock('../../src/services/i18n', async () => {
  return {
    t: (key: string) => `${key}`,
    expertI18n: vi.fn((expert, attr) => `${expert?.id}.${attr}`),
    commandI18n: vi.fn((command, attr) => `${command?.id}.${attr}.{input}`),
  }
})

vi.mock('../../src/composables/event_bus', async () => {
  return { default: () => ({
    onEvent: onEventMock,
    emitEvent: emitEventMock
  })}
})

let wrapper: VueWrapper<any>
let chat: Chat|null = null

beforeAll(() => {
  useBrowserMock()
  useWindowMock()
  store.loadSettings()
  store.loadExperts()
  store.loadCommands()
  store.config.llm.imageResize = 0
  store.config.engines.openai.models.chat.push(
    { id: 'gpt-4o', capabilities: { tools: true, vision: true, reasoning: false } },
  )
})

beforeEach(() => {
  vi.clearAllMocks()
  chat = new Chat()
  wrapper = mount(Prompt, { ...stubTeleport, props: { chat: chat } } )
})

test('Render', () => {
  expect(wrapper.exists()).toBe(true)
  expect(wrapper.find('.input textarea').exists()).toBe(true)
  expect(wrapper.find('.icon.attach').exists()).toBe(true)
  expect(wrapper.find('.icon.docrepo').exists()).toBe(true)
  expect(wrapper.find('.icon.experts').exists()).toBe(true)
  expect(wrapper.find('.send').exists()).toBe(true)
  expect(wrapper.find('.stop').exists()).toBe(false)
  expect(window.api.docrepo.list).toHaveBeenCalled()
})

test('Send on click', async () => {
  const prompt = wrapper.find<HTMLInputElement>('.input textarea')
  expect(prompt.element.value).not.toBe('this is my prompt')
  await prompt.setValue('this is my prompt')
  await wrapper.find('.icon.send').trigger('click')
  expect(emitEventMock).toHaveBeenLastCalledWith('send-prompt', {
    prompt: 'this is my prompt',
    attachments: [],
    docrepo: null,
    expert: null
  })
  expect(prompt.element.value).toBe('')
})

test('Sends on enter', async () => {
  const prompt = wrapper.find<HTMLInputElement>('.input textarea')
  expect(prompt.element.value).not.toBe('this is my prompt')
  await prompt.setValue('this is my prompt')
  await prompt.trigger('keydown.Enter')
  expect(emitEventMock).toHaveBeenLastCalledWith('send-prompt', {
    prompt: 'this is my prompt',
    attachments: [],
    docrepo: null,
    expert: null
  })
  expect(prompt.element.value).toBe('')
})

test('Sends with right parameters', async () => {
  wrapper.vm.attachments = [ new Attachment('image64', 'image/png', 'file://image.png') ]
  wrapper.vm.expert = store.experts[2]
  wrapper.vm.docrepo = 'docrepo'
  const prompt = wrapper.find<HTMLInputElement>('.input textarea')
  expect(prompt.element.value).not.toBe('this is my prompt')
  await prompt.setValue('this is my prompt')
  await prompt.trigger('keydown.Enter')
  expect(emitEventMock).toHaveBeenLastCalledWith('send-prompt', {
    prompt: 'this is my prompt',
    attachments: [ { content: 'image64', mimeType: 'image/png', url: 'file://image.png', title: '', context: '', saved: false, extracted: false } ],
    expert: { id: 'uuid3', name: 'actor3', prompt: 'prompt3', type: 'user', state: 'enabled', triggerApps: [ { identifier: 'app' }] },
    docrepo: 'docrepo',
  })
  expect(prompt.element.value).toBe('')
})

test('Not send on shift enter', async () => {
  const prompt = wrapper.find<HTMLInputElement>('.input textarea')
  await prompt.setValue('this is my prompt')
  await prompt.trigger('keydown.enter.shift')
  expect(emitEventMock).not.toHaveBeenCalled()
})

// test('Autogrow', async () => {
//   const prompt = wrapper.find('.input textarea')
//   for (const char of 'this is my prompt') {
//     await prompt.trigger(`keyup.${char}`)
//   }
//   expect(prompt.element.value).toBe('this is my prompt')
//   expect(prompt.element.style.height).toBe('150px')
// })

test('Show stop button when working', async () => {
  const chat = Chat.fromJson({ messages: [ {} ] })
  chat.messages[0].transient = true
  await wrapper.setProps({ chat: chat })
  expect(wrapper.find('.send').exists()).toBe(false)
  expect(wrapper.find('.stop').exists()).toBe(true)
  await wrapper.find('.icon.stop').trigger('click')
  expect(emitEventMock).toHaveBeenLastCalledWith('stop-prompting', null)
})

test('Stores attachment', async () => {
  const attach = wrapper.find('.attach')
  await attach.trigger('click')
  expect(window.api.file.pick).toHaveBeenCalled()
  expect(window.api.file.pick).toHaveBeenLastCalledWith({
    multiselection: true,
    //filters: [{ name: 'Images', extensions: ['jpg', 'png', 'gif'] }]
  })
  expect(wrapper.vm.attachments).toEqual([{
    mimeType: 'image/png',
    content: 'image1.png_encoded',
    saved: false,
    extracted: false,
    url: 'image1.png',
    title: '',
    context: '',
  }, {
    mimeType: 'image/png',
    content: 'image2.png_encoded',
    saved: false,
    extracted: false,
    url: 'image2.png',
    title: '',
    context: '',
  }])
})

test('Remove attachments', async () => {
  wrapper.vm.attachments = [
    new Attachment('image64', 'image/png', 'file://image.png'),
    new Attachment('image64', 'image/png', 'file://image.png')
  ]
  await wrapper.vm.$nextTick()
  await wrapper.find('.attachment:last-child').trigger('click')
  expect(wrapper.vm.attachments).toHaveLength(1)
  await wrapper.find('.attachment:last-child').trigger('click')
  expect(wrapper.vm.attachments).toStrictEqual([])
})

test('Display url attachment', async () => {
  wrapper.vm.attachments = [ new Attachment('', '', 'file://image.png') ]
  await wrapper.vm.$nextTick()
  expect(wrapper.find('.attachments').exists()).toBe(true)
  expect(wrapper.find('.attachment').exists()).toBe(true)
  expect(wrapper.find('.attachment img').exists()).toBe(true)
  expect(wrapper.find('.attachment img').attributes('src')).toBe('file://image.png')
})

test('Display base64 attachment', async () => {
  wrapper.vm.attachments = [ new Attachment('image64', 'image/png', 'file://image.png') ]
  await wrapper.vm.$nextTick()
  expect(wrapper.find('.attachments').exists()).toBe(true)
  expect(wrapper.find('.attachment').exists()).toBe(true)
  expect(wrapper.find('.attachment img').exists()).toBe(true)
  expect(wrapper.find('.attachment img').attributes('src')).toBe('data:image/png;base64,image64')
})

// test('Accept incoming prompt', async () => {
//   const prompt = wrapper.find('.input textarea')
//   prompt.setValue('')
//   emitEventMock.mockRestore()
//   useEventBus().emitEvent('set-prompt', { content: 'this is my prompt' })
//   await wrapper.vm.$nextTick()
//   expect(prompt.element.value).toBe('this is my prompt')
// })

test('History navigation', async () => {
  
  await wrapper.setProps({ historyProvider: () => [ 'Hello', 'Bonjour' ] })
  const prompt = wrapper.find<HTMLInputElement>('.input textarea')
  await prompt.setValue('Hola')
  // triggering ArrowUp does not move selection to the beginning
  // as it does in real-life so we need to set it manually
  await prompt.element.setSelectionRange(0, 0)
  await prompt.trigger('keydown.ArrowUp')
  expect(prompt.element.value).toBe('Bonjour')
  await prompt.trigger('keydown.ArrowUp')
  expect(prompt.element.value).toBe('Hello')
  await prompt.trigger('keydown.ArrowUp')
  expect(prompt.element.value).toBe('Hello')
  await prompt.trigger('keydown.ArrowDown')
  expect(prompt.element.value).toBe('Bonjour')
  await prompt.trigger('keydown.ArrowDown')
  expect(prompt.element.value).toBe('Hola')

})

test('Selects expert', async () => {
  const trigger = wrapper.find('.icon.experts')
  await trigger.trigger('click')
  const menu = wrapper.find('.context-menu')
  expect(menu.exists()).toBe(true)
  expect(menu.findAll('.filter').length).toBe(1)
  expect(menu.findAll('.item').length).toBe(2)
  await menu.find('.item:nth-child(2)').trigger('click')
  expect(wrapper.vm.expert.id).toBe('uuid3')
  expect(wrapper.find('.input .icon.expert').exists()).toBe(true)
})

test('Clears expert', async () => {
  wrapper.vm.expert = store.experts[0]
  await wrapper.vm.$nextTick()
  const trigger = wrapper.find('.input .icon.expert')
  await trigger.trigger('click')
  const menu = wrapper.find('.context-menu')
  expect(menu.exists()).toBe(true)
  expect(menu.find('.item:nth-child(1)').text()).toBe('uuid1.name')
  expect(menu.find('.item:nth-child(2)').text()).toBe('uuid1.prompt')
  expect(menu.find('.item:nth-child(3)').text()).toBe('')
  expect(menu.find('.item:nth-child(4)').text()).toBe('prompt.expert.clear')
  await menu.find('.item:nth-child(4)').trigger('click')
  expect(wrapper.vm.expert).toBeNull()
})

test('Stores command for later', async () => {
  const prompt = wrapper.find<HTMLInputElement>('.input textarea')
  await prompt.trigger('keydown', { key: '#' })
  const menu = wrapper.find('.context-menu')
  expect(menu.exists()).toBe(true)
  expect(menu.findAll('.filter').length).toBe(0)
  expect(menu.findAll('.item').length).toBe(4)
  await menu.find('.item:nth-child(2)').trigger('click')
  expect(wrapper.vm.command.id).toBe('uuid2')
  expect(wrapper.find('.input .icon.command.left').exists()).toBe(true)
  prompt.setValue('this is my prompt')
  await prompt.trigger('keydown.Enter')
  expect(emitEventMock).toHaveBeenLastCalledWith('send-prompt', {
    prompt: 'uuid2.template.this is my prompt',
    attachments: [],
    expert: null,
    docrepo: null,
  })
})

test('Selects command and run', async () => {
  const prompt = wrapper.find<HTMLInputElement>('.input textarea')
  expect(prompt.element.value).not.toBe('this is my prompt')
  await prompt.setValue('this is my prompt')
  const trigger = wrapper.find('.icon.command.right')
  await trigger.trigger('click')
  const menu = wrapper.find('.context-menu')
  expect(menu.exists()).toBe(true)
  expect(menu.findAll('.filter').length).toBe(0)
  expect(menu.findAll('.item').length).toBe(4)
  await menu.find('.item:nth-child(2)').trigger('click')
  expect(emitEventMock).toHaveBeenLastCalledWith('send-prompt', {
    prompt: 'uuid2.template.this is my prompt',
    attachments: [],
    expert: null,
    docrepo: null,
  })
})

test('Clears comamnd', async () => {
  wrapper.vm.command = store.commands[0]
  await wrapper.vm.$nextTick()
  await wrapper.find('.input .icon.command.left').trigger('click')
  expect(wrapper.vm.command).toBeNull()
})

test('Document repository', async () => {

  // trigger
  const trigger = wrapper.find('.icon.docrepo')
  await trigger.trigger('click')
  let menu = wrapper.find('.context-menu')
  expect(menu.exists()).toBe(true)
  expect(menu.findAll('.item').length).toBe(2)
  expect(menu.find('.item:nth-child(1)').text()).toBe('docrepo1')
  expect(menu.find('.item:nth-child(2)').text()).toBe('docrepo2')

  // connect
  await trigger.trigger('click')
  menu = wrapper.find('.context-menu')
  await menu.find('.item:nth-child(1)').trigger('click')
  expect(window.api.docrepo.connect).toHaveBeenLastCalledWith('uuid1')

  // trigger again
  await trigger.trigger('click')
  menu = wrapper.find('.context-menu')
  expect(menu.exists()).toBe(true)
  expect(menu.findAll('.item').length).toBe(4)
  expect(menu.find('.item:nth-child(4)').text()).toBe('Disconnect')

  // disconnect
  await menu.find('.item:nth-child(4)').trigger('click')
  expect(window.api.docrepo.disconnect).toHaveBeenLastCalledWith()
})
