
import { vi, beforeAll, beforeEach, expect, test, afterEach } from 'vitest'
import { enableAutoUnmount, mount } from '@vue/test-utils'
import { useWindowMock, useNavigatorMock } from '../mocks/window'
import { store } from '../../src/services/store'
import CommandResult from '../../src/screens/CommandResult.vue'
import MessageItem from '../../src/components/MessageItem.vue'
import Generator from '../../src/services/generator'
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
  Generator.addDateAndTimeToSystemInstr = false
  useNavigatorMock()
  useWindowMock()
  store.loadExperts()
})

beforeEach(() => {
  vi.clearAllMocks()
})

test('Renders correctly', () => {
  const wrapper = mount(CommandResult)
  expect(wrapper.exists()).toBe(true)
  expect(wrapper.find('.command').exists()).toBe(true)
  expect(wrapper.find('.response').exists()).toBe(false)
  expect(wrapper.findComponent(MessageItem).exists()).toBe(false)
})

test('Initalizes LLM and chat', async () => {
  const wrapper = mount(CommandResult)
  wrapper.vm.processQueryParams({ promptId: '1', engine: 'mock', model: 'chat' })
  await wrapper.vm.$nextTick()
  expect(wrapper.vm.llm).toBeDefined()
  expect(wrapper.vm.llm.getName()).toBe('mock')
  expect(wrapper.vm.chat).toBeDefined()
})

test('Closes when click on container', async () => {
  const wrapper = mount(CommandResult)
  wrapper.find('.container').trigger('mousedown')
  wrapper.find('.container').trigger('mouseup')
  expect(window.api.commands.closeResult).toHaveBeenCalled()
})

test('Renders response', async () => {
  const wrapper = mount(CommandResult)
  wrapper.vm.response = new Message('assistant', 'This is a response')
  await wrapper.vm.$nextTick()
  expect(wrapper.find('.response').exists()).toBe(true)
  expect(wrapper.findComponent(MessageItem).exists()).toBe(true)
})

test('Submits prompt', async () => {
  const wrapper = mount(CommandResult)
  wrapper.vm.processQueryParams({ promptId: '1', engine: 'mock', model: 'chat' })
  await vi.waitUntil(async () => !wrapper.vm.chat.lastMessage().transient)
  expect(wrapper.findComponent(MessageItem).text()).toBe('[{"role":"system","content":"You are an AI assistant designed to assist users by providing accurate information, answering questions, and offering helpful suggestions. Your main objectives are to understand the user\'s needs, communicate clearly, and provide responses that are informative, concise, and relevant."},{"role":"user","content":"text"},{"role":"assistant","content":"Be kind. Don\'t mock me"}]')
})

test('Copies response', async () => {
  const wrapper = mount(CommandResult)
  wrapper.vm.response = new Message('assistant', 'This is a response')
  await wrapper.vm.$nextTick()
  wrapper.find('.copy').trigger('click')
  expect(window.api.clipboard.writeText).toHaveBeenCalledWith('This is a response')
})

test('Inserts response', async () => {
  const wrapper = mount(CommandResult)
  wrapper.vm.response = new Message('assistant', 'This is a response')
  await wrapper.vm.$nextTick()
  wrapper.find('.insert').trigger('click')
  expect(window.api.automation.insert).toHaveBeenCalledWith('This is a response')
})

test('Closes when click on icon', async () => {
  const wrapper = mount(CommandResult)
  wrapper.vm.response = new Message('assistant', 'This is a response')
  await wrapper.vm.$nextTick()
  wrapper.find('.close').trigger('click')
  expect(window.api.commands.closeResult).toHaveBeenCalledWith()
})

test('Supports keyboard copy', async () => {
  const wrapper = mount(CommandResult)
  wrapper.vm.response = new Message('assistant', 'This is a response')
  await wrapper.vm.$nextTick()
  document.dispatchEvent(new KeyboardEvent('keydown', { metaKey: true, key: 'c' }));
  expect(window.api.clipboard.writeText).toHaveBeenCalledTimes(1)
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'c' }));
  expect(window.api.clipboard.writeText).toHaveBeenCalledTimes(2)
})

test('Supports keyboard insert', async () => {
  const wrapper = mount(CommandResult)
  wrapper.vm.response = new Message('assistant', 'This is a response')
  await wrapper.vm.$nextTick()
  document.dispatchEvent(new KeyboardEvent('keydown', { metaKey: true, key: 'i' }));
  expect(window.api.automation.insert).toHaveBeenCalledTimes(1)
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'i' }));
  expect(window.api.automation.insert).toHaveBeenCalledTimes(2)
})

test('Supports keyboard replace', async () => {
  const wrapper = mount(CommandResult)
  wrapper.vm.response = new Message('assistant', 'This is a response')
  await wrapper.vm.$nextTick()
  document.dispatchEvent(new KeyboardEvent('keydown', { metaKey: true, key: 'r' }));
  expect(window.api.automation.replace).toHaveBeenCalledTimes(1)
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'r' }));
  expect(window.api.automation.replace).toHaveBeenCalledTimes(2)
})

test('Supports keyboard close', async () => {
  const wrapper = mount(CommandResult)
  wrapper.vm.response = new Message('assistant', 'This is a response')
  await wrapper.vm.$nextTick()
  document.dispatchEvent(new KeyboardEvent('keyup', { key: 'Escape' }));
  expect(window.api.commands.closeResult).toHaveBeenCalled()
})
