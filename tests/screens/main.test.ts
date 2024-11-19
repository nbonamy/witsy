
import { vi, beforeAll, beforeEach, expect, test, afterAll } from 'vitest'
import { enableAutoUnmount, mount } from '@vue/test-utils'
import { useWindowMock, useNavigatorMock } from '../mocks/window'
import Attachment from '../../src/models/attachment'
import Main from '../../src/screens/Main.vue'
import Sidebar from '../../src/components/Sidebar.vue'
import ChatArea from '../../src/components/ChatArea.vue'
import Settings from '../../src/screens/Settings.vue'
import Assistant from '../../src/services/assistant'

import useEventBus  from '../../src/composables/event_bus'
const { emitEvent } = useEventBus()

enableAutoUnmount(afterAll)

beforeAll(() => {
  useNavigatorMock()
  useWindowMock()
})

vi.mock('../../src/services/assistant', async () => {
  const Assistant = vi.fn()
  Assistant.prototype.setConfig = vi.fn()
  Assistant.prototype.setChat = vi.fn()
  Assistant.prototype.initLlm = vi.fn()
  Assistant.prototype.hasLlm = vi.fn(() => true)
  Assistant.prototype.prompt = vi.fn()
  Assistant.prototype.stop = vi.fn()
  return { default: Assistant }
})

beforeEach(() => {
  vi.clearAllMocks()
})

test('Renders correctly', () => {
  const wrapper = mount(Main)
  expect(wrapper.exists()).toBe(true)
  expect(wrapper.find('.main').exists()).toBe(true)
  expect(wrapper.findComponent(Sidebar).exists()).toBe(true)
  expect(wrapper.findComponent(ChatArea).exists()).toBe(true)
  expect(wrapper.findComponent(Settings).exists()).toBe(true)
})

test('Resets assistant', async () => {
  mount(Main)
  emitEvent('new-chat')
  expect(Assistant.prototype.setChat).toHaveBeenCalledWith(null)
})

test('Saves text attachment', async () => {
  mount(Main)
  const attachment = new Attachment('text', 'text/plain', 'file://text', false)
  emitEvent('send-prompt', { prompt: 'prompt', attachment })
  expect(window.api.file.save).toHaveBeenCalledWith({ contents: 'text_decoded_encoded', properties: expect.any(Object) })
  expect(attachment.url).toBe('file_url')
  expect(attachment.saved).toBe(true)
})

test('Saves pdf attachment', async () => {
  mount(Main)
  const attachment = new Attachment('pdf', 'text/pdf', 'file://pdf', false)
  emitEvent('send-prompt', { prompt: 'prompt', attachment })
  expect(window.api.file.save).toHaveBeenCalledWith({ contents: 'pdf_extracted_encoded', properties: expect.any(Object) })
  expect(attachment.url).toBe('file_url')
  expect(attachment.saved).toBe(true)
})

test('Saves image attachment', async () => {
  mount(Main)
  const attachment = new Attachment('image', 'image/png', 'file://image', false)
  emitEvent('send-prompt', { prompt: 'prompt', attachment })
  expect(window.api.file.save).toHaveBeenCalledWith({ contents: 'image', properties: expect.any(Object) })
  expect(attachment.url).toBe('file_url')
  expect(attachment.saved).toBe(true)
})

test('Does not save twice', async () => {
  mount(Main)
  const attachment = new Attachment('text', 'text/plain', 'file://text', true)
  emitEvent('send-prompt', { prompt: 'prompt', attachment })
  expect(window.api.file.save).not.toHaveBeenCalled()
  expect(attachment.url).toBe('file://text')
  expect(attachment.saved).toBe(true)
})

test('Sends prompt', async () => {
  mount(Main)
  emitEvent('send-prompt', { prompt: 'prompt' })
  expect(Assistant.prototype.initLlm).toHaveBeenCalled()
  expect(Assistant.prototype.prompt).toHaveBeenCalledWith('prompt', { attachment: null, docrepo: null, expert: null }, expect.any(Function))
})

test('Sends prompt with attachment', async () => {
  mount(Main)
  emitEvent('send-prompt', { prompt: 'prompt', attachment: 'file' })
  expect(Assistant.prototype.initLlm).toHaveBeenCalled()
  expect(Assistant.prototype.prompt).toHaveBeenCalledWith('prompt', { attachment: 'file', docrepo: null, expert: null }, expect.any(Function))
})

test('Sends prompt with doc repo', async () => {
  mount(Main)
  emitEvent('send-prompt', { prompt: 'prompt', docrepo: 'docrepo' })
  expect(Assistant.prototype.initLlm).toHaveBeenCalled()
  expect(Assistant.prototype.prompt).toHaveBeenCalledWith('prompt', { attachment: null, docrepo: 'docrepo', expert: null }, expect.any(Function))
})

test('Sends prompt with expert', async () => {
  mount(Main)
  emitEvent('send-prompt', { prompt: 'prompt', expert: { id: 'expert', prompt: 'system' } })
  expect(Assistant.prototype.initLlm).toHaveBeenCalled()
  expect(Assistant.prototype.prompt).toHaveBeenCalledWith('prompt', { attachment: null, docrepo: null, expert: 'expert', systemInstructions: 'system' }, expect.any(Function))
})

test('Stop assistant', async () => {
  mount(Main)
  emitEvent('stop-prompting')
  expect(Assistant.prototype.stop).toHaveBeenCalled()
})
