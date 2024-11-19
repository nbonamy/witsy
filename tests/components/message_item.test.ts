
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

vi.mock('../../src/composables/event_bus.js', async () => {
  return { default: () => {
    return {
      onEvent: onEventMock,
      emitEvent: emitEventMock
    }
  }}
})

let chat: Chat
const userMessage: Message = new Message('user', 'Hello')
const botMessageText: Message = new Message('assistant', 'Hi')
const botMessageImage: Message = Message.fromJson({ role: 'assistant', type: 'image', content: 'https://example.com/image.jpg' })
const botMessageTransient: Message = Message.fromJson({ role: 'assistant', type: 'text', content :'Hi' })

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
  botMessageImage.setImage('https://example.com/image.jpg')
  botMessageTransient.transient = true

})

const mount = async (message: Message, mouseenter = true): Promise<VueWrapper<any>> => {
  const wrapper = vtumount(MessageItem, { props: { chat: chat, message: message } })
  if (mouseenter) await wrapper.trigger('mouseenter')
  return wrapper
}

test('Render', async () => {
  const wrapper = await mount(userMessage, false)
  expect(wrapper.exists()).toBe(true)
  expect (wrapper.find('.role').exists()).toBe(true)
  expect (wrapper.find('.body').exists()).toBe(true)
  expect (wrapper.find('.actions').exists()).toBe(false)
})

test('User message', async () => {
  const wrapper = await mount(userMessage)
  expect(wrapper.find('.message').classes()).toContain('user')
  expect(wrapper.find('.role').classes()).toContain('user')
  expect(wrapper.find('.role').text()).toBe('You')
  expect(wrapper.find('.avatar').exists()).toBe(true)
  expect(wrapper.find('.logo').exists()).toBe(false)
  expect(wrapper.find('.body').text()).toBe('Hello')
  expect(wrapper.find('.body .transient').exists()).toBe(false)
  expect(wrapper.find('.actions .copy').exists()).toBe(false)
  expect(wrapper.find('.actions .read').exists()).toBe(false)
  expect(wrapper.find('.actions .edit').exists()).toBe(true)
})

test('Assistant text message', async () => {
  const wrapper = await mount(botMessageText)
  expect(wrapper.find('.message').classes()).toContain('assistant')
  expect(wrapper.find('.role').classes()).toContain('assistant')
  expect(wrapper.find('.role').text()).toBe('Assistant')
  expect(wrapper.find('.role .avatar').exists()).toBe(true)
  expect(wrapper.find('.role .logo').exists()).toBe(true)
  expect(wrapper.find('.body').text()).toBe('Hi')
  expect(wrapper.find('.body .transient').exists()).toBe(false)
  expect(wrapper.find('.actions .copy').exists()).toBe(true)
  expect(wrapper.find('.actions .read').exists()).toBe(true)
  expect(wrapper.find('.actions .edit').exists()).toBe(false)
})

test('Assistant image message', async () => {
  const wrapper = await mount(botMessageImage)
  expect(wrapper.find('.message').classes()).toContain('assistant')
  expect(wrapper.find('.role').classes()).toContain('assistant')
  expect(wrapper.find('.role').text()).toBe('Assistant')
  expect(wrapper.find('.role .avatar').exists()).toBe(true)
  expect(wrapper.find('.role .logo').exists()).toBe(true)
  expect(wrapper.find('.body').text()).toBe('')
  expect(wrapper.find('.body .image').exists()).toBe(true)
  expect(wrapper.find('.body .download').exists()).toBe(true)
  expect(wrapper.find('.body .transient').exists()).toBe(false)
  expect(wrapper.find('.actions .copy').exists()).toBe(true)
  expect(wrapper.find('.actions .read').exists()).toBe(false)
  expect(wrapper.find('.actions .edit').exists()).toBe(false)
})

test('Assistant image message formats', async () => {
  const wrapper1 = await mount(botMessageImage)
  expect(wrapper1.find('.body img.image').attributes().src).toBe('https://example.com/image.jpg')

  botMessageImage.setImage('file://image.png')
  const wrapper2 = await mount(botMessageImage)
  expect(wrapper2.find('.body img.image').attributes().src).toBe('file://image.png')

  botMessageImage.setImage('imageb64')
  const wrapper3 = await mount(botMessageImage)
  expect(wrapper3.find('.body img.image').attributes().src).toBe('data:image/png;base64,imageb64')
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
  expect(emitEventMock).toHaveBeenCalledWith('set-prompt', userMessage)
})

test('Run assistant text actions', async () => {
  const wrapper = await mount(botMessageText)
  await wrapper.find('.actions .copy').trigger('click')
  expect(window.api.clipboard.writeText).toHaveBeenCalledWith('Hi')
  expect(wrapper.find('.actions .copy').text()).toBe('Copied!')
  // await wait(1500)
  // expect(wrapper.find('.actions .copy').text()).not.toBe('Copied!')
})

test('Run assistant image actions', async () => {
  const wrapper = await mount(botMessageImage)
  await wrapper.find('.actions .copy').trigger('click')
  expect(window.api.clipboard.writeImage).toHaveBeenCalled()
  expect(wrapper.find('.actions .copy').text()).toBe('Copied!')
  // await wait(1500)
  // expect(wrapper.find('.actions .copy').text()).not.toBe('Copied!')

  await wrapper.find('.body .download').trigger('click')
  expect(window.api.file.download).toHaveBeenCalledWith({
    url: 'https://example.com/image.jpg',
    properties: {
      directory: 'downloads',
      prompt: true,
      filename: 'image.png',
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
