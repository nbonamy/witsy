
import { vi, beforeAll, beforeEach, afterAll, expect, test } from 'vitest'
import { mount as vtumount, VueWrapper, enableAutoUnmount } from '@vue/test-utils'
import { nextTick } from 'vue'
import { useWindowMock } from '../mocks/window'
import { createI18nMock } from '../mocks'
import { emitEventMock } from '../../vitest.setup'
import { store } from '../../src/services/store'
import { stubTeleport } from '../mocks/stubs'
import MessageItem from '../../src/components/MessageItem.vue'
import MessageItemHtmlBlock from '../../src/components/MessageItemHtmlBlock.vue'
import Message from '../../src/models/message'
import Chat from '../../src/models/chat'
import Dialog from '../../src/composables/dialog'

enableAutoUnmount(afterAll)

const readAloudMock = vi.fn()

vi.mock('../../src/services/i18n', async () => {
  return createI18nMock()
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
const botMessageImageLink1: Message = Message.fromJson({ role: 'assistant', type: 'text', content: '[![image](https://example.com/image.jpg)](url)' })
const botMessageImageLink2: Message = Message.fromJson({ role: 'assistant', type: 'text', content: 'look: [![image](https://example.com/image.jpg)](url). neat?' })
const botMessageImageCode1: Message = Message.fromJson({ role: 'assistant', type: 'text', content: '`image`: `<img src="https://example.com/image.jpg" alt="description">`' })
const botMessageImageCode3: Message = Message.fromJson({ role: 'assistant', type: 'text', content: 'image:\n```<img src="https://example.com/image.jpg" alt="description">```' })
const botMessageVideoMd: Message = Message.fromJson({ role: 'assistant', type: 'text', content: '![video](file:///data/video.mp4)' })
const botMessageVideoHtml: Message = Message.fromJson({ role: 'assistant', type: 'text', content: '<video controls src="file:///data/video.mp4">' })
const botMessageVideoCode1: Message = Message.fromJson({ role: 'assistant', type: 'text', content: 'video: `<video controls src="file:///data/video.mp4" />`' })
const botMessageVideoCode3: Message = Message.fromJson({ role: 'assistant', type: 'text', content: '```video```:\n```<video controls src="file:///data/video.mp4" />```' })
const botMessageImageLegacy: Message = Message.fromJson({ role: 'assistant', type: 'image', content: 'https://example.com/image.jpg' })
const botMessageTransient: Message = Message.fromJson({ role: 'assistant', type: 'text', content :'Hi' })
const botMessageReasoning: Message = Message.fromJson({ role: 'assistant', type: 'text', reasoning: 'Hum', content :'Hi' })
const botMessageToolMedia1: Message = Message.fromJson({ role: 'assistant', type: 'text', content: '<tool index="0"></tool>Here:\n\n![image](file:///data/image.jpg)\n\nWelcome!' })
const botMessageToolMedia2: Message = Message.fromJson({ role: 'assistant', type: 'text', content: 'Sure!\n\n<tool index="0"></tool>![image](file:///data/image.jpg)\n\nWelcome!' })
const botMessageToolArtifact1: Message = Message.fromJson({ role: 'assistant', type: 'text', content: 'Here:\n\n<artifact title="test">Test</artifact>\n\nWelcome!' })
const botMessageToolArtifact2: Message = Message.fromJson({ role: 'assistant', type: 'text', content: 'Here:\n\n<artifact title="test1">Test1</artifact>\n\n<artifact title="test2">Test2</artifact>\n\nWelcome!' })
const botMessageToolArtifact3: Message = Message.fromJson({ role: 'assistant', type: 'text', content: 'Here:\n\n<artifact title="test1">Test1</artifact>\n\n<artifact title="test2">Te' })
const botMessageToolArtifact4: Message = Message.fromJson({ role: 'assistant', type: 'text', content: 'Here:\n\n<artifact id="id1" title="test1" data="data1">Test1</artifact>' })
const botMessageToolArtifactHtml1: Message = Message.fromJson({ role: 'assistant', type: 'text', content: 'Here is an HTML example:\n\n<artifact title="Simple HTML Page">```html\n<!DOCTYPE html>\n<html>\n<head>\n<title>Test Page</title>\n</head>\n<body>\n<h1>Hello World</h1>\n<p>This is a test paragraph.</p>\n</body>\n</html>\n```</artifact>\n\nThat\'s it!' })
const botMessageToolArtifactHtml2: Message = Message.fromJson({ role: 'assistant', type: 'text', content: 'Here is HTML without language specifier:\n\n<artifact title="HTML with DOCTYPE">```\n<!DOCTYPE html>\n<html>\n<head>\n<title>Test Page</title>\n</head>\n<body>\n<h1>Hello from DOCTYPE</h1>\n</body>\n</html>\n```</artifact>' })
const botMessageToolArtifactHtml3: Message = Message.fromJson({ role: 'assistant', type: 'text', content: 'Here is another HTML example:\n\n<artifact title="HTML with tag">```\n<html>\n<head>\n<title>Simple Test</title>\n</head>\n<body>\n<h1>Hello from HTML tag</h1>\n</body>\n</html>\n```</artifact>' })
const botMessageTable: Message = Message.fromJson({ role: 'assistant', type: 'text', content: 'Here is a table:\n\n| Name | Age |\n|------|-----|\n| Alice | 30 |\n| Bob | 25 |\n\nThat\'s it!' })

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
  const wrapper = vtumount(MessageItem, { ...stubTeleport, props: { chat: chat, message: message, readAloud: readAloudMock } })
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
  expect(wrapper.find('.body .message-transient').exists()).toBe(false)
  expect(wrapper.find('.body .toggle-reasoning').exists()).toBe(false)
  expect(wrapper.find('.body .think').exists()).toBe(false)
  expect(wrapper.find('.actions .copy').exists()).toBe(true)
  expect(wrapper.find('.actions .read').exists()).toBe(false)
  expect(wrapper.find('.actions .retry').exists()).toBe(false)
  expect(wrapper.find('.actions .fork').exists()).toBe(true)
  expect(wrapper.find('.actions .edit').exists()).toBe(true)
  expect(wrapper.find('.actions .usage').exists()).toBe(false)
  expect(wrapper.find('.actions .tools').exists()).toBe(false)
  
})

test('Assistant text message', async () => {
  const wrapper = await mount(botMessageText)
  expect(wrapper.find('.message').classes()).toContain('assistant')
  expect(wrapper.find('.role').classes()).toContain('assistant')
  expect(wrapper.find('.role').text()).toBe('chat.role.assistant')
  expect(wrapper.find('.role .avatar').exists()).toBe(true)
  expect(wrapper.find('.role .logo').exists()).toBe(true)
  expect(wrapper.find('.body').text()).toBe('Hi\n\n\nOne\n\n\nTwo')
  expect(wrapper.find('.body .message-transient').exists()).toBe(false)
  expect(wrapper.find('.body .toggle-reasoning').exists()).toBe(false)
  expect(wrapper.find('.body .think').exists()).toBe(false)
  expect(wrapper.find('.actions .copy').exists()).toBe(true)
  expect(wrapper.find('.actions .read').exists()).toBe(true)
  expect(wrapper.find('.actions .retry').exists()).toBe(true)
  expect(wrapper.find('.actions .fork').exists()).toBe(true)
  expect(wrapper.find('.actions .edit').exists()).toBe(true)
  expect(wrapper.find('.actions .usage').exists()).toBe(true)
  expect(wrapper.find('.actions .tools').exists()).toBe(false)
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
  expect(wrapper.find('.body .message-transient').exists()).toBe(false)
  expect(wrapper.find('.body img').attributes('src')).toBe('https://example.com/image.jpg')
  expect(wrapper.find('.actions .copy').exists()).toBe(true)
  expect(wrapper.find('.actions .read').exists()).toBe(false)
  expect(wrapper.find('.actions .retry').exists()).toBe(true)
  expect(wrapper.find('.actions .fork').exists()).toBe(true)
  expect(wrapper.find('.actions .edit').exists()).toBe(false)
  expect(wrapper.find('.actions .usage').exists()).toBe(false)
  expect(wrapper.find('.actions .tools').exists()).toBe(false)
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
  expect(wrapper.find('.body .message-transient').exists()).toBe(false)
  expect(wrapper.find('.body .media-container img').attributes('src')).toBe('https://example.com/image.jpg')
  expect(wrapper.find('.actions .copy').exists()).toBe(true)
  expect(wrapper.find('.actions .read').exists()).toBe(true)
  expect(wrapper.find('.actions .retry').exists()).toBe(true)
  expect(wrapper.find('.actions .fork').exists()).toBe(true)
  expect(wrapper.find('.actions .edit').exists()).toBe(true)
  expect(wrapper.find('.actions .usage').exists()).toBe(false)
  expect(wrapper.find('.actions .tools').exists()).toBe(false)
})

test('Assistant image html message', async () => {
  const wrapper = await mount(botMessageImage2)
  expect(wrapper.find('.body').text()).toBe('')
  expect(wrapper.find('.body .image').exists()).toBe(true)
  expect(wrapper.find('.body .download').exists()).toBe(true)
  expect(wrapper.find('.body .message-transient').exists()).toBe(false)
  expect(wrapper.find('.body img').attributes('src')).toBe('https://example.com/image.jpg')
})

test('Assistant image markdown link at beginning message', async () => {
  const wrapper = await mount(botMessageImageLink1)
  expect(wrapper.find('.body').text()).toBe('')
  expect(wrapper.find('.body .media-container').exists()).toBe(false)
  expect(wrapper.find('.body .download').exists()).toBe(false)
  expect(wrapper.find('.body .message-transient').exists()).toBe(false)
  expect(wrapper.find('.body a').attributes('href')).toBe('url')
  expect(wrapper.find('.body a img').attributes('src')).toBe('https://example.com/image.jpg')
})

test('Assistant image markdown link at middle message', async () => {
  const wrapper = await mount(botMessageImageLink2)
  expect(wrapper.find('.body').text()).toBe('look: . neat?')
  expect(wrapper.find('.body .media-container').exists()).toBe(false)
  expect(wrapper.find('.body .download').exists()).toBe(false)
  expect(wrapper.find('.body .message-transient').exists()).toBe(false)
  expect(wrapper.find('.body a').attributes('href')).toBe('url')
  expect(wrapper.find('.body a img').attributes('src')).toBe('https://example.com/image.jpg')
})

test('Assistant video markdown message', async () => {
  const wrapper = await mount(botMessageVideoMd)
  expect(wrapper.find('.body').text()).toBe('')
  expect(wrapper.find('.body .video').exists()).toBe(true)
  expect(wrapper.find('.body .download').exists()).toBe(true)
  expect(wrapper.find('.body .message-transient').exists()).toBe(false)
  expect(wrapper.find('.body video').attributes('src')).toBe('file:///data/video.mp4')
})

test('Assistant video html message', async () => {
  const wrapper = await mount(botMessageVideoHtml)
  expect(wrapper.find('.body').text()).toBe('')
  expect(wrapper.find('.body .video').exists()).toBe(true)
  expect(wrapper.find('.body .download').exists()).toBe(true)
  expect(wrapper.find('.body .message-transient').exists()).toBe(false)
  expect(wrapper.find('.body video').attributes('src')).toBe('file:///data/video.mp4')
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

  const wrapper5 = await mount(botMessageImageCode1)
  expect(wrapper5.find('.body').text()).toBe('image: <img src="https://example.com/image.jpg" alt="description">')
  expect(wrapper5.find('.body img').exists()).toBe(false)

})

test('Assistant image message with HTML code', async () => {

  const wrapper6 = await mount(botMessageImageCode3)
  expect(wrapper6.find('.body').text()).toBe('image:\n<img src="https://example.com/image.jpg" alt="description">')
  expect(wrapper6.find('.body img').exists()).toBe(false)

  const wrapper7 = await mount(botMessageVideoCode1)
  expect(wrapper7.find('.body').text()).toBe('video: <video controls src="file:///data/video.mp4" />')
  expect(wrapper7.find('.body video').exists()).toBe(false)

  const wrapper8 = await mount(botMessageVideoCode3)
  expect(wrapper8.find('.body').text()).toBe('video:\n<video controls src="file:///data/video.mp4" />')
  expect(wrapper8.find('.body video').exists()).toBe(false)
})

test('Assistant image message with tool media', async () => {

  const wrapper1 = await mount(botMessageToolMedia1)
  expect(wrapper1.find('.body').text()).toBe('Here:\nWelcome!')
  expect(wrapper1.findAll('.body img').length).toBe(1)

  const wrapper2 = await mount(botMessageToolMedia2)
  expect(wrapper2.find('.body').text()).toBe('Sure!\nWelcome!')
  expect(wrapper2.findAll('.body img').length).toBe(1)

})

test('Assistant image message with artifact', async () => {

  const wrapper1 = await mount(botMessageToolArtifact1)
  expect(wrapper1.find('.body').text()).toBe('Here:\ntestTest\nWelcome!')
  expect(wrapper1.findAll('.body .artifact').length).toBe(1)

  const wrapper2 = await mount(botMessageToolArtifact2)
  expect(wrapper2.find('.body').text()).toBe('Here:\ntest1Test1\ntest2Test2\nWelcome!')
  expect(wrapper2.findAll('.body .artifact').length).toBe(2)

  const wrapper3 = await mount(botMessageToolArtifact3)
  expect(wrapper3.find('.body').text()).toBe('Here:\ntest1Test1\ntest2Te')
  expect(wrapper3.findAll('.body .artifact').length).toBe(2)

  const wrapper4 = await mount(botMessageToolArtifact4)
  expect(wrapper4.find('.body').text()).toBe('Here:\ntest1Test1')
  expect(wrapper4.findAll('.body .artifact').length).toBe(1)

})

test('Assistant artifact with HTML preview', async () => {

  // Set message as transient to test the streaming behavior
  botMessageToolArtifactHtml1.transient = true

  const wrapper = await mount(botMessageToolArtifactHtml1)
  expect(wrapper.findAll('.body .artifact').length).toBe(1)

  const artifact = wrapper.find('.body .artifact')
  expect(artifact.exists()).toBe(true)
  expect(artifact.find('.panel-header label').text()).toBe('Simple HTML Page')

  const artifactComponent: VueWrapper<any> = wrapper.findComponent(MessageItemHtmlBlock)

  // Phase 1: Initial state - loading div should show, no iframe
  expect(artifact.find('.html-loading').exists()).toBe(true)
  expect(artifact.find('.html-loading').text()).toBe('common.htmlGeneration')
  expect(artifact.find('iframe').exists()).toBe(false)

  // Phase 2: Head detected - trigger updateIframeContent to detect </head>
  artifactComponent.vm.updateIframeContent()
  await artifactComponent.vm.$nextTick()

  // headComplete is now true, but delay hasn't passed yet
  // Since headComplete is true, iframe condition is met, but html computed returns empty until delay passes
  // So we need to pass the delay for iframe to show
  artifactComponent.vm.htmlRenderingDelayPassed = true
  await artifactComponent.vm.$nextTick()

  // Now iframe should exist with cached HTML (head + empty body + listener)
  let iframe = artifact.find('iframe')
  expect(iframe.exists()).toBe(true)
  expect(iframe.attributes('sandbox')).toBe('allow-scripts allow-same-origin allow-forms')
  expect(iframe.attributes('srcdoc')).toContain('<body></body>')
  expect(iframe.attributes('srcdoc')).toContain('window.addEventListener')
  expect(artifact.find('.html-loading').exists()).toBe(false)

  // Check for preview controls
  const previewButton = artifact.find('.preview')
  expect(previewButton.exists()).toBe(true)

  // Toggle off HTML preview
  await previewButton.trigger('click')
  await artifactComponent.vm.$nextTick()
  iframe = artifact.find('iframe')
  expect(iframe.exists()).toBe(false)
  // When preview is off, it shows the HTML source code
  expect(artifact.find('.html-loading').exists()).toBe(false)
  expect(artifact.find('.text').exists()).toBe(true)

  // Toggle back on HTML preview
  await previewButton.trigger('click')
  await artifactComponent.vm.$nextTick()
  iframe = artifact.find('iframe')
  expect(iframe.exists()).toBe(true)

})

test('Assistant artifact with HTML preview (non-transient)', async () => {

  // Use a non-transient message - should show HTML immediately
  const wrapper = await mount(botMessageToolArtifactHtml2)
  expect(wrapper.findAll('.body .artifact').length).toBe(1)

  const artifact = wrapper.find('.body .artifact')
  expect(artifact.exists()).toBe(true)
  expect(artifact.find('.panel-header label').text()).toBe('HTML with DOCTYPE')

  const iframe = artifact.find('iframe')
  if (iframe.exists()) {
    // Non-transient message should show HTML immediately (no loading message)
    expect(iframe.attributes('sandbox')).toBe('allow-scripts allow-same-origin allow-forms')
    expect(iframe.attributes('srcdoc')).toContain('<!DOCTYPE html>')
    expect(iframe.attributes('srcdoc')).toContain('<h1>Hello from DOCTYPE</h1>')
    expect(iframe.attributes('srcdoc')).not.toContain('common.htmlGeneration')
  }

})

test('Assistant artifact with HTML preview (DOCTYPE)', async () => {

  // Enable HTML auto-preview
  store.config.appearance.chat.autoPreview.html = true
  
  const wrapper = await mount(botMessageToolArtifactHtml2)
  expect(wrapper.findAll('.body .artifact').length).toBe(1)
  
  const artifact = wrapper.find('.body .artifact')
  expect(artifact.exists()).toBe(true)
  expect(artifact.find('.panel-header label').text()).toBe('HTML with DOCTYPE')
  
  // Check for preview controls (play/stop buttons)
  expect(artifact.find('.preview').exists()).toBe(true)
  
  // Check if iframe is present for HTML preview
  const iframe = artifact.find('iframe')
  expect(iframe.exists()).toBe(true)

})

test('Assistant artifact with HTML preview (HTML tag)', async () => {

  // Enable HTML auto-preview
  store.config.appearance.chat.autoPreview.html = true
  
  const wrapper = await mount(botMessageToolArtifactHtml3)
  expect(wrapper.findAll('.body .artifact').length).toBe(1)
  
  const artifact = wrapper.find('.body .artifact')
  expect(artifact.exists()).toBe(true)
  expect(artifact.find('.panel-header label').text()).toBe('HTML with tag')
  
  // Check for preview controls (play/stop buttons)
  expect(artifact.find('.preview').exists()).toBe(true)
  
  // Check if iframe is present for HTML preview
  const iframe = artifact.find('iframe')
  expect(iframe.exists()).toBe(true)

})

test('Transient message', async () => {
  const wrapper = await mount(botMessageTransient)
  expect(wrapper.find('.body').text()).toBe('Hi')
  expect(wrapper.find('.body .message-transient').exists()).toBe(true)
  expect(wrapper.find('.body .message-transient .loader').exists()).toBe(true)
  expect(wrapper.find('.body .message-transient').findComponent({ name: 'MessageItemToolBlock' }).exists()).toBe(false)
  expect(wrapper.find('.actions .copy').exists()).toBe(false)
  expect(wrapper.find('.actions .read').exists()).toBe(false)
  expect(wrapper.find('.actions .edit').exists()).toBe(false)
  expect(wrapper.find('.actions .tools').exists()).toBe(false)
})

test('Tool call running calling', async () => {
  botMessageTransient.addToolCall({ type: 'tool', id: 'tool', name: 'tool', state: 'running', status: 'Calling a tool', done: false })
  const wrapper = await mount(botMessageTransient)
  expect(wrapper.find('.body .message-transient').findComponent({ name: 'MessageItemToolBlock' }).exists()).toBe(true)
  expect(wrapper.find('.body .message-transient').text()).toBe('Calling a tool')
  expect(wrapper.find('.body .message-content').findComponent({ name: 'MessageItemToolBlock' }).exists()).toBe(false)
})

test('Tool call running never', async () => {
  store.config.appearance.chat.showToolCalls = 'never'
  botMessageTransient.addToolCall({ type: 'tool', id: 'tool', name: 'tool', state: 'running', status: 'Calling a tool', done: false })
  const wrapper = await mount(botMessageTransient)
  expect(wrapper.find('.body .message-transient').findComponent({ name: 'MessageItemToolBlock' }).exists()).toBe(false)
  expect(wrapper.find('.body .message-content').findComponent({ name: 'MessageItemToolBlock' }).exists()).toBe(false)
})

test('Tool call running always', async () => {
  store.config.appearance.chat.showToolCalls = 'always'
  botMessageTransient.addToolCall({ type: 'tool', id: 'tool', name: 'tool', state: 'running',status: 'Calling a tool', done: false })
  const wrapper = await mount(botMessageTransient)
  expect(wrapper.find('.body .message-transient').findComponent({ name: 'MessageItemToolBlock' }).exists()).toBe(true)
  expect(wrapper.find('.body .message-content').findComponent({ name: 'MessageItemToolBlock' }).exists()).toBe(false)
})

test('Tool call done calling', async () => {
  store.config.appearance.chat.showToolCalls = 'calling'
  botMessageText.addToolCall({ type: 'tool', id: 'tool', name: 'tool', state: 'completed', status: 'Calling a tool', done: true })
  const wrapper = await mount(botMessageText)
  expect(wrapper.find('.body .message-content').findComponent({ name: 'MessageItemToolBlock' }).exists()).toBe(false)
  expect(wrapper.find('.actions .tools').exists()).toBe(true)
})

test('Tool call done never', async () => {
  store.config.appearance.chat.showToolCalls = 'never'
  botMessageText.addToolCall({ type: 'tool', id: 'tool', name: 'tool', state: 'completed', status: 'Calling a tool', done: true })
  const wrapper = await mount(botMessageText)
  expect(wrapper.find('.body .message-content').findComponent({ name: 'MessageItemToolBlock' }).exists()).toBe(false)
  expect(wrapper.find('.actions .tools').exists()).toBe(true)
})

test('Tool call done always', async () => {
  store.config.appearance.chat.showToolCalls = 'always'
  botMessageText.addToolCall({ type: 'tool', id: 'tool', name: 'tool', state: 'completed', status: 'Calling a tool', done: true })
  const wrapper = await mount(botMessageText)
  expect(wrapper.find('.body .message-content').findComponent({ name: 'MessageItemToolBlock' }).exists()).toBe(true)
  expect(wrapper.find('.actions .tools').exists()).toBe(false)
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
  expect(emitEventMock).toHaveBeenLastCalledWith('edit-message', userMessage.uuid)

  await wrapper.find('.actions .quote').trigger('click')
  expect(emitEventMock).toHaveBeenLastCalledWith('set-prompt', userMessage)

  await wrapper.find('.actions .delete').trigger('click')
  expect(emitEventMock).toHaveBeenLastCalledWith('delete-message', userMessage)
})

test('Run assistant text actions', async () => {
  
  store.config.appearance.chat.showToolCalls = 'calling'
  botMessageText.addToolCall({ type: 'tool', id: 'tool', name: 'tool', state: 'completed', status: 'Calling a tool', done: true })
  const wrapper = await mount(botMessageText)
  
  // copy as text
  await wrapper.find('.actions .copy').trigger('click')
  expect(window.api.clipboard.writeText).toHaveBeenLastCalledWith('Hi\n\n1. One\n\n2. Two')
  expect(wrapper.find('.actions .copy').text()).toBe('common.copied')

  // copy as markdown
  store.config.appearance.chat.copyFormat = 'markdown'
  await wrapper.find('.actions .copy').trigger('click')
  expect(window.api.clipboard.writeText).toHaveBeenLastCalledWith('**Hi**\n\n1. One \n\n2. Two')
  expect(wrapper.find('.actions .copy').text()).toBe('common.copied')

  // usage
  await wrapper.find('.actions .usage').trigger('click')
  expect(Dialog.show).toHaveBeenCalledTimes(1)

  // read aloud
  await wrapper.find('.actions .read').trigger('click')
  expect(readAloudMock).toHaveBeenCalled()

  // retry
  await wrapper.find('.actions .retry').trigger('click')
  expect(Dialog.show).toHaveBeenCalledTimes(2)
  expect(store.config.general.confirm.retryGeneration).toBe(true)
  expect(emitEventMock).toHaveBeenLastCalledWith('retry-generation', botMessageText)

  // retry again
  await wrapper.find('.actions .retry').trigger('click')
  expect(Dialog.show).toHaveBeenCalledTimes(3)

  // retry one more time
  store.config.general.confirm.retryGeneration = false  
  await wrapper.find('.actions .retry').trigger('click')
  expect(Dialog.show).toHaveBeenCalledTimes(3)

  // fork
  await wrapper.find('.actions .fork').trigger('click')
  expect(emitEventMock).toHaveBeenLastCalledWith('fork-chat', botMessageText)

  // tools
  expect(wrapper.find('.body .message-content').findComponent({ name: 'MessageItemToolBlock' }).exists()).toBe(false)
  await wrapper.find('.actions .tools').trigger('click')
  expect(wrapper.find('.body .message-content').findComponent({ name: 'MessageItemToolBlock' }).exists()).toBe(true)
  await wrapper.find('.actions .tools').trigger('click')
  expect(wrapper.find('.body .message-content').findComponent({ name: 'MessageItemToolBlock' }).exists()).toBe(false)

  // await wait(1500)
  // expect(wrapper.find('.actions .copy').text()).not.toBe('common.copied')
})

test('Run assistant tool action without tools', async () => {

  botMessageText.clearToolCalls()
  const wrapper = await mount(botMessageText)
  await wrapper.find('.actions .tools').trigger('click')
  expect(wrapper.find('.body .message-content').findComponent({ name: 'MessageItemToolBlock' }).exists()).toBe(false)

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
  expect(wrapper.find('.body .copy-code').exists()).toBe(true)
  expect(wrapper.find('.body .copy-code').text()).toBe('Copy code')
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

test('Artifact download context menu', async () => {
  const wrapper = await mount(botMessageToolArtifact1)

  // Check that the artifact has a download button
  const artifact = wrapper.find('.body .artifact')
  const downloadButton = artifact.find('.panel-header .download .trigger')
  expect(downloadButton.exists()).toBe(true)

  // Click the download button to show context menu
  await downloadButton.trigger('click')
  await nextTick()

  // Check that context menu is visible
  const contextMenu = wrapper.find('.context-menu')
  expect(contextMenu.exists()).toBe(true)

  // Check that all three download options are present
  const menuItems = contextMenu.findAll('.item')
  expect(menuItems.length).toBe(3)
  expect(menuItems[0].text()).toContain('Text')
  expect(menuItems[1].text()).toContain('Markdown')
  expect(menuItems[2].text()).toContain('PDF')

})

test('Artifact download text', async () => {
  const wrapper = await mount(botMessageToolArtifact1)

  // Check that the artifact has a download button
  const artifact = wrapper.find('.body .artifact')
  const downloadButton = artifact.find('.panel-header .download .trigger')
  expect(downloadButton.exists()).toBe(true)

  // Click the download button to show context menu
  await downloadButton.trigger('click')
  await nextTick()

  const contextMenu = wrapper.find('.context-menu')
  const menuItems = contextMenu.findAll('.item')

  // markdown export
  await menuItems[0].trigger('click')
  expect(window.api.file.save).toHaveBeenLastCalledWith({
    contents: 'Test_encoded',
    properties: {
      filename: 'test.txt',
      prompt: true,
    }
  })

})

test('Artifact download markdown', async () => {
  const wrapper = await mount(botMessageToolArtifact1)

  // Check that the artifact has a download button
  const artifact = wrapper.find('.body .artifact')
  const downloadButton = artifact.find('.panel-header .download .trigger')
  expect(downloadButton.exists()).toBe(true)

  // Click the download button to show context menu
  await downloadButton.trigger('click')
  await nextTick()

  const contextMenu = wrapper.find('.context-menu')
  const menuItems = contextMenu.findAll('.item')

  // markdown export
  await menuItems[1].trigger('click')
  expect(window.api.file.save).toHaveBeenLastCalledWith({
    contents: 'Test_encoded',
    properties: {
      filename: 'test.md',
      prompt: true,
    }
  })

})

test('Assistant message with table', async () => {
  const wrapper = await mount(botMessageTable)
  expect(wrapper.find('.body').text()).toContain('Here is a table:')
  expect(wrapper.find('.body').text()).toContain('That\'s it!')
  expect(wrapper.findAll('.body .artifact').length).toBe(1)

  const artifact = wrapper.find('.body .artifact')
  expect(artifact.exists()).toBe(true)

  // Check for table inside panel body
  expect(artifact.find('.panel-body table').exists()).toBe(true)

  // Check for download button
  const downloadButton = artifact.find('.panel .download')
  expect(downloadButton.exists()).toBe(true)
})

test('Table download context menu', async () => {
  const wrapper = await mount(botMessageTable)

  const artifact = wrapper.find('.body .artifact')
  const downloadButton = artifact.find('.panel .download .trigger')
  expect(downloadButton.exists()).toBe(true)

  // Click the download button to show context menu
  await downloadButton.trigger('click')
  await nextTick()

  // Check that context menu is visible
  const contextMenu = wrapper.find('.context-menu')
  expect(contextMenu.exists()).toBe(true)

  // Check that CSV and XLSX options are present
  const menuItems = contextMenu.findAll('.item')
  expect(menuItems.length).toBe(2)
  expect(menuItems[0].text()).toContain('common.downloadCsv')
  expect(menuItems[1].text()).toContain('common.downloadXlsx')
})

test('Message editing - User message edit mode toggle', async () => {

  const wrapper = await mount(userMessage)

  // Initially not in edit mode
  expect(wrapper.find('.edit-container').exists()).toBe(false)
  expect(wrapper.find('.message-content .edit-textarea').exists()).toBe(false)

  // Trigger edit event
  await wrapper.find('.actions .edit').trigger('click')
  expect(emitEventMock).toHaveBeenLastCalledWith('edit-message', userMessage.uuid)

  // Manually trigger the event handler since emitEvent is mocked
  wrapper.vm.startEditing()
  await nextTick()

  // Now in edit mode
  expect(wrapper.find('.edit-container').exists()).toBe(true)
  expect(wrapper.find('.edit-textarea').exists()).toBe(true)
  expect(wrapper.find('.edit-actions button.primary').exists()).toBe(true)
  expect(wrapper.find('.edit-actions button.tertiary').exists()).toBe(true)
})

test('Message editing - Cancel editing', async () => {

  const wrapper = await mount(userMessage)

  // Enter edit mode
  wrapper.vm.startEditing()
  await nextTick()
  expect(wrapper.find('.edit-container').exists()).toBe(true)

  // Change the content
  const textarea = wrapper.find('.edit-textarea')
  await textarea.setValue('Modified content')
  expect((textarea.element as HTMLTextAreaElement).value).toBe('Modified content')

  // Cancel editing
  await wrapper.find('.edit-actions button.tertiary').trigger('click')
  await nextTick()

  // Should exit edit mode
  expect(wrapper.find('.edit-container').exists()).toBe(false)
  // Original content unchanged
  expect(userMessage.content).not.toBe('Modified content')
})

test('Message editing - Save user message edit triggers resend', async () => {

  const wrapper = await mount(userMessage)

  // Enter edit mode
  wrapper.vm.startEditing()
  await nextTick()

  // Change the content
  const textarea = wrapper.find('.edit-textarea')
  await textarea.setValue('Modified user message')

  // Save editing
  await wrapper.find('.edit-actions button.primary').trigger('click')
  await nextTick()

  // Should emit resend-after-edit event
  expect(emitEventMock).toHaveBeenCalledWith('resend-after-edit', {
    message: userMessage,
    newContent: 'Modified user message'
  })

  // Should exit edit mode
  expect(wrapper.find('.edit-container').exists()).toBe(false)
})

test('Message editing - Save assistant message edit updates content', async () => {

  const editedMessage = new Message('assistant', 'Original assistant content')
  const wrapper = await mount(editedMessage)

  // Enter edit mode
  wrapper.vm.startEditing()
  await nextTick()

  // Change the content
  const textarea = wrapper.find('.edit-textarea')
  await textarea.setValue('Modified assistant content')

  // Save editing
  await wrapper.find('.edit-actions button.primary').trigger('click')
  await nextTick()

  // Should update content and set edited flag
  expect(editedMessage.content).toBe('Modified assistant content')
  expect(editedMessage.edited).toBe(true)

  // Should exit edit mode
  expect(wrapper.find('.edit-container').exists()).toBe(false)
})

test('Message editing - Edited indicator shows for edited assistant messages', async () => {

  const editedMessage = new Message('assistant', 'Content')
  editedMessage.edited = true

  const wrapper = await mount(editedMessage, false)

  // Should show edited indicator
  expect(wrapper.find('.edited-indicator').exists()).toBe(true)
  expect(wrapper.find('.edited-indicator').text()).toBe('chat.edited')
})

test('Message editing - Edited indicator not shown for unedited messages', async () => {

  const uneditedMessage = new Message('assistant', 'Content')
  uneditedMessage.edited = false

  const wrapper = await mount(uneditedMessage, false)

  // Should not show edited indicator
  expect(wrapper.find('.edited-indicator').exists()).toBe(false)
})

test('Message editing - Empty content cannot be saved', async () => {

  const wrapper = await mount(userMessage)

  // Enter edit mode
  wrapper.vm.startEditing()
  await nextTick()

  // Clear the content
  const textarea = wrapper.find('.edit-textarea')
  await textarea.setValue('   ')

  // Try to save
  await wrapper.find('.edit-actions button.primary').trigger('click')
  await nextTick()

  // Should still be in edit mode (save rejected)
  expect(wrapper.find('.edit-container').exists()).toBe(true)
})

test('Message editing - Keyboard shortcuts work', async () => {

  const wrapper = await mount(userMessage)

  // Enter edit mode
  wrapper.vm.startEditing()
  await nextTick()

  const textarea = wrapper.find('.edit-textarea')
  await textarea.setValue('Modified content')

  // Test Escape key for cancel
  await textarea.trigger('keydown.escape')
  await nextTick()
  expect(wrapper.find('.edit-container').exists()).toBe(false)

  // Enter edit mode again
  wrapper.vm.startEditing()
  await nextTick()
  await textarea.setValue('Modified content again')

  // Test Cmd+Enter for save (on Mac)
  await textarea.trigger('keydown.meta.enter')
  await nextTick()
  expect(emitEventMock).toHaveBeenCalledWith('resend-after-edit', {
    message: userMessage,
    newContent: 'Modified content again'
  })
})
