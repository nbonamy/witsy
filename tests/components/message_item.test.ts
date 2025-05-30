
import { vi, beforeAll, beforeEach, afterAll, expect, test } from 'vitest'
import { mount as vtumount, VueWrapper, enableAutoUnmount } from '@vue/test-utils'
import { useWindowMock } from '../mocks/window'
import { store } from '../../src/services/store'
import MessageItem from '../../src/components/MessageItem.vue'
import Message from '../../src/models/message'
import Chat from '../../src/models/chat'

enableAutoUnmount(afterAll)

const onEventMock = vi.fn()
const emitEventMock = vi.fn()
const readAloudMock = vi.fn()

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

vi.mock('../../src/composables/audio_player', async () => {
  return { default: () => ({
    addListener: vi.fn(),
    removeListener: vi.fn(),
    play: readAloudMock,
  })}
})

let chat: Chat
const userMessage: Message = new Message('user', 'Hello <img src="https://example.com/image.jpg" alt="description">')
const botMessageText: Message = new Message('assistant', '**Hi**\n\n1. One \n\n2. Two')
botMessageText.usage = { prompt_tokens: 0, completion_tokens: 0 }
const botMessageImage: Message = Message.fromJson({ role: 'assistant', type: 'text', content: '![image](https://example.com/image.jpg)' })
const botMessageImage2: Message = Message.fromJson({ role: 'assistant', type: 'text', content: '<img src="https://example.com/image.jpg" alt="description">' })
const botMessageVideoMd: Message = Message.fromJson({ role: 'assistant', type: 'text', content: '![video](file:///data/video.mp4)' })
const botMessageVideoHtml: Message = Message.fromJson({ role: 'assistant', type: 'text', content: '<video controls src="file:///data/video.mp4">' })
const botMessageImageLegacy: Message = Message.fromJson({ role: 'assistant', type: 'image', content: 'https://example.com/image.jpg' })
const botMessageTransient: Message = Message.fromJson({ role: 'assistant', type: 'text', content :'Hi' })
const botMessageReasoning: Message = Message.fromJson({ role: 'assistant', type: 'text', reasoning: 'Hum', content :'Hi' })

beforeAll(() => {
  useWindowMock()
  
  // init store
  store.loadSettings()

  // init chat
  chat = new Chat('MessageList test')
  chat.engine = 'openai'

})

beforeEach(() => {

  // clear mocks
  vi.clearAllMocks()

  // reset some stuff
  botMessageImageLegacy.setImage('https://example.com/image.jpg')
  botMessageTransient.transient = true

})

const mount = async (message: Message, mouseenter = true): Promise<VueWrapper<any>> => {
  const wrapper = vtumount(MessageItem, { props: { chat: chat, message: message, readAloud: readAloudMock } })
  if (mouseenter) await wrapper.trigger('mouseenter')
  return wrapper
}

test('Render', async () => {
  const wrapper = await mount(userMessage, false)
  expect(wrapper.exists()).toBe(true)
  expect(wrapper.find('.role').exists()).toBe(true)
  expect(wrapper.find('.body').exists()).toBe(true)
  expect(wrapper.find('.actions').exists()).toBe(false)
})

test('User message', async () => {
  const wrapper = await mount(userMessage)
  expect(wrapper.find('.message').classes()).toContain('user')
  expect(wrapper.find('.role').classes()).toContain('user')
  expect(wrapper.find('.role').text()).toBe('chat.role.user')
  expect(wrapper.find('.avatar').exists()).toBe(true)
  expect(wrapper.find('.logo').exists()).toBe(false)
  expect(wrapper.find('.body').text()).toBe('Hello <img src="https://example.com/image.jpg" alt="description">')
  expect(wrapper.find('.body .transient').exists()).toBe(false)
  expect(wrapper.find('.body .toggle-reasoning').exists()).toBe(false)
  expect(wrapper.find('.body .think').exists()).toBe(false)
  expect(wrapper.find('.actions .copy').exists()).toBe(false)
  expect(wrapper.find('.actions .read').exists()).toBe(false)
  expect(wrapper.find('.actions .retry').exists()).toBe(false)
  expect(wrapper.find('.actions .fork').exists()).toBe(true)
  expect(wrapper.find('.actions .edit').exists()).toBe(true)
  expect(wrapper.find('.actions .usage').exists()).toBe(false)
  
})

test('Assistant text message', async () => {
  const wrapper = await mount(botMessageText)
  expect(wrapper.find('.message').classes()).toContain('assistant')
  expect(wrapper.find('.role').classes()).toContain('assistant')
  expect(wrapper.find('.role').text()).toBe('chat.role.assistant')
  expect(wrapper.find('.role .avatar').exists()).toBe(true)
  expect(wrapper.find('.role .logo').exists()).toBe(true)
  expect(wrapper.find('.body').text()).toBe('Hi\n\n\nOne\n\n\nTwo')
  expect(wrapper.find('.body .transient').exists()).toBe(false)
  expect(wrapper.find('.body .toggle-reasoning').exists()).toBe(false)
  expect(wrapper.find('.body .think').exists()).toBe(false)
  expect(wrapper.find('.actions .copy').exists()).toBe(true)
  expect(wrapper.find('.actions .read').exists()).toBe(true)
  expect(wrapper.find('.actions .retry').exists()).toBe(true)
  expect(wrapper.find('.actions .fork').exists()).toBe(true)
  expect(wrapper.find('.actions .edit').exists()).toBe(false)
  expect(wrapper.find('.actions .usage').exists()).toBe(true)
})

test('Assistant legacy image message', async () => {
  const wrapper = await mount(botMessageImageLegacy)
  expect(wrapper.find('.message').classes()).toContain('assistant')
  expect(wrapper.find('.role').classes()).toContain('assistant')
  expect(wrapper.find('.role').text()).toBe('chat.role.assistant')
  expect(wrapper.find('.role .avatar').exists()).toBe(true)
  expect(wrapper.find('.role .logo').exists()).toBe(true)
  expect(wrapper.find('.body').text()).toBe('')
  expect(wrapper.find('.body .image').exists()).toBe(true)
  expect(wrapper.find('.body .download').exists()).toBe(true)
  expect(wrapper.find('.body .transient').exists()).toBe(false)
  expect(wrapper.find('.body img').attributes('src')).toBe('https://example.com/image.jpg')
  expect(wrapper.find('.actions .copy').exists()).toBe(true)
  expect(wrapper.find('.actions .read').exists()).toBe(false)
  expect(wrapper.find('.actions .retry').exists()).toBe(true)
  expect(wrapper.find('.actions .fork').exists()).toBe(true)
  expect(wrapper.find('.actions .edit').exists()).toBe(false)
  expect(wrapper.find('.actions .usage').exists()).toBe(false)
})

test('Assistant image markdown message', async () => {
  const wrapper = await mount(botMessageImage)
  expect(wrapper.find('.message').classes()).toContain('assistant')
  expect(wrapper.find('.role').classes()).toContain('assistant')
  expect(wrapper.find('.role').text()).toBe('chat.role.assistant')
  expect(wrapper.find('.role .avatar').exists()).toBe(true)
  expect(wrapper.find('.role .logo').exists()).toBe(true)
  expect(wrapper.find('.body').text()).toBe('')
  expect(wrapper.find('.body .image').exists()).toBe(true)
  expect(wrapper.find('.body .download').exists()).toBe(true)
  expect(wrapper.find('.body .transient').exists()).toBe(false)
  expect(wrapper.find('.body img').attributes('src')).toBe('https://example.com/image.jpg')
  expect(wrapper.find('.actions .copy').exists()).toBe(true)
  expect(wrapper.find('.actions .read').exists()).toBe(true)
  expect(wrapper.find('.actions .retry').exists()).toBe(true)
  expect(wrapper.find('.actions .fork').exists()).toBe(true)
  expect(wrapper.find('.actions .edit').exists()).toBe(false)
  expect(wrapper.find('.actions .usage').exists()).toBe(false)
})

test('Assistant image html message', async () => {
  const wrapper = await mount(botMessageImage2)
  expect(wrapper.find('.message').classes()).toContain('assistant')
  expect(wrapper.find('.role').classes()).toContain('assistant')
  expect(wrapper.find('.role').text()).toBe('chat.role.assistant')
  expect(wrapper.find('.role .avatar').exists()).toBe(true)
  expect(wrapper.find('.role .logo').exists()).toBe(true)
  expect(wrapper.find('.body').text()).toBe('')
  expect(wrapper.find('.body .image').exists()).toBe(true)
  expect(wrapper.find('.body .download').exists()).toBe(true)
  expect(wrapper.find('.body .transient').exists()).toBe(false)
  expect(wrapper.find('.body img').attributes('src')).toBe('https://example.com/image.jpg')
  expect(wrapper.find('.actions .copy').exists()).toBe(true)
  expect(wrapper.find('.actions .read').exists()).toBe(true)
  expect(wrapper.find('.actions .retry').exists()).toBe(true)
  expect(wrapper.find('.actions .fork').exists()).toBe(true)
  expect(wrapper.find('.actions .edit').exists()).toBe(false)
  expect(wrapper.find('.actions .usage').exists()).toBe(false)
})

test('Assistant video markdown message', async () => {
  const wrapper = await mount(botMessageVideoMd)
  expect(wrapper.find('.message').classes()).toContain('assistant')
  expect(wrapper.find('.role').classes()).toContain('assistant')
  expect(wrapper.find('.role').text()).toBe('chat.role.assistant')
  expect(wrapper.find('.role .avatar').exists()).toBe(true)
  expect(wrapper.find('.role .logo').exists()).toBe(true)
  expect(wrapper.find('.body').text()).toBe('')
  expect(wrapper.find('.body .video').exists()).toBe(true)
  expect(wrapper.find('.body .download').exists()).toBe(true)
  expect(wrapper.find('.body .transient').exists()).toBe(false)
  expect(wrapper.find('.body video').attributes('src')).toBe('file:///data/video.mp4')
  expect(wrapper.find('.actions .copy').exists()).toBe(true)
  expect(wrapper.find('.actions .read').exists()).toBe(true)
  expect(wrapper.find('.actions .retry').exists()).toBe(true)
  expect(wrapper.find('.actions .fork').exists()).toBe(true)
  expect(wrapper.find('.actions .edit').exists()).toBe(false)
  expect(wrapper.find('.actions .usage').exists()).toBe(false)
})

test('Assistant video html message', async () => {
  const wrapper = await mount(botMessageVideoHtml)
  expect(wrapper.find('.message').classes()).toContain('assistant')
  expect(wrapper.find('.role').classes()).toContain('assistant')
  expect(wrapper.find('.role').text()).toBe('chat.role.assistant')
  expect(wrapper.find('.role .avatar').exists()).toBe(true)
  expect(wrapper.find('.role .logo').exists()).toBe(true)
  expect(wrapper.find('.body').text()).toBe('')
  expect(wrapper.find('.body .video').exists()).toBe(true)
  expect(wrapper.find('.body .download').exists()).toBe(true)
  expect(wrapper.find('.body .transient').exists()).toBe(false)
  expect(wrapper.find('.body video').attributes('src')).toBe('file:///data/video.mp4')
  expect(wrapper.find('.actions .copy').exists()).toBe(true)
  expect(wrapper.find('.actions .read').exists()).toBe(true)
  expect(wrapper.find('.actions .retry').exists()).toBe(true)
  expect(wrapper.find('.actions .fork').exists()).toBe(true)
  expect(wrapper.find('.actions .edit').exists()).toBe(false)
  expect(wrapper.find('.actions .usage').exists()).toBe(false)
})

test('Assistant image message formats', async () => {
  const wrapper1 = await mount(botMessageImageLegacy)
  expect(wrapper1.find('.body img.image').attributes().src).toBe('https://example.com/image.jpg')

  botMessageImageLegacy.setImage('file://image.png')
  const wrapper2 = await mount(botMessageImageLegacy)
  expect(wrapper2.find('.body img.image').attributes().src).toBe('file://image.png')

  botMessageImageLegacy.setImage('imageb64')
  const wrapper3 = await mount(botMessageImageLegacy)
  expect(wrapper3.find('.body img.image').attributes().src).toBe('data:image/png;base64,imageb64')

  const wrappe4 = await mount(botMessageImage)
  expect(wrappe4.find('.body img.image').attributes().src).toBe('https://example.com/image.jpg')
})

test('Transient message', async () => {
  const wrapper = await mount(botMessageTransient)
  expect(wrapper.find('.body').text()).toBe('Hi')
  expect(wrapper.find('.body .transient').exists()).toBe(true)
  expect(wrapper.find('.body .transient .loader').exists()).toBe(true)
  expect(wrapper.find('.body .transient .tool-call').exists()).toBe(false)
  expect(wrapper.find('.role .actions .copy').exists()).toBe(false)
  expect(wrapper.find('.role .actions .read').exists()).toBe(false)
  expect(wrapper.find('.role .actions .edit').exists()).toBe(false)
})

test('Tool call message', async () => {
  botMessageTransient.setToolCall({ type: 'tool', name: 'tool', status: 'Calling a tool', done: false })
  const wrapper = await mount(botMessageTransient)
  expect(wrapper.find('.body .transient').exists()).toBe(true)
  expect(wrapper.find('.body .transient .tool-call').exists()).toBe(true)
  expect(wrapper.find('.body .transient').text()).toBe('Calling a tool')
})

test('Toggle actions', async () => {
  const wrapper = await mount(userMessage, false)
  await wrapper.trigger('mouseenter')
  expect (wrapper.find('.actions').exists()).toBe(true)
  await wrapper.trigger('mouseleave')
  expect (wrapper.find('.actions').exists()).toBe(false)
})

test('Run user actions', async () => {
  
  const wrapper = await mount(userMessage)

  await wrapper.find('.actions .edit').trigger('click')
  expect(emitEventMock).toHaveBeenLastCalledWith('set-prompt', userMessage)

  await wrapper.find('.actions .delete').trigger('click')
  expect(emitEventMock).toHaveBeenLastCalledWith('delete-message', userMessage)
})

test('Run assistant text actions', async () => {
  const wrapper = await mount(botMessageText, )
  
  // copy
  await wrapper.find('.actions .copy').trigger('click')
  expect(window.api.clipboard.writeText).toHaveBeenLastCalledWith('Hi\n\n1. One\n\n2. Two')
  expect(wrapper.find('.actions .copy').text()).toBe('common.copied')

  // usage
  await wrapper.find('.actions .usage').trigger('click')
  expect(window.api.showDialog).toHaveBeenCalledTimes(1)

  // read aloud
  await wrapper.find('.actions .read').trigger('click')
  expect(readAloudMock).toHaveBeenCalled()

  // retry
  await wrapper.find('.actions .retry').trigger('click')
  expect(window.api.showDialog).toHaveBeenCalledTimes(2)
  expect(store.config.general.confirm.retryGeneration).toBe(false)
  expect(emitEventMock).toHaveBeenLastCalledWith('retry-generation', botMessageText)

  // retry again
  await wrapper.find('.actions .retry').trigger('click')
  expect(window.api.showDialog).toHaveBeenCalledTimes(2)

  // fork
  await wrapper.find('.actions .fork').trigger('click')
  expect(emitEventMock).toHaveBeenLastCalledWith('fork-chat', botMessageText)


  // await wait(1500)
  // expect(wrapper.find('.actions .copy').text()).not.toBe('common.copied')
})

test('Run assistant legacy image actions', async () => {
  const wrapper = await mount(botMessageImageLegacy)
  await wrapper.find('.actions .copy').trigger('click')
  expect(window.api.clipboard.writeImage).toHaveBeenCalled()
  expect(wrapper.find('.actions .copy').text()).toBe('common.copied')
  // await wait(1500)
  // expect(wrapper.find('.actions .copy').text()).not.toBe('common.copied')

  await wrapper.find('.body .download').trigger('click')
  expect(window.api.file.download).toHaveBeenLastCalledWith({
    url: 'https://example.com/image.jpg',
    properties: {
      directory: 'downloads',
      prompt: true,
      filename: 'image.jpg',
    }
  })

})

test('Run assistant image actions', async () => {
  const wrapper = await mount(botMessageImage)
  await wrapper.find('.body .copy').trigger('click')
  expect(window.api.clipboard.writeImage).toHaveBeenLastCalledWith('https://example.com/image.jpg')
  await wrapper.find('.body .download').trigger('click')
  expect(window.api.file.download).toHaveBeenLastCalledWith({
    url: 'https://example.com/image.jpg',
    properties: {
      directory: 'downloads',
      prompt: true,
      filename: 'image.jpg',
    }
  })
})

test('Run assistant video actions', async () => {
  const wrapper = await mount(botMessageVideoMd)
  expect(wrapper.find('.body .copy').exists()).toBe(false)
  await wrapper.find('.body .download').trigger('click')
  expect(window.api.file.download).toHaveBeenLastCalledWith({
    url: 'file:///data/video.mp4',
    properties: {
      directory: 'downloads',
      prompt: true,
      filename: 'video.mp4',
    }
  })

})

test('Format code', async () => {
  botMessageText.setText('```javascript\nconsole.log(variable)\n```')
  const wrapper = await mount(botMessageText)
  expect(wrapper.find('.body pre[class=hljs] code[class="hljs variable-font-size"]').exists()).toBe(true)
  expect(wrapper.find('.body .copy').exists()).toBe(true)
  expect(wrapper.find('.body .copy').text()).toBe('Copy code')
})

test('Format math equations katex', async () => {
  botMessageText.setText('$$\n\\frac{1}{2}\n$$')
  const wrapper = await mount(botMessageText)
  expect(wrapper.find('.body p[class=katex-block]').exists()).toBe(true)
})

test('Format math equations OpenAI', async () => {
  botMessageText.setText('\\[\n\\frac{1}{2}\n\\]')
  const wrapper = await mount(botMessageText)
  expect(wrapper.find('.body p[class=katex-block]').exists()).toBe(true)
})

test('Format reasoning message', async () => {
  expect(store.config.appearance.chat.showReasoning).toBe(true)
  const wrapper = await mount(botMessageReasoning)
  expect(wrapper.find('.body .toggle-reasoning').exists()).toBe(true)
  expect(wrapper.find('.body .think').exists()).toBe(true)
  await (wrapper.find('.body .toggle-reasoning').trigger('click'))
  expect(wrapper.find('.body .think').exists()).toBe(false)
  expect(store.config.appearance.chat.showReasoning).toBe(false)
})
