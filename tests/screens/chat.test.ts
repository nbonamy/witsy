
import { enableAutoUnmount, mount, VueWrapper } from '@vue/test-utils'
import { defaultCapabilities } from 'multi-llm-ts'
import { afterEach, beforeAll, beforeEach, expect, test, vi } from 'vitest'
import Chat from '../../src/renderer/screens/Chat.vue'
import { store } from '../../src/renderer/services/store'
import LlmMock from '../mocks/llm'
import { useBrowserMock, useWindowMock } from '../mocks/window'
import { stubTeleport } from '../mocks/stubs'

vi.mock('../../src/renderer/services/llms/manager.ts', async () => {
  const LlmManager = vi.fn()
  LlmManager.prototype.initModels = vi.fn()
  LlmManager.prototype.isEngineReady = vi.fn(() => true)
  LlmManager.prototype.isEngineConfigured = vi.fn(() => true)
  LlmManager.prototype.getEngineName = () => 'mock'
  LlmManager.prototype.getCustomEngines = () => []
  LlmManager.prototype.getFavoriteId = () => 'favid'
  LlmManager.prototype.isFavoriteModel = vi.fn(() => false)
  LlmManager.prototype.getChatModels = vi.fn(() => [{ id: 'chat', name: 'chat', ...defaultCapabilities }])
  LlmManager.prototype.getChatModel = vi.fn(() => ({ id: 'chat', name: 'chat', ...defaultCapabilities }))
  LlmManager.prototype.getChatEngineModel = () => ({ engine: 'mock', model: 'chat' })
  LlmManager.prototype.getChatEngines = vi.fn(() => ['mock'])
  LlmManager.prototype.hasChatModels = vi.fn(() => true)
  LlmManager.prototype.isFavoriteEngine = vi.fn(() => false)
  LlmManager.prototype.isCustomEngine = vi.fn(() => false)
  LlmManager.prototype.igniteEngine = vi.fn(() => new LlmMock(store.config.engines.mock))
  LlmManager.prototype.checkModelsCapabilities = vi.fn()
  LlmManager.prototype.loadTools = vi.fn()
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
  const wrapper: VueWrapper<any> = mount(Chat, { ...stubTeleport })
  expect(wrapper.exists()).toBe(true)
  expect(wrapper.find('.chat').exists()).toBe(true)
})

test('Registers window API event listeners', async () => {
  const wrapper: VueWrapper<any> = mount(Chat, { ...stubTeleport })
  await wrapper.vm.$nextTick()

  // Verify event listeners were registered
  expect(window.api.on).toHaveBeenCalledWith('new-chat', expect.any(Function))
  expect(window.api.on).toHaveBeenCalledWith('delete-chat', expect.any(Function))
  expect(window.api.on).toHaveBeenCalledWith('computer-stop', expect.any(Function))
  expect(window.api.on).toHaveBeenCalledWith('update-available', expect.any(Function))
})

test('Intercepts #settings link clicks', async () => {
  const wrapper: VueWrapper<any> = mount(Chat, { ...stubTeleport })
  await wrapper.vm.$nextTick()

  // Create a fake link element
  const link = document.createElement('a')
  link.setAttribute('href', '#settings_models_openai')
  document.body.appendChild(link)

  // Create and dispatch click event
  const clickEvent = new MouseEvent('click', {
    bubbles: true,
    cancelable: true
  })
  Object.defineProperty(clickEvent, 'target', { value: link, enumerable: true })

  link.dispatchEvent(clickEvent)
  await wrapper.vm.$nextTick()

  // Should have called window.api.settings.open
  expect(window.api.settings.open).toHaveBeenCalledWith({
    initialTab: 'models',
    engine: 'openai'
  })

  // Clean up
  document.body.removeChild(link)
})

test('Intercepts #retry_without_plugins link and disables tools', async () => {
  const wrapper: VueWrapper<any> = mount(Chat, { ...stubTeleport })
  await wrapper.vm.$nextTick()

  // Set up a chat with tools enabled
  wrapper.vm.assistant.chat.tools = ['search']

  // Spy on disableTools
  const disableToolsSpy = vi.spyOn(wrapper.vm.assistant.chat, 'disableTools')

  // Create a fake link element
  const link = document.createElement('a')
  link.setAttribute('href', '#retry_without_plugins')
  document.body.appendChild(link)

  // Create and dispatch click event
  const clickEvent = new MouseEvent('click', {
    bubbles: true,
    cancelable: true
  })
  Object.defineProperty(clickEvent, 'target', { value: link, enumerable: true })

  link.dispatchEvent(clickEvent)
  await wrapper.vm.$nextTick()

  // Should have called disableTools
  expect(disableToolsSpy).toHaveBeenCalled()

  // Clean up
  document.body.removeChild(link)
})

test('Intercepts #retry_without_params link and clears modelOpts', async () => {
  const wrapper: VueWrapper<any> = mount(Chat, { ...stubTeleport })
  await wrapper.vm.$nextTick()

  // Set up a chat with model opts
  wrapper.vm.assistant.chat.modelOpts = { temperature: 0.5 }

  // Create a fake link element
  const link = document.createElement('a')
  link.setAttribute('href', '#retry_without_params')
  document.body.appendChild(link)

  // Create and dispatch click event
  const clickEvent = new MouseEvent('click', {
    bubbles: true,
    cancelable: true
  })
  Object.defineProperty(clickEvent, 'target', { value: link, enumerable: true })

  link.dispatchEvent(clickEvent)
  await wrapper.vm.$nextTick()

  // Should have cleared model opts
  expect(wrapper.vm.assistant.chat.modelOpts).toBeUndefined()

  // Clean up
  document.body.removeChild(link)
})
