
import { mount, VueWrapper } from '@vue/test-utils'
import Prompt from '../../src/components/Prompt.vue'
import { vi, beforeAll, beforeEach, afterAll, expect, test } from 'vitest'
import { ipcRenderer } from 'electron'
import { store } from '../../src/services/store'
import defaults from '../../defaults/settings.json'
import Chat from '../../src/models/chat'
//import useEventBus from '../../src/composables/useEventBus'

const onEventMock = vi.fn()
const emitEventMock = vi.fn()

vi.mock('electron', async (importOriginal) => {
  const mod: any = await importOriginal()
  return {
    ...mod,
    ipcRenderer: {
      sendSync: vi.fn(() => {
        return {
          url: 'file://image.png',
          contents: 'image64'
         }
      }),
    }
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

  // init store
  store.config = defaults

  // wrapper
  wrapper = mount(Prompt, { attachTo: document.body })
  //expect(onEventMock).toHaveBeenCalled()
})

beforeEach(() => {
  vi.clearAllMocks()
})

afterAll(() => {
  wrapper.unmount()
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
  await prompt.trigger('keydown.enter')
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
  expect(ipcRenderer.sendSync).toHaveBeenCalled()
  expect(ipcRenderer.sendSync).toHaveBeenCalledWith('pick-file', {
    filters: [{ name: 'Images', extensions: ['jpg', 'png', 'gif'] }]
  })
  expect(emitEventMock).toHaveBeenCalledWith('attachFile', {
    contents: 'image64',
    downloaded: false,
    url: 'file://image.png',
  })
})

test('Display url attachment', async () => {
  store.pendingAttachment = { url: 'file://image.png' }
  await wrapper.vm.$nextTick()
  expect(wrapper.find('.attachment').exists()).toBe(true)
  expect(wrapper.find('.attachment img').exists()).toBe(true)
  expect(wrapper.find('.attachment img').attributes('src')).toBe('file://image.png')
})

test('Display base64 attachment', async () => {
  store.pendingAttachment = { contents: 'image64' }
  await wrapper.vm.$nextTick()
  expect(wrapper.find('.attachment').exists()).toBe(true)
  expect(wrapper.find('.attachment img').exists()).toBe(true)
  expect(wrapper.find('.attachment img').attributes('src')).toBe('data:image/png;base64,image64')
})

test('Remove attachment', async () => {
  await wrapper.find('.attachment .icon').trigger('click')
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

