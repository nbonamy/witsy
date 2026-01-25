
import { enableAutoUnmount, mount, VueWrapper } from '@vue/test-utils'
import { defaultCapabilities } from 'multi-llm-ts'
import { afterEach, beforeAll, beforeEach, expect, test, vi } from 'vitest'
import ChatScreen from '@screens/Chat.vue'
import ChatModel from '@models/chat'
import { store } from '@services/store'
import LlmMock from '@tests/mocks/llm'
import { useBrowserMock, useWindowMock } from '@tests/mocks/window'
import { stubTeleport } from '@tests/mocks/stubs'

vi.mock('@services/llms/manager.ts', async () => {
  const LlmManager = vi.fn()
  LlmManager.prototype.initModels = vi.fn()
  LlmManager.prototype.isEngineReady = vi.fn(() => true)
  LlmManager.prototype.isEngineConfigured = vi.fn(() => true)
  LlmManager.prototype.getEngineName = () => 'mock'
  LlmManager.prototype.getCustomEngines = () => [] as any[]
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

vi.mock('@renderer/utils/dialog', () => ({
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
  const wrapper: VueWrapper<any> = mount(ChatScreen, { ...stubTeleport })
  expect(wrapper.exists()).toBe(true)
  expect(wrapper.find('.chat').exists()).toBe(true)
})

test('Registers window API event listeners', async () => {
  const wrapper: VueWrapper<any> = mount(ChatScreen, { ...stubTeleport })
  await wrapper.vm.$nextTick()

  // Verify event listeners were registered
  expect(window.api._on).toHaveBeenCalledWith('new-chat', expect.any(Function))
  expect(window.api._on).toHaveBeenCalledWith('delete-chat', expect.any(Function))
  expect(window.api._on).toHaveBeenCalledWith('computer-stop', expect.any(Function))
  expect(window.api._on).toHaveBeenCalledWith('update-available', expect.any(Function))
})

test('Intercepts #settings link clicks', async () => {
  const wrapper: VueWrapper<any> = mount(ChatScreen, { ...stubTeleport })
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
  const wrapper: VueWrapper<any> = mount(ChatScreen, { ...stubTeleport })
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
  const wrapper: VueWrapper<any> = mount(ChatScreen, { ...stubTeleport })
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

test('onNewChat initializes a new chat', async () => {
  const wrapper: VueWrapper<any> = mount(ChatScreen, { ...stubTeleport })
  await wrapper.vm.$nextTick()

  // Add some messages to current chat
  wrapper.vm.assistant.chat.addMessage({ role: 'user', content: 'test' })
  expect(wrapper.vm.assistant.chat.messages.length).toBeGreaterThan(0)

  // Call onNewChat
  await wrapper.vm.newChat()

  // Should have a fresh chat
  expect(wrapper.vm.assistant.chat.messages).toHaveLength(0)
})

test('onNewChat with payload sets prompt', async () => {
  const wrapper: VueWrapper<any> = mount(ChatScreen, { ...stubTeleport })
  await wrapper.vm.$nextTick()

  // Spy on chatArea methods
  const setPromptSpy = vi.spyOn(wrapper.vm.chatArea, 'setPrompt')

  await wrapper.vm.newChat({ prompt: 'test prompt' })

  expect(setPromptSpy).toHaveBeenCalledWith('test prompt')
})

test('onStopGeneration aborts the controller', async () => {
  const wrapper: VueWrapper<any> = mount(ChatScreen, { ...stubTeleport })
  await wrapper.vm.$nextTick()

  // Get the active session and set up an abort controller
  const session = wrapper.vm.activeSession
  session.abortController = new AbortController()
  const abortSpy = vi.spyOn(session.abortController, 'abort')

  // Trigger stop
  await wrapper.vm.onStopGeneration()

  expect(abortSpy).toHaveBeenCalled()
})

test('onToggleSidebar calls sidebar hide when visible', async () => {
  const wrapper: VueWrapper<any> = mount(ChatScreen, { ...stubTeleport })
  await wrapper.vm.$nextTick()

  // Make sidebar visible first
  wrapper.vm.sidebar.show()
  await wrapper.vm.$nextTick()

  const hideSpy = vi.spyOn(wrapper.vm.sidebar, 'hide')

  // Toggle should hide
  wrapper.vm.onToggleSidebar()

  expect(hideSpy).toHaveBeenCalled()
})

test('onToggleSidebar calls sidebar show when hidden', async () => {
  const wrapper: VueWrapper<any> = mount(ChatScreen, { ...stubTeleport })
  await wrapper.vm.$nextTick()

  // Hide sidebar first
  wrapper.vm.sidebar.hide()
  await wrapper.vm.$nextTick()

  const showSpy = vi.spyOn(wrapper.vm.sidebar, 'show')

  // Toggle should show
  wrapper.vm.onToggleSidebar()

  expect(showSpy).toHaveBeenCalled()
})

test('onRenameChat shows dialog and updates title', async () => {
  const wrapper: VueWrapper<any> = mount(ChatScreen, { ...stubTeleport })
  await wrapper.vm.$nextTick()

  const chat = wrapper.vm.assistant.chat
  chat.title = 'Old Title'

  // Mock Dialog.show to return new title
  const Dialog = (await import('@renderer/utils/dialog')).default
  vi.mocked(Dialog.show).mockResolvedValue({ value: 'New Title', isConfirmed: true, isDenied: false, isDismissed: false })

  await wrapper.vm.onRenameChat(chat)

  expect(chat.title).toBe('New Title')
})

test('onRenameChat does nothing when cancelled', async () => {
  const wrapper: VueWrapper<any> = mount(ChatScreen, { ...stubTeleport })
  await wrapper.vm.$nextTick()

  const chat = wrapper.vm.assistant.chat
  chat.title = 'Old Title'

  // Mock Dialog.show to return cancelled
  const Dialog = (await import('@renderer/utils/dialog')).default
  vi.mocked(Dialog.show).mockResolvedValue({ value: null, isConfirmed: false, isDenied: false, isDismissed: true })

  await wrapper.vm.onRenameChat(chat)

  expect(chat.title).toBe('Old Title')
})

test('onDeleteChat shows confirmation dialog', async () => {
  const wrapper: VueWrapper<any> = mount(ChatScreen, { ...stubTeleport })
  await wrapper.vm.$nextTick()

  // Mock Dialog.show to cancel
  const Dialog = (await import('@renderer/utils/dialog')).default
  vi.mocked(Dialog.show).mockResolvedValue({ isConfirmed: false, isDenied: false, isDismissed: true, value: null })

  await wrapper.vm.onDeleteChat('chat-id')

  expect(Dialog.show).toHaveBeenCalledWith(expect.objectContaining({
    showCancelButton: true
  }))
})

test('onUpdateAvailable shows dialog', async () => {
  const wrapper: VueWrapper<any> = mount(ChatScreen, { ...stubTeleport })
  await wrapper.vm.$nextTick()

  // Mock Dialog.show
  const Dialog = (await import('@renderer/utils/dialog')).default
  vi.mocked(Dialog.show).mockResolvedValue({ isConfirmed: false, isDenied: false, isDismissed: true, value: null })

  wrapper.vm.onUpdateAvailable()

  expect(Dialog.show).toHaveBeenCalledWith(expect.objectContaining({
    showCancelButton: true
  }))
})

test('onUpdateAvailable applies update when confirmed', async () => {
  const wrapper: VueWrapper<any> = mount(ChatScreen, { ...stubTeleport })
  await wrapper.vm.$nextTick()

  // Mock Dialog.show to confirm
  const Dialog = (await import('@renderer/utils/dialog')).default
  vi.mocked(Dialog.show).mockResolvedValue({ isConfirmed: true, isDenied: false, isDismissed: false, value: null })

  wrapper.vm.onUpdateAvailable()
  await wrapper.vm.$nextTick()

  // Wait for the promise chain
  await new Promise(resolve => setTimeout(resolve, 10))

  expect(window.api.update.apply).toHaveBeenCalled()
})

test('onRenameFolder shows dialog and updates name', async () => {
  const wrapper: VueWrapper<any> = mount(ChatScreen, { ...stubTeleport })
  await wrapper.vm.$nextTick()

  // Setup folder in store
  store.history.folders = [{ id: 'folder1', name: 'Old Name', chats: [] }]

  // Mock Dialog.show
  const Dialog = (await import('@renderer/utils/dialog')).default
  vi.mocked(Dialog.show).mockResolvedValue({ value: 'New Name', isConfirmed: true, isDenied: false, isDismissed: false })

  await wrapper.vm.onRenameFolder('folder1')

  expect(store.history.folders[0].name).toBe('New Name')
})

test('onDeleteFolder shows dialog with options', async () => {
  const wrapper: VueWrapper<any> = mount(ChatScreen, { ...stubTeleport })
  await wrapper.vm.$nextTick()

  // Setup folder in store
  store.history.folders = [{ id: 'folder1', name: 'Test Folder', chats: ['chat1'] }]

  // Mock Dialog.show to dismiss
  const Dialog = (await import('@renderer/utils/dialog')).default
  vi.mocked(Dialog.show).mockResolvedValue({ isConfirmed: false, isDenied: false, isDismissed: true, value: null })

  await wrapper.vm.onDeleteFolder('folder1')

  expect(Dialog.show).toHaveBeenCalledWith(expect.objectContaining({
    showDenyButton: true,
    showCancelButton: true
  }))

  // Folder should still exist (user dismissed)
  expect(store.history.folders).toHaveLength(1)
})

test('onDeleteFolder confirms and keeps conversations', async () => {
  const wrapper: VueWrapper<any> = mount(ChatScreen, { ...stubTeleport })
  await wrapper.vm.$nextTick()

  // Setup folder in store with a chat
  store.history.folders = [{ id: 'folder1', name: 'Test Folder', chats: ['chat1'] }]

  // Mock Dialog.show to confirm (keep conversations)
  const Dialog = (await import('@renderer/utils/dialog')).default
  vi.mocked(Dialog.show).mockResolvedValue({ isConfirmed: true, isDenied: false, isDismissed: false, value: null })

  await wrapper.vm.onDeleteFolder('folder1')

  // Folder should be deleted
  expect(store.history.folders).toHaveLength(0)
})

test('onDeleteFolder denies and deletes conversations', async () => {
  const wrapper: VueWrapper<any> = mount(ChatScreen, { ...stubTeleport })
  await wrapper.vm.$nextTick()

  // Setup folder in store with a chat
  store.history.folders = [{ id: 'folder1', name: 'Test Folder', chats: ['chat1'] }]
  store.history.chats = [{ uuid: 'chat1', delete: vi.fn() } as any]

  // Mock Dialog.show to deny (delete conversations)
  const Dialog = (await import('@renderer/utils/dialog')).default
  vi.mocked(Dialog.show).mockResolvedValue({ isConfirmed: false, isDenied: true, isDismissed: false, value: null })

  await wrapper.vm.onDeleteFolder('folder1')

  // Folder should be deleted
  expect(store.history.folders).toHaveLength(0)
  // Chat should also be deleted
  expect(store.history.chats).toHaveLength(0)
})

test('importChat adds chat to history', async () => {
  const wrapper: VueWrapper<any> = mount(ChatScreen, { ...stubTeleport })
  await wrapper.vm.$nextTick()

  const initialChatCount = store.history.chats.length

  // Import a chat
  wrapper.vm.importChat({
    uuid: 'imported-chat',
    title: 'Imported Chat',
    messages: []
  })

  expect(store.history.chats.length).toBe(initialChatCount + 1)
})

test('onMoveChat shows folder selection dialog', async () => {
  const wrapper: VueWrapper<any> = mount(ChatScreen, { ...stubTeleport })
  await wrapper.vm.$nextTick()

  // Setup folders
  store.history.folders = [
    { id: 'folder1', name: 'Folder 1', chats: ['chat1'] },
    { id: 'folder2', name: 'Folder 2', chats: [] }
  ]

  // Mock Dialog.show to dismiss
  const Dialog = (await import('@renderer/utils/dialog')).default
  vi.mocked(Dialog.show).mockResolvedValue({ value: null, isConfirmed: false, isDenied: false, isDismissed: true })

  await wrapper.vm.onMoveChat('chat1')

  expect(Dialog.show).toHaveBeenCalledWith(expect.objectContaining({
    input: 'select'
  }))
})

test('onForkChat sets up editor and shows it', async () => {
  const wrapper: VueWrapper<any> = mount(ChatScreen, { ...stubTeleport })
  await wrapper.vm.$nextTick()

  // Spy on chatEditor.show
  const showSpy = vi.spyOn(wrapper.vm.chatEditor, 'show')

  const message = { uuid: 'msg1', role: 'assistant', content: 'test' }
  wrapper.vm.onForkChat(message)

  expect(wrapper.vm.chatEditorTitle).toBe('chat.fork.title')
  expect(wrapper.vm.chatEditorConfirmButtonText).toBe('common.fork')
  expect(showSpy).toHaveBeenCalled()
})

test('onDeleteMessage shows confirmation dialog', async () => {
  const wrapper: VueWrapper<any> = mount(ChatScreen, { ...stubTeleport })
  await wrapper.vm.$nextTick()

  const message = { uuid: 'msg1', role: 'assistant', content: 'test', delete: vi.fn() }

  // Mock Dialog.show to cancel
  const Dialog = (await import('@renderer/utils/dialog')).default
  vi.mocked(Dialog.show).mockResolvedValue({ isConfirmed: false, isDenied: false, isDismissed: true, value: null })

  await wrapper.vm.onDeleteMessage(message)

  expect(Dialog.show).toHaveBeenCalledWith(expect.objectContaining({
    showCancelButton: true
  }))
})

// Parallel sessions tests

test('Creates session on mount', async () => {
  const wrapper: VueWrapper<any> = mount(ChatScreen, { ...stubTeleport })
  await wrapper.vm.$nextTick()

  // Should have an active session
  expect(wrapper.vm.activeSessionId).not.toBeNull()
  expect(wrapper.vm.activeSession).not.toBeNull()
  expect(wrapper.vm.activeSession.status).toBe('idle')
})

test('Creates new session on new chat', async () => {
  const wrapper: VueWrapper<any> = mount(ChatScreen, { ...stubTeleport })
  await wrapper.vm.$nextTick()

  const firstSessionId = wrapper.vm.activeSessionId

  // Create new chat
  await wrapper.vm.newChat()

  // Should have a different session
  expect(wrapper.vm.activeSessionId).not.toBe(firstSessionId)
  expect(wrapper.vm.activeSession).not.toBeNull()
})

test('Switches session on select chat', async () => {
  const wrapper: VueWrapper<any> = mount(ChatScreen, { ...stubTeleport })
  await wrapper.vm.$nextTick()

  const firstSessionId = wrapper.vm.activeSessionId

  // Create another chat and select it
  const newChat = new ChatModel()
  wrapper.vm.onSelectChat(newChat)
  await wrapper.vm.$nextTick()

  // Should switch to new session
  expect(wrapper.vm.activeSessionId).toBe(newChat.uuid)
  expect(wrapper.vm.activeSessionId).not.toBe(firstSessionId)
})

test('Cleans up idle session when switching', async () => {
  const wrapper: VueWrapper<any> = mount(ChatScreen, { ...stubTeleport })
  await wrapper.vm.$nextTick()

  const firstSessionId = wrapper.vm.activeSessionId

  // Switch to another chat
  const newChat = new ChatModel()
  wrapper.vm.onSelectChat(newChat)
  await wrapper.vm.$nextTick()

  // Old idle session should be cleaned up
  expect(wrapper.vm.sessions[firstSessionId]).toBeUndefined()
})

test('generatingChatIds returns empty when only active session is generating', async () => {
  const wrapper: VueWrapper<any> = mount(ChatScreen, { ...stubTeleport })
  await wrapper.vm.$nextTick()

  // Set active session to generating
  wrapper.vm.activeSession.status = 'generating'

  // Should return empty array (user already sees streaming)
  expect(wrapper.vm.generatingChatIds).toEqual([])
})

test('generatingChatIds returns ids when background session is generating', async () => {
  const wrapper: VueWrapper<any> = mount(ChatScreen, { ...stubTeleport })
  await wrapper.vm.$nextTick()

  const firstSessionId = wrapper.vm.activeSessionId

  // Set first session to generating
  wrapper.vm.sessions[firstSessionId].status = 'generating'

  // Create new chat (switch away)
  await wrapper.vm.newChat()

  // First session should now show in generatingChatIds
  expect(wrapper.vm.generatingChatIds).toContain(firstSessionId)
})

test('setSessionStatus updates session status', async () => {
  const wrapper: VueWrapper<any> = mount(ChatScreen, { ...stubTeleport })
  await wrapper.vm.$nextTick()

  const sessionId = wrapper.vm.activeSessionId

  wrapper.vm.setSessionStatus(sessionId, 'generating')
  expect(wrapper.vm.sessions[sessionId].status).toBe('generating')

  wrapper.vm.setSessionStatus(sessionId, 'idle')
  expect(wrapper.vm.sessions[sessionId].status).toBe('idle')
})

test('cleanupSession aborts and removes session', async () => {
  const wrapper: VueWrapper<any> = mount(ChatScreen, { ...stubTeleport })
  await wrapper.vm.$nextTick()

  const sessionId = wrapper.vm.activeSessionId
  const session = wrapper.vm.sessions[sessionId]

  // Set up abort controller
  session.abortController = new AbortController()
  const abortSpy = vi.spyOn(session.abortController, 'abort')

  // Cleanup
  wrapper.vm.cleanupSession(sessionId)

  expect(abortSpy).toHaveBeenCalled()
  expect(wrapper.vm.sessions[sessionId]).toBeUndefined()
})
