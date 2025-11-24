
import { vi, beforeAll, beforeEach, expect, test, afterEach, Mock } from 'vitest'
import { enableAutoUnmount, mount, VueWrapper } from '@vue/test-utils'
import { useWindowMock, useBrowserMock } from '@tests/mocks/window'
import { createI18nMock } from '@tests/mocks'
import LlmMock, { installMockModels } from '@tests/mocks/llm'
import { store } from '@services/store'
import Dialog from '@renderer/utils/dialog'
import defaultSettings from '@root/defaults/settings.json'
import ScratchPad from '@screens/ScratchPad.vue'
import Prompt, { SendPromptParams } from '@components/Prompt.vue'
import EditableText from '@components/EditableText.vue'
import Sidebar from '@renderer/scratchpad/Sidebar.vue'
import ActionBar from '@renderer/scratchpad/ActionBar.vue'
import Attachment from '@models/attachment'

vi.unmock('@renderer/composables/event_bus')
import useEventBus  from '@composables/event_bus'
import { defaultCapabilities } from 'multi-llm-ts'
import LlmManager from '@services/llms/manager'
const { emitEvent } = useEventBus()

// Unmock EventBus for this test - scratchpad needs real event handling

vi.mock('@services/llms/manager.ts', async () => {
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

vi.mock('@services/i18n', async () => {
  return createI18nMock()
})

enableAutoUnmount(afterEach)

beforeAll(() => {
  useWindowMock({ dialogResponse: 1, modelDefaults: true })
  useBrowserMock()
  
  window.api.base64 = {
    decode: vi.fn((s) => s),
    encode: vi.fn((s) => s),
  }

  // @ts-expect-error mock
  window.api.file.pickFile = vi.fn(() => { return {
    contents: '{ "contents": { "content": "Hello LLM" }, "undoStack": [], "redoStack": [] }',
    url: 'file://scratchpad.json',
  }})
  
})

beforeEach(() => {
  vi.clearAllMocks()
  // @ts-expect-error mocking
  store.config = defaultSettings
  store.config.general.locale = 'en-US'
  store.config.llm.locale = 'fr-FR'
  installMockModels()
})

test('Renders correctly', () => {
  const wrapper: VueWrapper<any> = mount(ScratchPad)
  expect(wrapper.exists()).toBe(true)
  expect(wrapper.find('.scratchpad').exists()).toBe(true)
  expect(wrapper.findComponent(Sidebar).exists()).toBe(true)
  expect(wrapper.findComponent(EditableText).exists()).toBe(true)
  expect(wrapper.findComponent(ActionBar).exists()).toBe(true)
  expect(wrapper.findComponent(Prompt).exists()).toBe(true)
  expect(wrapper.findComponent(EditableText).text()).toBe('scratchpad.placeholder_en-US')
})

test('Initalizes correctly', async () => {
  const wrapper: VueWrapper<any> = mount(ScratchPad)
  expect(wrapper.vm.llm).toBeDefined()
  expect(wrapper.vm.llm.getName()).toBe('mock')
  expect(wrapper.vm.chat.engine).toBe('mock')
  expect(wrapper.vm.chat.model).toBe('chat')
  expect(wrapper.vm.chat.tools).toStrictEqual([])
  expect(wrapper.vm.chat.modelOpts).toBeDefined()
  expect(wrapper.vm.chat.messages).toHaveLength(1)
  expect(wrapper.vm.editor.value).not.toBeNull()
  expect(wrapper.vm.undoStack).toHaveLength(1) // Empty baseline
  expect(wrapper.vm.redoStack).toHaveLength(0)
})

test('Sends prompt and sets modified', async () => {
  const wrapper: VueWrapper<any> = mount(ScratchPad)
  await wrapper.vm.prompt.$emit('prompt', { prompt: 'Hello LLM' })
  await vi.waitUntil(async () => !wrapper.vm.processing)
  expect(wrapper.findComponent(EditableText).text()).toBe('[{"role":"system","content":"instructions.scratchpad.system_fr-FR"},{"role":"user","content":"Hello LLM"},{"role":"assistant","content":"Be kind. Don\'t mock me"}]')
  expect(wrapper.vm.checkIfModified()).toBe(true)
})

test('Sends system prompt with params', async () => {
  const wrapper: VueWrapper<any> = mount(ScratchPad)
  await wrapper.vm.prompt.$emit('prompt', { prompt: 'Hello LLM', attachments: [ new Attachment('file', 'text/plain') ], expert: store.experts[0] })
  await vi.waitUntil(async () => !wrapper.vm.processing)
  expect(wrapper.findComponent(EditableText).text()).toBe('[{"role":"system","content":"instructions.scratchpad.system_fr-FR"},{"role":"user","content":"expert_uuid1_prompt\\nHello LLM (file)"},{"role":"assistant","content":"Be kind. Don\'t mock me"}]')
  expect(wrapper.vm.checkIfModified()).toBe(true)
})

test('Sends user prompt with params', async () => {
  const wrapper: VueWrapper<any> = mount(ScratchPad)
  await wrapper.vm.prompt.$emit('prompt', { prompt: 'Hello LLM', attachments: [ new Attachment('file', 'text/plain') ], expert: store.experts[2] })
  await vi.waitUntil(async () => !wrapper.vm.processing)
  expect(wrapper.findComponent(EditableText).text()).toBe('[{"role":"system","content":"instructions.scratchpad.system_fr-FR"},{"role":"user","content":"prompt3\\nHello LLM (file)"},{"role":"assistant","content":"Be kind. Don\'t mock me"}]')
  expect(wrapper.vm.checkIfModified()).toBe(true)
})

test('Clears chat', async () => {
  const wrapper: VueWrapper<any> = mount(ScratchPad)
  await wrapper.vm.prompt.$emit('prompt', { prompt: 'Hello LLM' })
  await vi.waitUntil(async () => !wrapper.vm.processing)
  expect(wrapper.findComponent(EditableText).text()).not.toBe('')
  vi.mocked(Dialog.show).mockResolvedValueOnce({ isDismissed: true })
  emitEvent('action', 'clear')
  await vi.waitUntil(async () => wrapper.vm.currentScratchpadId === null)
  expect(wrapper.findComponent(EditableText).text()).toBe('scratchpad.placeholder_en-US')
})

test('Manual typing creates undo entries', async () => {
  vi.useFakeTimers()
  const wrapper: VueWrapper<any> = mount(ScratchPad)

  // Should start with baseline only
  expect(wrapper.vm.undoStack).toHaveLength(1)
  expect(wrapper.vm.undoStack[0].after.content).toBe('')

  // Simulate manual typing
  wrapper.vm.editor.setContent({ content: 'First edit', start: null, end: null })

  // Trigger keyup event to activate the debounce timeout
  document.dispatchEvent(new KeyboardEvent('keyup'))

  // Fast-forward past the debounce delay
  vi.advanceTimersByTime(1000)
  await wrapper.vm.$nextTick()

  // Should have created new undo entry
  expect(wrapper.vm.undoStack.length).toBeGreaterThan(1)
  expect(wrapper.vm.undoStack[wrapper.vm.undoStack.length - 1].after.content).toBe('First edit')
  expect(wrapper.vm.checkIfModified()).toBe(true)

  // Type more
  wrapper.vm.editor.setContent({ content: 'First edit plus more', start: null, end: null })
  document.dispatchEvent(new KeyboardEvent('keyup'))
  vi.advanceTimersByTime(1000)
  await wrapper.vm.$nextTick()

  // Should have another undo entry
  expect(wrapper.vm.undoStack.length).toBeGreaterThan(2)
  expect(wrapper.vm.undoStack[wrapper.vm.undoStack.length - 1].after.content).toBe('First edit plus more')

  vi.useRealTimers()
})

test('Undo/redo', async () => {
  const wrapper: VueWrapper<any> = mount(ScratchPad)

  // Load a scratchpad to have baseline content
  const scratchpad = wrapper.vm.scratchpads[0]
  emitEvent('action', { type: 'select-scratchpad', value: scratchpad })
  await vi.waitUntil(async () => wrapper.vm.currentScratchpadId)

  // Should have baseline in undo stack
  expect(wrapper.vm.undoStack).toHaveLength(1)
  const baselineContent = wrapper.findComponent(EditableText).text()

  // Make an edit using LLM (which creates undo entries)
  await wrapper.vm.prompt.$emit('prompt', { prompt: 'Hello' })
  await vi.waitUntil(async () => !wrapper.vm.processing)

  // Should have more undo entries now
  expect(wrapper.vm.undoStack.length).toBeGreaterThan(1)
  const editedContent = wrapper.findComponent(EditableText).text()
  expect(editedContent).not.toBe(baselineContent)
  expect(wrapper.vm.redoStack).toHaveLength(0)

  // Undo should restore baseline
  emitEvent('action', 'undo')
  await wrapper.vm.$nextTick()
  expect(wrapper.findComponent(EditableText).text()).toBe(baselineContent)
  expect(wrapper.vm.undoStack).toHaveLength(1) // Back to baseline only
  expect(wrapper.vm.redoStack.length).toBeGreaterThan(0)

  // Redo should restore edit
  emitEvent('action', 'redo')
  await wrapper.vm.$nextTick()
  expect(wrapper.findComponent(EditableText).text()).toBe(editedContent)
  expect(wrapper.vm.redoStack).toHaveLength(0)
})

test('Loads chat', async () => {
  const wrapper: VueWrapper<any> = mount(ScratchPad)
  const scratchpad = { uuid: 'scratchpad1', title: 'Test Scratchpad 1', lastModified: Date.now() }
  emitEvent('action', { type: 'select-scratchpad', value: scratchpad })
  await vi.waitUntil(async () => wrapper.vm.currentScratchpadId)
  expect(wrapper.findComponent(EditableText).text()).toBe('Test content')
})

test('Saves chat', async () => {
  const wrapper: VueWrapper<any> = mount(ScratchPad)
  await wrapper.vm.prompt.$emit('prompt', { prompt: 'Hello LLM' })
  await vi.waitUntil(async () => !wrapper.vm.processing)
  // Mock dialog to auto-confirm with a title
  vi.spyOn(Dialog, 'show').mockResolvedValue({ isConfirmed: true, value: 'New Scratchpad', isDenied: false, isDismissed: false })
  emitEvent('action', 'save')
  await vi.waitUntil(async () => wrapper.vm.currentScratchpadId)
  expect(window.api.scratchpad.save).toHaveBeenCalled()
})

test('Sets engine', async () => {
  const wrapper: VueWrapper<any> = mount(ScratchPad)
  emitEvent('action', { type: 'llm', value: { engine: 'openai', model: 'chat' }})
  expect(wrapper.vm.chat.engine).toBe('openai')
  expect(wrapper.vm.chat.model).toBe('chat')
  expect(wrapper.vm.chat.tools).toBeNull()
  expect(wrapper.vm.chat.modelOpts).not.toBeDefined()
})

test('Replaces selection', async () => {
  const wrapper: VueWrapper<any> = mount(ScratchPad)
  wrapper.vm.editor.setContent({ content: 'Hello SELECTED LLM', start: 6, end: 14})
  await wrapper.vm.prompt.$emit('prompt', { prompt: 'Hello LLM' })
  await vi.waitUntil(async () => !wrapper.vm.chat.lastMessage().transient)
  expect(wrapper.findComponent(EditableText).text()).toBe('Hello [{"role":"system","content":"instructions.scratchpad.system_fr-FR"},{"role":"user","content":"instructions.scratchpad.prompt_fr-FR"},{"role":"assistant","content":"Be kind. Don\'t mock me"}] LLM')
  const content = wrapper.vm.editor.getContent()
  expect(content.start).toBe(6)
  expect(content.end).toBe(195)
})

test('Copies text', async () => {
  const wrapper: VueWrapper<any> = mount(ScratchPad)
  wrapper.vm.editor.setContent({ content: 'Hello LLM', start: -1, end: -1})
  emitEvent('action', 'copy')
  expect(window.api.clipboard.writeText).toHaveBeenLastCalledWith('Hello LLM')
})

// test('Reads text', async () => {
//   const wrapper: VueWrapper<any> = mount(ScratchPad)
//   wrapper.vm.editor.setContent({ content: 'Hello LLM', start: -1, end: -1})
//   emitEvent('action', 'read')
// })

for (const action of ['spellcheck', 'improve', 'takeaways', 'title', 'simplify', 'expand']) {
  test(`Runs action ${action}`, async () => {
    // @ts-expect-error mocking
    store.config.instructions = {
      scratchpad: {
        prompt: 'EXTRACT:\n{document}\n\nASK: {ask}'
      }
    }
    const wrapper: VueWrapper<any> = mount(ScratchPad)
    wrapper.vm.editor.setContent({ content: 'Hello LLM', start: -1, end: -1})
    emitEvent('action', { type: 'magic', value: action } )
    await vi.waitUntil(async () => !wrapper.vm.processing)
    expect(wrapper.findComponent(EditableText).text()).toContain(`instructions.scratchpad.${action}_fr-FR`)
  })
}

test('Changes engine model', async () => {
  const wrapper: VueWrapper<any> = mount(ScratchPad)
  await wrapper.find('.model-menu-button').trigger('click')
  wrapper.findComponent({ name: 'EngineModelMenu' }).vm.$emit('modelSelected', 'openai', 'chat1')
  await wrapper.vm.$nextTick()
  expect(LlmManager.prototype.igniteEngine).toHaveBeenLastCalledWith('openai')
  expect(wrapper.vm.chat.engine).toBe('openai')
  expect(wrapper.vm.chat.model).toBe('chat1')
})

test('Changes tools', async () => {
  const wrapper: VueWrapper<any> = mount(ScratchPad)
  await wrapper.find('.prompt-menu').trigger('click')
  wrapper.findComponent({ name: 'PromptMenu' }).vm.$emit('unselectAllTools')
  await wrapper.vm.$nextTick()
  expect(wrapper.vm.chat.tools).toStrictEqual([])
  await wrapper.vm.prompt.$emit('prompt', { prompt: 'Hello LLM' } as SendPromptParams)
  expect(LlmManager.prototype.loadTools).toHaveBeenLastCalledWith(wrapper.vm.llm, expect.any(String), expect.any(Object), [])
})

// History Management Tests

test('Loads scratchpads list on mount', () => {
  const wrapper: VueWrapper<any> = mount(ScratchPad)
  expect(window.api.scratchpad.list).toHaveBeenCalled()
  expect(wrapper.vm.scratchpads).toHaveLength(2)
  expect(wrapper.vm.scratchpads[0].uuid).toBe('scratchpad1')
})

test('Displays history in sidebar', async () => {
  const wrapper: VueWrapper<any> = mount(ScratchPad)
  await wrapper.vm.$nextTick()
  const sidebar = wrapper.findComponent(Sidebar)
  expect(sidebar.exists()).toBe(true)
  expect(sidebar.props('scratchpads')).toHaveLength(2)
})

test('Selects scratchpad from history', async () => {
  const wrapper: VueWrapper<any> = mount(ScratchPad)
  const scratchpad = wrapper.vm.scratchpads[0]
  emitEvent('action', { type: 'select-scratchpad', value: scratchpad })
  await vi.waitUntil(async () => wrapper.vm.currentScratchpadId === scratchpad.uuid)
  expect(wrapper.vm.currentTitle).toBe('Test Scratchpad')
  expect(wrapper.vm.selectedScratchpad).toEqual(scratchpad)
})

test('Import prompts for title', async () => {
  mount(ScratchPad)

  // @ts-expect-error mock
  window.api.file.pickFile = vi.fn(() => ({
    contents: '{"content": "imported"}',
    url: 'file:///test/my-test-file.json'
  }))

  vi.spyOn(Dialog, 'show').mockResolvedValue({ isConfirmed: true, value: 'My Custom Title', isDenied: false, isDismissed: false })

  emitEvent('action', 'import')
  await vi.waitUntil(async () => (Dialog.show as Mock).mock.calls.length > 0)

  const dialogCall = vi.mocked(Dialog.show).mock.calls[0][0]
  expect(dialogCall.inputValue).toBe('My Test File') // Title case from filename
})

test('Import creates new scratchpad', async () => {
  mount(ScratchPad)

  vi.spyOn(Dialog, 'show').mockResolvedValue({ isConfirmed: true, value: 'Imported', isDenied: false, isDismissed: false })

  // @ts-expect-error mock
  window.api.file.pickFile = vi.fn(() => ({
    url: 'file:///test/file.json',
    contents: '{}'
  }))

  emitEvent('action', 'import')
  await vi.waitUntil(async () => (window.api.scratchpad.import as Mock).mock.calls.length > 0, { timeout: 2000 })

  // Check the actual call
  const importCall = vi.mocked(window.api.scratchpad.import).mock.calls[0]
  expect(importCall[0]).toBe(store.config.workspaceId) // workspaceId
  expect(importCall[1]).toBe('file:///test/file.json') // filePath (not normalized in renderer)
  expect(importCall[2]).toBe('Imported') // title
})

test('Rename updates scratchpad', async () => {
  const wrapper: VueWrapper<any> = mount(ScratchPad)

  const scratchpad = wrapper.vm.scratchpads[0]
  wrapper.vm.targetScratchpad = scratchpad

  vi.spyOn(Dialog, 'show').mockResolvedValue({ isConfirmed: true, value: 'New Title', isDenied: false, isDismissed: false })

  await wrapper.vm.onRenameScratchpad()

  expect(window.api.scratchpad.rename).toHaveBeenCalledWith(
    expect.any(String),
    scratchpad.uuid,
    'New Title'
  )
})

test('Delete removes scratchpad', async () => {
  const wrapper: VueWrapper<any> = mount(ScratchPad)

  const scratchpad = wrapper.vm.scratchpads[0]
  wrapper.vm.targetScratchpad = scratchpad

  vi.spyOn(Dialog, 'show').mockResolvedValue({ isConfirmed: true, isDenied: false, isDismissed: false })

  await wrapper.vm.onDeleteScratchpad()

  expect(window.api.scratchpad.delete).toHaveBeenCalledWith(
    expect.any(String),
    scratchpad.uuid
  )
})

test('Saves scratchpad successfully', async () => {
  const wrapper: VueWrapper<any> = mount(ScratchPad)

  // Add some content first so there's something to save
  wrapper.vm.editor.setContent({ content: 'Content to save', start: null, end: null })
  await wrapper.vm.$nextTick()

  // Before save, should be modified (new content on new scratchpad)
  expect(wrapper.vm.checkIfModified()).toBe(true)

  vi.spyOn(Dialog, 'show').mockResolvedValue({ isConfirmed: true, value: 'Test', isDenied: false, isDismissed: false })
  emitEvent('action', 'save')
  await vi.waitUntil(async () => wrapper.vm.currentScratchpadId)

  expect(window.api.scratchpad.save).toHaveBeenCalled()
  expect(wrapper.vm.currentScratchpadId).toBeDefined()
  expect(wrapper.vm.undoStack).toHaveLength(1) // Baseline after save
})

test('Load initializes undo stack', async () => {
  const wrapper: VueWrapper<any> = mount(ScratchPad)

  const scratchpad = wrapper.vm.scratchpads[0]
  emitEvent('action', { type: 'select-scratchpad', value: scratchpad })
  await vi.waitUntil(async () => wrapper.vm.currentScratchpadId)

  expect(wrapper.vm.undoStack).toHaveLength(1)
  expect(wrapper.vm.undoStack[0].after).toEqual({ content: 'Test content' })
  expect(wrapper.vm.redoStack).toHaveLength(0)
  expect(wrapper.vm.checkIfModified()).toBe(false)
})

test('Switching with unsaved changes prompts', async () => {
  const wrapper: VueWrapper<any> = mount(ScratchPad)

  // Actually modify content to trigger unsaved changes
  wrapper.vm.editor.setContent({ content: 'Modified content', start: null, end: null })
  await wrapper.vm.$nextTick()

  // Try to switch
  vi.spyOn(Dialog, 'show').mockResolvedValue({ isDismissed: true, isConfirmed: false, isDenied: false })

  const scratchpad = wrapper.vm.scratchpads[1]
  emitEvent('action', { type: 'select-scratchpad', value: scratchpad })
  await vi.waitUntil(async () => (Dialog.show as Mock).mock.calls.length > 0)

  expect(Dialog.show).toHaveBeenCalled()
  expect(wrapper.vm.currentScratchpadId).toBeNull() // Should not have switched
})