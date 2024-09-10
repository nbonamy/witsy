
import { vi, beforeAll, beforeEach, afterAll, expect, test } from 'vitest'
import { mount, VueWrapper, enableAutoUnmount } from '@vue/test-utils'
import { store } from '../../src/services/store'
import Prompt from '../../src/components/Prompt.vue'
import defaults from '../../defaults/settings.json'
import Chat from '../../src/models/chat'
import Message from '../../src/models/message'
import Attachment from '../../src/models/attachment'

enableAutoUnmount(afterAll)

const onEventMock = vi.fn()
const emitEventMock = vi.fn((event, ...args) => {
  // this is called when mounting so discard it
  if (event === 'promptResize' && args[0] === '0px') {
    emitEventMock.mockClear()
  }
})

vi.mock('../../src/composables/useEventBus.js', async () => {
  return { default: () => {
    return {
      onEvent: onEventMock,
      emitEvent: emitEventMock
    }
  }}
})

let wrapper: VueWrapper<any>

beforeAll(() => {

  // api
  window.api = {
    on: vi.fn(),
    file: {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      pick: vi.fn(() => {
        return {
          url: 'file://image.png',
          contents: 'image64'
         }
      }),
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      extractText: vi.fn((contents: string) => {
        return contents
      })
    },
    docrepo: {
      list: vi.fn(() => [
        { uuid: 'uuid1', name: 'doc1', embeddingEngine: 'mock', embeddingModel: 'chat', documents: [] }
      ]),
      connect: vi.fn(() => true),
      disconnect: vi.fn(() => true)
    },
  }

  // init store
  store.config = defaults
  store.config.getActiveModel = () => {
    return 'chat'
  }
  store.experts = [
    { id: 'uuid1', type: 'system', name: 'actor1', prompt: 'prompt1', state: 'enabled' },
    { id: 'uuid2', type: 'system', name: 'actor2', prompt: 'prompt2', state: 'disabled' },
    { id: 'uuid3', type: 'user', name: 'actor3', prompt: 'prompt3', state: 'enabled' }
]
})

beforeEach(() => {
  vi.clearAllMocks()
  wrapper = mount(Prompt, { global: { stubs: { teleport: true } } } )
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
  const prompt = wrapper.find('.input textarea')
  expect(prompt.element.value).not.toBe('this is my prompt')
  await prompt.setValue('this is my prompt')
  await wrapper.find('.icon.send').trigger('click')
  expect(emitEventMock).toHaveBeenCalledWith('sendPrompt', 'this is my prompt')
  expect(prompt.element.value).toBe('')
})

test('Send on enter', async () => {
  const prompt = wrapper.find('.input textarea')
  expect(prompt.element.value).not.toBe('this is my prompt')
  await prompt.setValue('this is my prompt')
  await prompt.trigger('keydown.Enter')
  expect(emitEventMock).toHaveBeenCalledWith('sendPrompt', 'this is my prompt')
  expect(prompt.element.value).toBe('')
})

test('Not send on shift enter', async () => {
  const prompt = wrapper.find('.input textarea')
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
  const chat = new Chat({ messages: [ {} ] })
  chat.messages[0].transient = true
  await wrapper.setProps({ chat: chat })
  expect(wrapper.find('.send').exists()).toBe(false)
  expect(wrapper.find('.stop').exists()).toBe(true)
  await wrapper.find('.icon.stop').trigger('click')
  expect(emitEventMock).toHaveBeenCalledWith('stopAssistant')
})

test('Send attachment', async () => {
  const attach = wrapper.find('.attach')
  await attach.trigger('click')
  expect(window.api.file.pick).toHaveBeenCalled()
  expect(window.api.file.pick).toHaveBeenCalledWith({
    //filters: [{ name: 'Images', extensions: ['jpg', 'png', 'gif'] }]
  })
  expect(emitEventMock).toHaveBeenCalledWith('attachFile', {
    mimeType: 'image/png',
    contents: 'image64',
    downloaded: false,
    url: 'file://image.png',
  })
})

test('Display url attachment', async () => {
  store.pendingAttachment = new Attachment('file://image.png')
  await wrapper.vm.$nextTick()
  expect(wrapper.find('.attachment').exists()).toBe(true)
  expect(wrapper.find('.attachment img').exists()).toBe(true)
  expect(wrapper.find('.attachment img').attributes('src')).toBe('file://image.png')
})

test('Display base64 attachment', async () => {
  store.pendingAttachment = new Attachment('file://image.png', 'image/png', 'image64')
  await wrapper.vm.$nextTick()
  expect(wrapper.find('.attachment').exists()).toBe(true)
  expect(wrapper.find('.attachment img').exists()).toBe(true)
  expect(wrapper.find('.attachment img').attributes('src')).toBe('data:image/png;base64,image64')
})

test('Remove attachment', async () => {
  await wrapper.find('.attachment').trigger('click')
  expect(emitEventMock).toHaveBeenCalledWith('detachFile')
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
  
  await wrapper.setProps({ chat: new Chat({ messages: [ 
    new Message('system', 'I am an assistant'),
    new Message('user', 'Hello'),
    new Message('assistant', 'Hi'),
    new Message('user', 'Bonjour'),
    new Message('assistant', 'Ciao'),
  ]})})

  const prompt = wrapper.find('.input textarea')
  await prompt.setValue('Hola')
  await prompt.trigger('keydown.ArrowUp', { shiftKey: true })
  expect(prompt.element.value).toBe('Bonjour')
  await prompt.trigger('keydown.ArrowUp', { shiftKey: true })
  expect(prompt.element.value).toBe('Hello')
  await prompt.trigger('keydown.ArrowUp', { shiftKey: true })
  expect(prompt.element.value).toBe('Hello')
  await prompt.trigger('keydown.ArrowDown', { shiftKey: true })
  expect(prompt.element.value).toBe('Bonjour')
  await prompt.trigger('keydown.ArrowDown', { shiftKey: true })
  expect(prompt.element.value).toBe('Hola')

})

test('Experts', async () => {
  const trigger = wrapper.find('.icon.experts')
  await trigger.trigger('click')
  const menu = wrapper.find('.context-menu')
  expect(menu.exists()).toBe(true)
  expect(menu.findAll('.item').length).toBe(2)
  await menu.find('.item:nth-child(2)').trigger('click')
  expect(wrapper.find('.input textarea').element.value).toBe('prompt3')
})

test('Document repository', async () => {

  // trigger
  const trigger = wrapper.find('.icon.docrepo')
  await trigger.trigger('click')
  let menu = wrapper.find('.context-menu')
  expect(menu.exists()).toBe(true)
  expect(menu.findAll('.item').length).toBe(3)
  expect(menu.find('.item:nth-child(1)').text()).toBe('doc1')
  expect(menu.find('.item:nth-child(2) hr')).toBeTruthy()
  expect(menu.find('.item:nth-child(3)').text()).toBe('Manage...')

  // manage
  await menu.find('.item:nth-child(3)').trigger('click')
  expect(emitEventMock).toHaveBeenCalledWith('openDocRepos')

  // connect
  await trigger.trigger('click')
  menu = wrapper.find('.context-menu')
  await menu.find('.item:nth-child(1)').trigger('click')
  expect(window.api.docrepo.connect).toHaveBeenCalledWith('uuid1')

  // trigger again
  await trigger.trigger('click')
  menu = wrapper.find('.context-menu')
  expect(menu.exists()).toBe(true)
  expect(menu.findAll('.item').length).toBe(4)
  expect(menu.find('.item:nth-child(3)').text()).toBe('Disconnect')

  // disconnect
  await menu.find('.item:nth-child(3)').trigger('click')
  expect(window.api.docrepo.disconnect).toHaveBeenCalledWith()
})
