
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
import TiptapEditor from '@components/editor/TiptapEditor.vue'
import Sidebar from '@renderer/scratchpad/Sidebar.vue'
import ActionBar from '@renderer/scratchpad/ActionBar.vue'
import Attachment from '@models/attachment'

import { defaultCapabilities } from 'multi-llm-ts'
import LlmManager from '@services/llms/manager'

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

vi.mock('@services/i18n', async () => {
  return createI18nMock()
})

// Mock generator to simulate tool delegate execution
const mockGeneratorGenerate = vi.fn()
vi.mock('@services/generator', () => {
  const Generator = vi.fn()
  Generator.prototype.generate = (...args: any[]) => mockGeneratorGenerate(...args)
  return { default: Generator }
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

  // simulate tool delegate execution: call edit_document or insert_content
  mockGeneratorGenerate.mockImplementation(async (_llm: any, messages: any[], opts: any) => {
    const delegate = opts?.toolExecutionDelegate
    if (delegate) {
      const tools = delegate.getTools()
      const tool = tools[0]
      if (tool.name === 'replace_selection') {
        await delegate.execute({ model: 'mock' }, 'replace_selection', { content: 'Be kind' })
      } else if (tool.name === 'edit_document') {
        await delegate.execute({ model: 'mock' }, 'insert_content', { position: -1, content: 'Be kind' })
      }
    }
    // set response content on the last message (assistant message)
    const response = messages[messages.length - 1]
    if (response?.setText) response.setText('Be kind')
    return 'success'
  })
})

test('Renders correctly', () => {
  const wrapper: VueWrapper<any> = mount(ScratchPad)
  expect(wrapper.exists()).toBe(true)
  expect(wrapper.find('.scratchpad').exists()).toBe(true)
  expect(wrapper.findComponent(Sidebar).exists()).toBe(true)
  expect(wrapper.findComponent(TiptapEditor).exists()).toBe(true)
  expect(wrapper.findComponent(ActionBar).exists()).toBe(true)
  expect(wrapper.findComponent(Prompt).exists()).toBe(true)
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
  expect(wrapper.vm.content).toBe('')
})

test('Sends prompt and sets modified', async () => {
  const wrapper: VueWrapper<any> = mount(ScratchPad)
  await wrapper.vm.prompt.$emit('prompt', { prompt: 'Hello LLM' })
  await vi.waitUntil(async () => !wrapper.vm.processing)
  expect(wrapper.vm.content).toContain('Be kind')
  expect(wrapper.vm.checkIfModified()).toBe(true)
})

test('Sends system prompt with params', async () => {
  const wrapper: VueWrapper<any> = mount(ScratchPad)
  await wrapper.vm.prompt.$emit('prompt', { prompt: 'Hello LLM', attachments: [ new Attachment('file', 'text/plain') ], expert: store.experts[0] })
  await vi.waitUntil(async () => !wrapper.vm.processing)
  expect(wrapper.vm.content).toContain('Be kind')
  expect(wrapper.vm.checkIfModified()).toBe(true)
})

test('Sends user prompt with params', async () => {
  const wrapper: VueWrapper<any> = mount(ScratchPad)
  await wrapper.vm.prompt.$emit('prompt', { prompt: 'Hello LLM', attachments: [ new Attachment('file', 'text/plain') ], expert: store.experts[2] })
  await vi.waitUntil(async () => !wrapper.vm.processing)
  expect(wrapper.vm.content).toContain('Be kind')
  expect(wrapper.vm.checkIfModified()).toBe(true)
})

test('Clears chat', async () => {
  const wrapper: VueWrapper<any> = mount(ScratchPad)
  await wrapper.vm.prompt.$emit('prompt', { prompt: 'Hello LLM' })
  await vi.waitUntil(async () => !wrapper.vm.processing)
  expect(wrapper.vm.content).not.toBe('')
  vi.mocked(Dialog.show).mockResolvedValueOnce({ isDismissed: true })
  wrapper.vm.onAction( 'clear')
  await vi.waitUntil(async () => wrapper.vm.currentScratchpadId === null)
  expect(wrapper.vm.content).toBe('')
})

test('Loads chat', async () => {
  const wrapper: VueWrapper<any> = mount(ScratchPad)
  const scratchpad = { uuid: 'scratchpad1', title: 'Test Scratchpad 1', lastModified: Date.now() }
  wrapper.vm.onAction( { type: 'select-scratchpad', value: scratchpad })
  await vi.waitUntil(async () => wrapper.vm.currentScratchpadId)
  expect(wrapper.vm.content).toBe('Test content')
})

test('Saves chat', async () => {
  const wrapper: VueWrapper<any> = mount(ScratchPad)
  await wrapper.vm.prompt.$emit('prompt', { prompt: 'Hello LLM' })
  await vi.waitUntil(async () => !wrapper.vm.processing)
  // Mock dialog to auto-confirm with a title
  vi.spyOn(Dialog, 'show').mockResolvedValue({ isConfirmed: true, value: 'New Scratchpad', isDenied: false, isDismissed: false })
  wrapper.vm.onAction( 'save')
  await vi.waitUntil(async () => wrapper.vm.currentScratchpadId)
  expect(window.api.scratchpad.save).toHaveBeenCalled()
})

test('Sets engine', async () => {
  const wrapper: VueWrapper<any> = mount(ScratchPad)
  wrapper.vm.onAction( { type: 'llm', value: { engine: 'openai', model: 'chat' }})
  expect(wrapper.vm.chat.engine).toBe('openai')
  expect(wrapper.vm.chat.model).toBe('chat')
  expect(wrapper.vm.chat.tools).toBeNull()
  expect(wrapper.vm.chat.modelOpts).not.toBeDefined()
})

test('Copies text', async () => {
  const wrapper: VueWrapper<any> = mount(ScratchPad)
  wrapper.vm.content = 'Hello LLM'
  wrapper.vm.onAction( 'copy')
  expect(window.api.clipboard.writeText).toHaveBeenLastCalledWith('Hello LLM')
})

for (const action of ['spellcheck', 'improve', 'takeaways', 'title', 'simplify', 'expand']) {
  test(`Runs action ${action}`, async () => {
    // @ts-expect-error mocking
    store.config.instructions = {
      scratchpad: {
        prompt: 'EXTRACT:\n{document}\n\nASK: {ask}'
      }
    }
    const wrapper: VueWrapper<any> = mount(ScratchPad)
    wrapper.vm.content = 'Hello LLM'
    await wrapper.vm.$nextTick()
    wrapper.vm.onAction( { type: 'magic', value: action } )
    await vi.waitUntil(async () => !wrapper.vm.processing)
    expect(wrapper.vm.content).toContain('Be kind')
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
  await vi.waitUntil(async () => !wrapper.vm.processing)
  expect(LlmManager.prototype.loadTools).toHaveBeenLastCalledWith(wrapper.vm.llm, expect.any(String), expect.any(Object), [], {
    codeExecutionMode: 'disabled',
  })
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
  wrapper.vm.onAction( { type: 'select-scratchpad', value: scratchpad })
  await vi.waitUntil(async () => wrapper.vm.currentScratchpadId === scratchpad.uuid)
  expect(wrapper.vm.currentTitle).toBe('Test Scratchpad')
  expect(wrapper.vm.selectedScratchpad).toEqual(scratchpad)
})

test('Import prompts for title from filename', async () => {
  const wrapper: VueWrapper<any> = mount(ScratchPad)

  // @ts-expect-error mock
  window.api.file.pickFile = vi.fn(() => ({
    contents: btoa('imported text'),
    url: 'file:///test/my-test-file.txt'
  }))

  vi.spyOn(Dialog, 'show').mockResolvedValue({ isConfirmed: true, value: 'My Custom Title', isDenied: false, isDismissed: false })

  wrapper.vm.onAction('import')
  await vi.waitUntil(async () => (Dialog.show as Mock).mock.calls.length > 0)

  const dialogCall = vi.mocked(Dialog.show).mock.calls[0][0]
  expect(dialogCall.inputValue).toBe('my-test-file') // Filename without extension
})

test('Import creates new scratchpad from text file', async () => {
  const wrapper: VueWrapper<any> = mount(ScratchPad)

  const base64Content = 'SGVsbG8gaW1wb3J0ZWQgY29udGVudA=='

  // @ts-expect-error mock
  window.api.file.pickFile = vi.fn(() => ({
    url: 'file:///test/file.txt',
    contents: base64Content
  }))

  vi.spyOn(Dialog, 'show').mockResolvedValue({ isConfirmed: true, value: 'Imported', isDenied: false, isDismissed: false })

  wrapper.vm.onAction('import')
  await vi.waitUntil(async () => wrapper.vm.currentScratchpadId, { timeout: 2000 })

  expect(window.api.base64.decode).toHaveBeenCalledWith(base64Content)
  expect(wrapper.vm.content).toBe(base64Content) // identity mock: decode returns input as-is
  expect(window.api.scratchpad.save).toHaveBeenCalled()
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
  wrapper.vm.content = 'Content to save'
  await wrapper.vm.$nextTick()

  // Before save, should be modified (new content on new scratchpad)
  expect(wrapper.vm.checkIfModified()).toBe(true)

  vi.spyOn(Dialog, 'show').mockResolvedValue({ isConfirmed: true, value: 'Test', isDenied: false, isDismissed: false })
  wrapper.vm.onAction( 'save')
  await vi.waitUntil(async () => wrapper.vm.currentScratchpadId)

  expect(window.api.scratchpad.save).toHaveBeenCalled()
  expect(wrapper.vm.currentScratchpadId).toBeDefined()
})

test('Load sets content and tracks saved state', async () => {
  const wrapper: VueWrapper<any> = mount(ScratchPad)

  const scratchpad = wrapper.vm.scratchpads[0]
  wrapper.vm.onAction( { type: 'select-scratchpad', value: scratchpad })
  await vi.waitUntil(async () => wrapper.vm.currentScratchpadId)

  expect(wrapper.vm.content).toBe('Test content')
  expect(wrapper.vm.checkIfModified()).toBe(false)
})

test('Switching with unsaved changes prompts', async () => {
  const wrapper: VueWrapper<any> = mount(ScratchPad)

  // Actually modify content to trigger unsaved changes
  wrapper.vm.content = 'Modified content'
  await wrapper.vm.$nextTick()

  // Try to switch
  vi.spyOn(Dialog, 'show').mockResolvedValue({ isDismissed: true, isConfirmed: false, isDenied: false })

  const scratchpad = wrapper.vm.scratchpads[1]
  wrapper.vm.onAction( { type: 'select-scratchpad', value: scratchpad })
  await vi.waitUntil(async () => (Dialog.show as Mock).mock.calls.length > 0)

  expect(Dialog.show).toHaveBeenCalled()
  expect(wrapper.vm.currentScratchpadId).toBeNull() // Should not have switched
})
