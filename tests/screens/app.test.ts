
import { expect, test, beforeAll, afterAll } from 'vitest'
import { enableAutoUnmount, mount } from '@vue/test-utils'
import { useWindowMock, useBrowserMock } from '../mocks/window'
import App from '../../src/App.vue'
import Main from '../../src/screens/Main.vue'
import CommandPicker from '../../src/screens/CommandPicker.vue'
import PromptAnywhere from '../../src/screens/PromptAnywhere.vue'
import RealtimeChat from '../../src/screens/RealtimeChat.vue'
import Transcribe from '../../src/screens/Transcribe.vue'
import ReadAloud from '../../src/screens/ReadAloud.vue'

enableAutoUnmount(afterAll)

beforeAll(() => {
  useBrowserMock()
  useWindowMock()
})

test('Renders correctly', () => {
  // @ts-expect-error no-other-way
  window.location = new URL('http://localhost/')
  mount(App)
})

test('Renders Main', () => {
  // @ts-expect-error no-other-way
  window.location = new URL('http://localhost/')
  const wrapper = mount(App)
  expect(wrapper.findComponent(Main).exists()).toBe(true)
})

test('Renders Commands', () => {
  // @ts-expect-error no-other-way
  window.location = new URL('http://localhost/#/commands')
  const wrapper = mount(App)
  expect(wrapper.findComponent(CommandPicker).exists()).toBe(true)
})

test('Transmits commands query params', () => {
  // @ts-expect-error no-other-way
  window.location = new URL('http://localhost/?textId=6#/commands')
  const wrapper = mount(App)
  expect(wrapper.findComponent<any>(CommandPicker).vm.showParams.textId).toBe('6')
})

test('Renders PromptAnywhere', () => {
  // @ts-expect-error no-other-way
  window.location = new URL('http://localhost/#/prompt')
  const wrapper = mount(App)
  expect(wrapper.findComponent(PromptAnywhere).exists()).toBe(true)
})

test('Transmits prompt query params', () => {
  // @ts-expect-error no-other-way
  window.location = new URL('http://localhost/?textId=6#/prompt')
  const wrapper = mount(App)
  expect(wrapper.findComponent(PromptAnywhere).props().extra?.textId).toBe('6')
})

test('Renders scratchpad', () => {
  // Scratchpad is now part of Main window, not a separate route
  // @ts-expect-error no-other-way
  window.location = new URL('http://localhost/#/')
  const wrapper = mount(App)
  expect(wrapper.findComponent(Main).exists()).toBe(true)
})

test('Renders realtime chat', () => {
  // @ts-expect-error no-other-way
  window.location = new URL('http://localhost/#/realtime')
  const wrapper = mount(App)
  expect(wrapper.findComponent(RealtimeChat).exists()).toBe(true)
})

test('Renders transcriber', () => {
  // @ts-expect-error no-other-way
  window.location = new URL('http://localhost/#/transcribe')
  const wrapper = mount(App)
  expect(wrapper.findComponent(Transcribe).exists()).toBe(true)
})

test('Renders readaloud', () => {
  // @ts-expect-error no-other-way
  window.location = new URL('http://localhost/#/readaloud')
  const wrapper = mount(App)
  expect(wrapper.findComponent(ReadAloud).exists()).toBe(true)
})