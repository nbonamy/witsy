
import { enableAutoUnmount, mount, VueWrapper } from '@vue/test-utils'
import { defaultCapabilities } from 'multi-llm-ts'
import { afterEach, beforeAll, beforeEach, expect, test, vi } from 'vitest'
import DesignStudio from '../../src/renderer/screens/DesignStudio.vue'
import { store } from '../../src/renderer/services/store'
import Message from '../../src/models/message'
import Attachment from '../../src/models/attachment'
import LlmMock from '../mocks/llm'
import { useBrowserMock, useWindowMock } from '../mocks/window'
import { stubTeleport } from '../mocks/stubs'
import Dialog from '../../src/renderer/utils/dialog'

vi.mock('../../src/renderer/services/llms/manager.ts', async () => {
  const LlmManager = vi.fn()
  LlmManager.prototype.initModels = vi.fn()
  LlmManager.prototype.isEngineReady = vi.fn(() => true)
  LlmManager.prototype.isEngineConfigured = vi.fn(() => true)
  LlmManager.prototype.getEngineName = () => 'mock'
  LlmManager.prototype.getChatModels = vi.fn(() => [{ id: 'chat', name: 'chat', ...defaultCapabilities }])
  LlmManager.prototype.getChatModel = vi.fn(() => ({ id: 'chat', name: 'chat', ...defaultCapabilities }))
  LlmManager.prototype.igniteEngine = vi.fn(() => new LlmMock(store.config.engines.mock))
  LlmManager.prototype.checkModelsCapabilities = vi.fn()
  return { default: LlmManager }
})

vi.mock('../../src/renderer/utils/dialog', () => ({
  default: {
    show: vi.fn(),
    alert: vi.fn()
  }
}))

enableAutoUnmount(afterEach)

beforeAll(async () => {
  useWindowMock({ modelDefaults: true })
  useBrowserMock()
  store.loadSettings()
  store.loadHistory()
})

beforeEach(() => {
  vi.clearAllMocks()
})

test('Renders correctly', () => {
  const wrapper: VueWrapper<any> = mount(DesignStudio, { ...stubTeleport })
  expect(wrapper.exists()).toBe(true)
  expect(wrapper.find('.studio').exists()).toBe(true)
})

test('currentMediaUrl returns null when no selection', () => {
  const wrapper: VueWrapper<any> = mount(DesignStudio, { ...stubTeleport })
  expect(wrapper.vm.currentMedia).toBeNull()
  expect(wrapper.vm.currentMediaUrl).toBeNull()
})

test('currentMediaUrl returns URL for selected image', () => {
  const wrapper: VueWrapper<any> = mount(DesignStudio, { ...stubTeleport })

  // Create a message with an image attachment
  const message = new Message('user', 'test image')
  const attachment = new Attachment('base64content', 'image/png', 'test.png')
  message.attachments = [attachment]

  // Select the message
  wrapper.vm.selection = [message]

  // Should return the attachment URL
  expect(wrapper.vm.currentMediaUrl).toBe('test.png')
})

test('currentMediaUrl returns null for non-image attachments', () => {
  const wrapper: VueWrapper<any> = mount(DesignStudio, { ...stubTeleport })

  // Create a message with a non-image attachment
  const message = new Message('user', 'test doc')
  const attachment = new Attachment('base64content', 'application/pdf', 'test.pdf')
  message.attachments = [attachment]

  // Select the message
  wrapper.vm.selection = [message]

  // Should return null (not an image)
  expect(wrapper.vm.currentMediaUrl).toBeNull()
})

test('onSelectAll selects all history items', async () => {
  const wrapper: VueWrapper<any> = mount(DesignStudio, { ...stubTeleport })

  // Add some messages to history with attachments
  const msg1 = new Message('user', 'image 1')
  msg1.attachments = [new Attachment('content', 'image/png', 'test1.png')]
  const msg2 = new Message('user', 'image 2')
  msg2.attachments = [new Attachment('content', 'image/png', 'test2.png')]
  const msg3 = new Message('user', 'image 3')
  msg3.attachments = [new Attachment('content', 'image/png', 'test3.png')]
  wrapper.vm.chat.messages = [msg1, msg2, msg3]

  await wrapper.vm.$nextTick()

  // Call onSelectAll
  wrapper.vm.onSelectAll()

  // Should select all messages and switch to history mode
  expect(wrapper.vm.selection).toHaveLength(3)
  expect(wrapper.vm.mode).toBe('history')
})

test('onReset clears selection and stacks', () => {
  const wrapper: VueWrapper<any> = mount(DesignStudio, { ...stubTeleport })

  // Set up some state
  const msg = new Message('user', 'test')
  wrapper.vm.selection = [msg]
  wrapper.vm.undoStack = [msg]
  wrapper.vm.redoStack = [msg]
  wrapper.vm.mode = 'history'

  // Mock the settings.reset method
  wrapper.vm.settings = { reset: vi.fn() }

  // Call onReset
  wrapper.vm.onReset()

  // Should clear everything
  expect(wrapper.vm.selection).toHaveLength(0)
  expect(wrapper.vm.undoStack).toHaveLength(0)
  expect(wrapper.vm.redoStack).toHaveLength(0)
  expect(wrapper.vm.mode).toBe('create')
  expect(wrapper.vm.settings.reset).toHaveBeenCalled()
})

test('selectMessage with ctrl/cmd key toggles selection', () => {
  const wrapper: VueWrapper<any> = mount(DesignStudio, { ...stubTeleport })

  const msg1 = new Message('user', 'image 1')
  msg1.attachments = [new Attachment('content', 'image/png', 'test1.png')]
  const msg2 = new Message('user', 'image 2')
  msg2.attachments = [new Attachment('content', 'image/png', 'test2.png')]

  // Select first message
  wrapper.vm.selection = [msg1]

  // Click second message with ctrl key
  const event = new MouseEvent('click', { ctrlKey: true })
  wrapper.vm.selectMessage({ event, message: msg2 })

  // Should add to selection
  expect(wrapper.vm.selection).toHaveLength(2)
  expect(wrapper.vm.selection[0].uuid).toBe(msg1.uuid)
  expect(wrapper.vm.selection[1].uuid).toBe(msg2.uuid)
})

test('selectMessage with ctrl key deselects if already selected', () => {
  const wrapper: VueWrapper<any> = mount(DesignStudio, { ...stubTeleport })

  const msg1 = new Message('user', 'image 1')
  msg1.attachments = [new Attachment('content', 'image/png', 'test1.png')]
  const msg2 = new Message('user', 'image 2')
  msg2.attachments = [new Attachment('content', 'image/png', 'test2.png')]

  // Select both messages
  wrapper.vm.selection = [msg1, msg2]

  // Click first message with ctrl key
  const event = new MouseEvent('click', { ctrlKey: true })
  wrapper.vm.selectMessage({ event, message: msg1 })

  // Should remove from selection
  expect(wrapper.vm.selection).toHaveLength(1)
  expect(wrapper.vm.selection[0].uuid).toBe(msg2.uuid)
})

test('renameMedia shows dialog and updates message', async () => {
  const wrapper: VueWrapper<any> = mount(DesignStudio, { ...stubTeleport })

  const message = new Message('user', 'old name')

  // Mock Dialog.show to return new name
  vi.mocked(Dialog.show).mockResolvedValue({
    isConfirmed: true,
    isDenied: false,
    isDismissed: false,
    value: 'new name'
  })

  // Call renameMedia
  await wrapper.vm.renameMedia(message)

  // Should show dialog
  expect(Dialog.show).toHaveBeenCalledWith(expect.objectContaining({
    title: expect.any(String),
    input: 'text',
    inputValue: 'old name',
    showCancelButton: true
  }))

  // Should update message
  expect(message.content).toBe('new name')
})

test('renameMedia does not update when cancelled', async () => {
  const wrapper: VueWrapper<any> = mount(DesignStudio, { ...stubTeleport })

  const message = new Message('user', 'old name')

  // Mock Dialog.show to return cancelled
  vi.mocked(Dialog.show).mockResolvedValue({
    isConfirmed: false,
    isDenied: false,
    isDismissed: true,
    value: 'new name'
  })

  // Call renameMedia
  await wrapper.vm.renameMedia(message)

  // Should NOT update message
  expect(message.content).toBe('old name')
})

test('onKeyDown with Escape switches to create mode', () => {
  const wrapper: VueWrapper<any> = mount(DesignStudio, { ...stubTeleport })

  wrapper.vm.mode = 'history'

  const event = new KeyboardEvent('keydown', { key: 'Escape' })
  wrapper.vm.onKeyDown(event)

  expect(wrapper.vm.mode).toBe('create')
})

test('onKeyDown with cmd+a selects all', async () => {
  const wrapper: VueWrapper<any> = mount(DesignStudio, { ...stubTeleport })

  // Add messages to history with attachments
  const msg1 = new Message('user', 'image 1')
  msg1.attachments = [new Attachment('content', 'image/png', 'test1.png')]
  const msg2 = new Message('user', 'image 2')
  msg2.attachments = [new Attachment('content', 'image/png', 'test2.png')]
  wrapper.vm.chat.messages = [msg1, msg2]

  await wrapper.vm.$nextTick()

  const event = new KeyboardEvent('keydown', { key: 'a', metaKey: true })
  Object.defineProperty(event, 'preventDefault', { value: vi.fn() })

  wrapper.vm.onKeyDown(event)

  expect(wrapper.vm.selection).toHaveLength(2)
  expect(wrapper.vm.mode).toBe('history')
})

test('onKeyDown with ArrowDown navigates in history mode', async () => {
  const wrapper: VueWrapper<any> = mount(DesignStudio, { ...stubTeleport })

  // Set up history with attachments
  const msg1 = new Message('user', 'image 1')
  msg1.attachments = [new Attachment('content', 'image/png', 'test1.png')]
  const msg2 = new Message('user', 'image 2')
  msg2.attachments = [new Attachment('content', 'image/png', 'test2.png')]
  wrapper.vm.chat.messages = [msg1, msg2]
  wrapper.vm.mode = 'history'
  wrapper.vm.selection = [wrapper.vm.history[0]] // Select first in reversed history

  await wrapper.vm.$nextTick()

  const event = new KeyboardEvent('keydown', { key: 'ArrowDown' })
  wrapper.vm.onKeyDown(event)

  // Should navigate to next
  expect(wrapper.vm.selection).toHaveLength(1)
})
