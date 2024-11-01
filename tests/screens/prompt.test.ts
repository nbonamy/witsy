
import { vi, beforeAll, beforeEach, expect, test, afterEach } from 'vitest'
import { enableAutoUnmount, mount } from '@vue/test-utils'
import { renderMarkdown } from '../../src/main/markdown'
import { store } from '../../src/services/store'
import Prompt from '../../src/components/Prompt.vue'
import PromptAnywhere from '../../src/screens/PromptAnywhere.vue'
import MessageItem from '../../src/components/MessageItem.vue'
import defaultSettings from '../../defaults/settings.json'
import Message from '../../src/models/message'
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
    clipboard: {
      writeText: vi.fn(),
    },
    config: {
      load: vi.fn(() => JSON.parse(JSON.stringify(defaultSettings))),
    },
    history: {
      load: vi.fn(() => []),
      save: vi.fn(),
    },
    commands: {
      load: vi.fn(() => []),
    },
    experts: {
      load: vi.fn(() => []),
    },
    anywhere: {
      prompt: vi.fn(),
      insert: vi.fn(),
      continue: vi.fn(),
      cancel: vi.fn(),
    },
    markdown: {
      render: renderMarkdown
    }
  }
})

beforeEach(() => {
  vi.clearAllMocks()
})

test('Renders correctly', () => {
  const wrapper = mount(PromptAnywhere)
  expect(wrapper.exists()).toBe(true)
  expect(wrapper.find('.anywhere').exists()).toBe(true)
  expect(wrapper.findComponent(Prompt).exists()).toBe(true)
  expect(wrapper.find('.response').exists()).toBe(false)
  expect(wrapper.findComponent(MessageItem).exists()).toBe(false)
})

test('Initalizes LLM and chat', async () => {
  const wrapper = mount(PromptAnywhere)
  wrapper.vm.onShow()
  await wrapper.vm.$nextTick()
  expect(wrapper.vm.llm).toBeDefined()
  expect(wrapper.vm.llm.getName()).toBe('mock')
  expect(wrapper.vm.chat.messages).toHaveLength(1)
})

test('Closes when click on container', async () => {
  const wrapper = mount(PromptAnywhere)
  wrapper.find('.container').trigger('click')
  expect(window.api.anywhere.cancel).toHaveBeenCalledWith()
})

// test('Closes on Escape', async () => {
//   const wrapper = mount(PromptAnywhere)
//   await wrapper.trigger('keyup.esc')
//   expect(window.api.anywhere.cancel).toHaveBeenCalled()
// })

test('Renders response', async () => {
  const wrapper = mount(PromptAnywhere)
  wrapper.vm.response = new Message('assistant', 'This is a response')
  await wrapper.vm.$nextTick()
  expect(wrapper.find('.response').exists()).toBe(true)
  expect(wrapper.findComponent(MessageItem).exists()).toBe(true)
})

test('Submits prompt', async () => {
  const wrapper = mount(PromptAnywhere)
  wrapper.vm.onShow()
  await wrapper.vm.$nextTick()
  emitEvent('send-prompt', { prompt: 'Hello LLM' })
  await vi.waitUntil(async () => !wrapper.vm.chat.lastMessage().transient)
  expect(wrapper.findComponent(MessageItem).text()).toBe('[{"role":"system","content":"You are a helpful assistant. You are here to help the user with any questions they have."},{"role":"user","content":"Hello LLM"},{"role":"assistant","content":"Be kind. Don\'t mock me"}]')
})

test('Copies response', async () => {
  const wrapper = mount(PromptAnywhere)
  wrapper.vm.response = new Message('assistant', 'This is a response')
  await wrapper.vm.$nextTick()
  wrapper.find('.copy').trigger('click')
  expect(window.api.clipboard.writeText).toHaveBeenCalledWith('This is a response')
})

test('Inserts response', async () => {
  const wrapper = mount(PromptAnywhere)
  wrapper.vm.response = new Message('assistant', 'This is a response')
  await wrapper.vm.$nextTick()
  wrapper.find('.insert').trigger('click')
  expect(window.api.anywhere.insert).toHaveBeenCalledWith('This is a response')
})

test('Closes when click on icon', async () => {
  const wrapper = mount(PromptAnywhere)
  wrapper.vm.response = new Message('assistant', 'This is a response')
  await wrapper.vm.$nextTick()
  wrapper.find('.close').trigger('click')
  expect(window.api.anywhere.cancel).toHaveBeenCalledWith()
})

test('Manages conversation', async () => {
  const wrapper = mount(PromptAnywhere)
  wrapper.vm.onShow()
  await wrapper.vm.$nextTick()
  emitEvent('send-prompt', { prompt: 'Hello LLM' })
  await vi.waitUntil(async () => !wrapper.vm.chat.lastMessage().transient)
  expect(wrapper.findComponent(MessageItem).text()).toBe('[{"role":"system","content":"You are a helpful assistant. You are here to help the user with any questions they have."},{"role":"user","content":"Hello LLM"},{"role":"assistant","content":"Be kind. Don\'t mock me"}]')
  emitEvent('send-prompt', { prompt: 'Bye LLM' })
  await vi.waitUntil(async () => !wrapper.vm.chat.lastMessage().transient)
  expect(wrapper.findComponent(MessageItem).text()).toBe('[{"role":"system","content":"You are a helpful assistant. You are here to help the user with any questions they have."},{"role":"user","content":"Hello LLM"},{"role":"assistant","content":"[{"role":"system","content":"You are a helpful assistant. You are here to help the user with any questions they have."},{"role":"user","content":"Hello LLM"},{"role":"assistant","content":"Be kind. Don\'t mock me"}]"},{"role":"user","content":"Bye LLM"},{"role":"assistant","content":"Be kind. Don\'t mock me"}]')
})

test('Resets chat', async () => {
  const wrapper = mount(PromptAnywhere)
  wrapper.vm.onShow()
  await wrapper.vm.$nextTick()
  emitEvent('send-prompt', { prompt: 'Hello LLM' })
  await vi.waitUntil(async () => !wrapper.vm.chat.lastMessage().transient)
  expect(wrapper.findComponent(MessageItem).text()).toBe('[{"role":"system","content":"You are a helpful assistant. You are here to help the user with any questions they have."},{"role":"user","content":"Hello LLM"},{"role":"assistant","content":"Be kind. Don\'t mock me"}]')
  wrapper.find('.clear').trigger('click')
  emitEvent('send-prompt', { prompt: 'Bye LLM' })
  await vi.waitUntil(async () => !wrapper.vm.chat.lastMessage().transient)
  expect(wrapper.findComponent(MessageItem).text()).toBe('[{"role":"system","content":"You are a helpful assistant. You are here to help the user with any questions they have."},{"role":"user","content":"Bye LLM"},{"role":"assistant","content":"Be kind. Don\'t mock me"}]')
})

test('Brings back chat', async () => {
  const wrapper = mount(PromptAnywhere)
  wrapper.vm.onShow()
  await wrapper.vm.$nextTick()
  const chatId = wrapper.vm.chat.uuid
  emitEvent('send-prompt', { prompt: 'Hello LLM' })
  await vi.waitUntil(async () => !wrapper.vm.chat.lastMessage().transient)
  wrapper.find('.close').trigger('click')
  wrapper.vm.onShow()
  expect(wrapper.vm.chat.uuid).toBe(chatId)
})

test('Saves chat', async () => {
  const wrapper = mount(PromptAnywhere)
  wrapper.vm.onShow()
  await wrapper.vm.$nextTick()
  //const chatId = wrapper.vm.chat.uuid
  emitEvent('send-prompt', { prompt: 'Hello LLM' })
  await vi.waitUntil(async () => !wrapper.vm.chat.lastMessage().transient)
  expect(wrapper.vm.chat.title).toBeNull()
  wrapper.find('.continue').trigger('click')
  await wrapper.vm.$nextTick()
  expect(wrapper.vm.chat.title).not.toBeNull()
  expect(store.chats).toHaveLength(1)
  expect(window.api.history.save).toHaveBeenCalled()
  //expect(window.api.anywhere.continue).toHaveBeenCalledWith(chatId)
})

test('Auto saves chat', async () => {
  const wrapper = mount(PromptAnywhere)
  store.config.prompt.autosave = true
  wrapper.vm.onShow()
  await wrapper.vm.$nextTick()
  emitEvent('send-prompt', { prompt: 'Hello LLM' })
  await vi.waitUntil(async () => !wrapper.vm.chat.lastMessage().transient)
  expect(wrapper.vm.chat.title).not.toBeNull()
  expect(store.chats).toHaveLength(1)
  expect(window.api.history.save).toHaveBeenCalled()
})
