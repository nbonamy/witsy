
import { mount, VueWrapper, enableAutoUnmount } from '@vue/test-utils'
import { vi, beforeAll, beforeEach, afterAll, expect, test } from 'vitest'
import { store } from '../../src/services/store'
import Prompt from '../../src/components/Prompt.vue'
import defaults from '../../defaults/settings.json'
import Chat from '../../src/models/chat'
import Message from '../../src/models/message'
import Attachment from '../../src/models/attachment'

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

let wrapper: VueWrapper<any>

beforeAll(() => {

  // api
  window.api = {
    file: {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      pick: vi.fn(({ opts: anyDict}) => {
        return {
          url: 'file://image.png',
          contents: 'image64'
         }
      }),
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      extractText: vi.fn((contents: string, format: string) => {
        return contents
      })
    },
  }

  // init store
  store.config = defaults
  store.config.getActiveModel = () => {
    return 'chat'
  }
  store.prompts = [
    { actor: 'actor1', prompt: 'prompt1' },
    { actor: 'actor2', prompt: 'prompt2' },
    { actor: 'actor3', prompt: 'prompt3' }
  ]

  // wrapper
  wrapper = mount(Prompt, { global: { stubs: { teleport: true } } } )
  //expect(onEventMock).toHaveBeenCalled()
})

beforeEach(() => {
  vi.clearAllMocks()
})

test('Render', () => {
  expect(wrapper.exists()).toBe(true)
  expect(wrapper.find('.input textarea').exists()).toBe(true)
  expect(wrapper.find('.attach').exists()).toBe(true)
  expect(wrapper.find('.send').exists()).toBe(true)
  expect(wrapper.find('.stop').exists()).toBe(false)
})

test('Send on click', async () => {
  const prompt = wrapper.find('.input textarea')
  expect(prompt.element.value).not.toBe('this is my prompt')
  await prompt.setValue('this is my prompt')
  await wrapper.find('.icon.send').trigger('click')
  expect(emitEventMock).toHaveBeenCalled()
  expect(emitEventMock).toHaveBeenCalledWith('sendPrompt', 'this is my prompt')
  expect(prompt.element.value).toBe('')
})

test('Send on enter', async () => {
  const prompt = wrapper.find('.input textarea')
  expect(prompt.element.value).not.toBe('this is my prompt')
  await prompt.setValue('this is my prompt')
  await prompt.trigger('keydown.Enter')
  expect(emitEventMock).toHaveBeenCalled()
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
    format: 'png',
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
  store.pendingAttachment = new Attachment('file://image.png', 'png', 'image64')
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

test('Custom prompts', async () => {
  const trigger = wrapper.find('.icon.prompt')
  await trigger.trigger('click')
  const menu = wrapper.find('.context-menu')
  expect(menu.exists()).toBe(true)
  expect(menu.findAll('.item').length).toBe(3)
  await menu.findAll('.item')[1].trigger('click')
  expect(wrapper.find('.input textarea').element.value).toBe('prompt2')
})