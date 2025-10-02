
import { vi, beforeAll, beforeEach, expect, test, afterEach } from 'vitest'
import { enableAutoUnmount, mount, VueWrapper } from '@vue/test-utils'
import { useWindowMock, useBrowserMock } from '../mocks/window'
import { createI18nMock } from '../mocks'
import LlmMock, { installMockModels } from '../mocks/llm'
import { store } from '../../src/services/store'
import Dialog from '../../src/composables/dialog'
import defaultSettings from '../../defaults/settings.json'
import ScratchPad from '../../src/screens/ScratchPad.vue'
import Prompt, { SendPromptParams } from '../../src/components/Prompt.vue'
import EditableText from '../../src/components/EditableText.vue'
import Sidebar from '../../src/scratchpad/Sidebar.vue'
import ActionBar from '../../src/scratchpad/ActionBar.vue'
import Attachment from '../../src/models/attachment'

vi.unmock('../../src/composables/event_bus')
import useEventBus  from '../../src/composables/event_bus'
import { defaultCapabilities } from 'multi-llm-ts'
import LlmManager from '../../src/llms/manager'
const { emitEvent } = useEventBus()

// Unmock EventBus for this test - scratchpad needs real event handling

vi.mock('../../src/llms/manager.ts', async () => {
  const LlmManager = vi.fn()
  LlmManager.prototype.initModels = vi.fn()
  LlmManager.prototype.isEngineReady = vi.fn(() => true)
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

vi.mock('../../src/services/i18n', async () => {
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
  expect(wrapper.vm.undoStack).toHaveLength(0)
  expect(wrapper.vm.redoStack).toHaveLength(0)
})

test('Sends prompt and sets modified', async () => {
  const wrapper: VueWrapper<any> = mount(ScratchPad)
  await wrapper.vm.prompt.$emit('prompt', { prompt: 'Hello LLM' })
  await vi.waitUntil(async () => !wrapper.vm.processing)
  expect(wrapper.findComponent(EditableText).text()).toBe('[{"role":"system","content":"instructions.scratchpad.system_fr-FR"},{"role":"user","content":"Hello LLM"},{"role":"assistant","content":"Be kind. Don\'t mock me"}]')
  expect(wrapper.vm.modified).toBe(true)
})

test('Sends system prompt with params', async () => {
  const wrapper: VueWrapper<any> = mount(ScratchPad)
  await wrapper.vm.prompt.$emit('prompt', { prompt: 'Hello LLM', attachments: [ new Attachment('file', 'text/plain') ], expert: store.experts[0] })
  await vi.waitUntil(async () => !wrapper.vm.processing)
  expect(wrapper.findComponent(EditableText).text()).toBe('[{"role":"system","content":"instructions.scratchpad.system_fr-FR"},{"role":"user","content":"expert_uuid1_prompt\\nHello LLM (file)"},{"role":"assistant","content":"Be kind. Don\'t mock me"}]')
  expect(wrapper.vm.modified).toBe(true)
})

test('Sends user prompt with params', async () => {
  const wrapper: VueWrapper<any> = mount(ScratchPad)
  await wrapper.vm.prompt.$emit('prompt', { prompt: 'Hello LLM', attachments: [ new Attachment('file', 'text/plain') ], expert: store.experts[2] })
  await vi.waitUntil(async () => !wrapper.vm.processing)
  expect(wrapper.findComponent(EditableText).text()).toBe('[{"role":"system","content":"instructions.scratchpad.system_fr-FR"},{"role":"user","content":"prompt3\\nHello LLM (file)"},{"role":"assistant","content":"Be kind. Don\'t mock me"}]')
  expect(wrapper.vm.modified).toBe(true)
})

test('Clears chat', async () => {
  const wrapper: VueWrapper<any> = mount(ScratchPad)
  await wrapper.vm.prompt.$emit('prompt', { prompt: 'Hello LLM' })
  await vi.waitUntil(async () => !wrapper.vm.processing)
  expect(wrapper.findComponent(EditableText).text()).not.toBe('')
  vi.mocked(Dialog.show).mockResolvedValueOnce({ isDismissed: true })
  emitEvent('action', 'clear')
  await vi.waitUntil(async () => !wrapper.vm.modified)
  expect(wrapper.findComponent(EditableText).text()).toBe('scratchpad.placeholder_en-US')
})

test('Undo/redo', async () => {
  const wrapper: VueWrapper<any> = mount(ScratchPad)
  await wrapper.vm.prompt.$emit('prompt', { prompt: 'Hello LLM' })
  await vi.waitUntil(async () => !wrapper.vm.processing)
  expect(wrapper.vm.undoStack).toHaveLength(1)
  expect(wrapper.vm.redoStack).toHaveLength(0)
  emitEvent('action', 'undo')
  await vi.waitUntil(async () => wrapper.vm.undoStack.length === 0)
  expect(wrapper.findComponent(EditableText).text()).toBe('scratchpad.placeholder_en-US')
  expect(wrapper.vm.undoStack).toHaveLength(0)
  expect(wrapper.vm.redoStack).toHaveLength(1)
  emitEvent('action', 'redo')
  await vi.waitUntil(async () => wrapper.vm.redoStack.length === 0)
  expect(wrapper.findComponent(EditableText).text()).toBe('[{"role":"system","content":"instructions.scratchpad.system_fr-FR"},{"role":"user","content":"Hello LLM"},{"role":"assistant","content":"Be kind. Don\'t mock me"}]')
  expect(wrapper.vm.undoStack).toHaveLength(1)
  expect(wrapper.vm.redoStack).toHaveLength(0)
})

test('Loads chat', async () => {
  const wrapper: VueWrapper<any> = mount(ScratchPad)
  emitEvent('action', 'load')
  await vi.waitUntil(async () => wrapper.vm.fileUrl)
  expect(wrapper.findComponent(EditableText).text()).toBe('Hello LLM')
})

test('Saves chat', async () => {
  const wrapper: VueWrapper<any> = mount(ScratchPad)
  await wrapper.vm.prompt.$emit('prompt', { prompt: 'Hello LLM' })
  await vi.waitUntil(async () => !wrapper.vm.processing)
  emitEvent('action', 'save')
  expect(window.api.file.save).toHaveBeenCalled()
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