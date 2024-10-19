
import { vi, beforeAll, beforeEach, expect, test, afterAll } from 'vitest'
import { enableAutoUnmount, mount } from '@vue/test-utils'
import { store } from '../../src/services/store'
import Main from '../../src/screens/Main.vue'
import Sidebar from '../../src/components/Sidebar.vue'
import ChatArea from '../../src/components/ChatArea.vue'
import Settings from '../../src/screens/Settings.vue'
import defaults from '../../defaults/settings.json'
import * as _Assistant from '../../src/services/assistant'

import useEventBus  from '../../src/composables/event_bus'
const { emitEvent } = useEventBus()

enableAutoUnmount(afterAll)

beforeAll(() => {

  navigator = {
    mediaDevices: {
      getUserMedia: vi.fn()
    }
  }

  window.api = {
    on: vi.fn(),
    listFonts: vi.fn(() => []),
    update: {
      isAvailable: vi.fn(() => false),
    },
    config: {
      load: vi.fn(() => defaults),
      save: vi.fn(),
    },
    store: {
      get: vi.fn(() => null),
    },
    commands: {
      load: vi.fn(() => []),
      isPromptEditable: vi.fn(() => true)
    },
    experts: {
      load: vi.fn(() => []),
    },
    history: {
      load: vi.fn(() => []),
    },
    docrepo: {
      list: vi.fn(() => []),
    },
  }

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
  expect(_Assistant.default.prototype.setChat).toHaveBeenCalledWith(null)
})

test('Attach/Detach file', async () => {
  mount(Main)
  expect(store.pendingAttachment).toBeNull()
  emitEvent('attach-file', 'file')
  expect(store.pendingAttachment).toBe('file')
  emitEvent('detach-file')
  expect(store.pendingAttachment).toBeNull()
})

test('Sends prompt', async () => {
  mount(Main)
  emitEvent('send-prompt', 'prompt')
  expect(_Assistant.default.prototype.initLlm).toHaveBeenCalled()
  expect(_Assistant.default.prototype.prompt).toHaveBeenCalledWith('prompt', { attachment: null, docrepo: null }, expect.any(Function))
})

test('Sends prompt with attachment', async () => {
  mount(Main)
  emitEvent('attach-file', 'file')
  expect(store.pendingAttachment).toBe('file')
  emitEvent('send-prompt', 'prompt')
  expect(_Assistant.default.prototype.initLlm).toHaveBeenCalled()
  expect(_Assistant.default.prototype.prompt).toHaveBeenCalledWith('prompt', { attachment: 'file', docrepo: null }, expect.any(Function))
})

test('Sends prompt with doc repo', async () => {
  mount(Main)
  store.pendingDocRepo = 'docrepo'
  emitEvent('send-prompt', 'prompt')
  expect(_Assistant.default.prototype.initLlm).toHaveBeenCalled()
  expect(_Assistant.default.prototype.prompt).toHaveBeenCalledWith('prompt', { attachment: null, docrepo: 'docrepo' }, expect.any(Function))
})

test('Stop assistant', async () => {
  mount(Main)
  emitEvent('stop-assistant')
  expect(_Assistant.default.prototype.stop).toHaveBeenCalled()
})

