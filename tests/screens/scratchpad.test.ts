
import { vi, beforeAll, beforeEach, expect, test, afterEach } from 'vitest'
import { enableAutoUnmount, mount } from '@vue/test-utils'
import { store } from '../../src/services/store'
import defaultSettings from '../../defaults/settings.json'
import ScratchPad from '../../src/screens/ScratchPad.vue'
import Prompt from '../../src/components/Prompt.vue'
import EditableText from '../../src/components/EditableText.vue'
import Toolbar from '../../src/scratchpad/Toolbar.vue'
import ActionBar from '../../src/scratchpad/ActionBar.vue'
import LlmMock from '../mocks/llm'

import useEventBus  from '../../src/composables/event_bus'
const { emitEvent } = useEventBus()

// mock llm
vi.mock('../../src/llms/llm.ts', async () => {
  const LlmFactory = vi.fn()
  LlmFactory.prototype.initModels = vi.fn()
  LlmFactory.prototype.isEngineReady = vi.fn(() => true)
  LlmFactory.prototype.getChatEngineModel = () => ({ engine: 'mock', model: 'chat' })
  LlmFactory.prototype.igniteEngine = () => new LlmMock(store.config.engines.mock)
	return { default: LlmFactory }
})

enableAutoUnmount(afterEach)

beforeAll(() => {

  // eslint-disable-next-line no-global-assign
  navigator = {
    // @ts-expect-error mock
    mediaDevices: {
      getUserMedia: vi.fn()
    }
  }

  store.chats = []  
  
  window.api = {
    on: vi.fn(),
    off: vi.fn(),
    showDialog: vi.fn(() => Promise.resolve({ response: 1, checkboxChecked: false })),
    clipboard: {
      writeText: vi.fn(),
    },
    config: {
      load: vi.fn(() => JSON.parse(JSON.stringify(defaultSettings))),
      save: vi.fn(),
    },
    file: {
      pick: vi.fn(() => { return {
        contents: '{ "contents": { "content": "Hello LLM" }, "undoStack": [], "redoStack": [] }',
        url: 'file://scratchpad.json',
      }}),
      save: vi.fn(),
    },
    base64: {
      decode: vi.fn((s) => s),
      encode: vi.fn((s) => s),
    }
  }
})

beforeEach(() => {
  vi.clearAllMocks()
})

test('Renders correctly', () => {
  const wrapper = mount(ScratchPad)
  expect(wrapper.exists()).toBe(true)
  expect(wrapper.find('.scratchpad').exists()).toBe(true)
  expect(wrapper.findComponent(Toolbar).exists()).toBe(true)
  expect(wrapper.findComponent(EditableText).exists()).toBe(true)
  expect(wrapper.findComponent(ActionBar).exists()).toBe(true)
  expect(wrapper.findComponent(Prompt).exists()).toBe(true)
  expect(wrapper.findComponent(EditableText).text()).toBe('Start typing your document orask Witsy to write something for you!Once you started you can ask Witsyto make modification on your document.If you highligh a portion of your text,Witsy will only update this portion.Also check out the Writing Assistantin the action bar in the lower right corner!Give it a go!')
})

test('Initalizes correctly', async () => {
  const wrapper = mount(ScratchPad)
  expect(wrapper.vm.llm).toBeDefined()
  expect(wrapper.vm.llm.getName()).toBe('mock')
  expect(wrapper.vm.chat.messages).toHaveLength(1)
  expect(wrapper.vm.editor.value).not.toBeNull()
  expect(wrapper.vm.undoStack).toHaveLength(0)
  expect(wrapper.vm.redoStack).toHaveLength(0)
})

test('Sends prompt and sets modified', async () => {
  const wrapper = mount(ScratchPad)
  emitEvent('send-prompt', { prompt: 'Hello LLM' })
  await vi.waitUntil(async () => !wrapper.vm.processing)
  expect(wrapper.findComponent(EditableText).text()).toBe('[{"role":"system","content":"You are helping someone write a DOCUMENT. You need to answer to the ask below on the EXTRACT below. Do not use previous versions of the DOCUMENT or EXTRACT in our conversation. Just reply with the updated EXTRACT based on the ask. Preserve empty lines. Do not wrap responses in quotes. Do not include the initial or previous version of the DOCUMENT or EXTRACT. Do not include the word EXTRACT. Do not use Markdown syntax such as \'## Title ##\' or \'** Text **\'. Do not include anything else in the response including things like \'here is the...\'"},{"role":"user","content":"Hello LLM"},{"role":"assistant","content":"Be kind. Don\'t mock me"}]')
  expect(wrapper.vm.modified).toBe(true)
})

test('Clears chat', async () => {
  const wrapper = mount(ScratchPad)
  emitEvent('send-prompt', { prompt: 'Hello LLM' })
  await vi.waitUntil(async () => !wrapper.vm.processing)
  expect(wrapper.findComponent(EditableText).text()).not.toBe('')
  emitEvent('action', 'clear')
  await vi.waitUntil(async () => !wrapper.vm.modified)
  expect(wrapper.findComponent(EditableText).text()).toBe('Start typing your document orask Witsy to write something for you!Once you started you can ask Witsyto make modification on your document.If you highligh a portion of your text,Witsy will only update this portion.Also check out the Writing Assistantin the action bar in the lower right corner!Give it a go!')
})

test('Undo/redo', async () => {
  const wrapper = mount(ScratchPad)
  emitEvent('send-prompt', { prompt: 'Hello LLM' })
  await vi.waitUntil(async () => !wrapper.vm.processing)
  expect(wrapper.vm.undoStack).toHaveLength(1)
  expect(wrapper.vm.redoStack).toHaveLength(0)
  emitEvent('action', 'undo')
  await vi.waitUntil(async () => wrapper.vm.undoStack.length === 0)
  expect(wrapper.findComponent(EditableText).text()).toBe('Start typing your document orask Witsy to write something for you!Once you started you can ask Witsyto make modification on your document.If you highligh a portion of your text,Witsy will only update this portion.Also check out the Writing Assistantin the action bar in the lower right corner!Give it a go!')
  expect(wrapper.vm.undoStack).toHaveLength(0)
  expect(wrapper.vm.redoStack).toHaveLength(1)
  emitEvent('action', 'redo')
  await vi.waitUntil(async () => wrapper.vm.redoStack.length === 0)
  expect(wrapper.findComponent(EditableText).text()).toBe('[{"role":"system","content":"You are helping someone write a DOCUMENT. You need to answer to the ask below on the EXTRACT below. Do not use previous versions of the DOCUMENT or EXTRACT in our conversation. Just reply with the updated EXTRACT based on the ask. Preserve empty lines. Do not wrap responses in quotes. Do not include the initial or previous version of the DOCUMENT or EXTRACT. Do not include the word EXTRACT. Do not use Markdown syntax such as \'## Title ##\' or \'** Text **\'. Do not include anything else in the response including things like \'here is the...\'"},{"role":"user","content":"Hello LLM"},{"role":"assistant","content":"Be kind. Don\'t mock me"}]')
  expect(wrapper.vm.undoStack).toHaveLength(1)
  expect(wrapper.vm.redoStack).toHaveLength(0)
})

test('Loads chat', async () => {
  const wrapper = mount(ScratchPad)
  emitEvent('action', 'load')
  await vi.waitUntil(async () => wrapper.vm.fileUrl)
  expect(wrapper.findComponent(EditableText).text()).toBe('Hello LLM')
})

test('Saves chat', async () => {
  const wrapper = mount(ScratchPad)
  emitEvent('send-prompt', { prompt: 'Hello LLM' })
  await vi.waitUntil(async () => !wrapper.vm.processing)
  emitEvent('action', 'save')
  expect(window.api.file.save).toHaveBeenCalled()
})

test('Sets engine', async () => {
  const wrapper = mount(ScratchPad)
  emitEvent('action', { type: 'llm', value: { engine: 'openai', model: 'chat' }})
  expect(wrapper.vm.chat.engine).toBe('openai')
  expect(wrapper.vm.chat.model).toBe('chat')
})

test('Replaces selection', async () => {
  const wrapper = mount(ScratchPad)
  wrapper.vm.editor.setContent({ content: 'Hello SELECTED LLM', start: 6, end: 14})
  emitEvent('send-prompt', { prompt: 'Hello LLM' })
  await vi.waitUntil(async () => !wrapper.vm.chat.lastMessage().transient)
  expect(wrapper.findComponent(EditableText).text()).toBe('Hello [{"role":"system","content":"You are helping someone write a DOCUMENT. You need to answer to the ask below on the EXTRACT below. Do not use previous versions of the DOCUMENT or EXTRACT in our conversation. Just reply with the updated EXTRACT based on the ask. Preserve empty lines. Do not wrap responses in quotes. Do not include the initial or previous version of the DOCUMENT or EXTRACT. Do not include the word EXTRACT. Do not use Markdown syntax such as \'## Title ##\' or \'** Text **\'. Do not include anything else in the response including things like \'here is the...\'"},{"role":"user","content":"EXTRACT:\\nSELECTED\\n\\nASK: Hello LLM"},{"role":"assistant","content":"Be kind. Don\'t mock me"}] LLM')
})

test('Copies text', async () => {
  const wrapper = mount(ScratchPad)
  wrapper.vm.editor.setContent({ content: 'Hello LLM', start: -1, end: -1})
  emitEvent('action', 'copy')
  expect(window.api.clipboard.writeText).toHaveBeenCalledWith('Hello LLM')
})

// test('Reads text', async () => {
//   const wrapper = mount(ScratchPad)
//   wrapper.vm.editor.setContent({ content: 'Hello LLM', start: -1, end: -1})
//   emitEvent('action', 'read')
// })

for (const action of ['spellcheck', 'improve', 'takeaways', 'title', 'simplify', 'expand']) {
  test(`Runs action ${action}`, async () => {
    const wrapper = mount(ScratchPad)
    wrapper.vm.editor.setContent({ content: 'Hello LLM', start: -1, end: -1})
    emitEvent('action', { type: 'magic', value: action } )
    await vi.waitUntil(async () => !wrapper.vm.processing)
    expect(wrapper.findComponent(EditableText).text()).toContain(defaultSettings.instructions.scratchpad[action])
  })
}
