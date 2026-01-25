
import { expect, test, beforeAll, afterAll } from 'vitest'
import { enableAutoUnmount, mount } from '@vue/test-utils'
import { useWindowMock, useBrowserMock } from '@tests/mocks/window'
import { store } from '@services/store'
import App from '@renderer/App.vue'
import Main from '@screens/Main.vue'
import CommandPicker from '@screens/CommandPicker.vue'
import PromptAnywhere from '@screens/PromptAnywhere.vue'
import RealtimeChat from '@screens/RealtimeChat.vue'
import Dictation from '@screens/Dictation.vue'
import ReadAloud from '@screens/ReadAloud.vue'

enableAutoUnmount(afterAll)

beforeAll(() => {
  useBrowserMock()
  useWindowMock()
  store.loadSettings()
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

test('Renders dictation', () => {
  // @ts-expect-error no-other-way
  window.location = new URL('http://localhost/#/dictation')
  const wrapper = mount(App)
  expect(wrapper.findComponent(Dictation).exists()).toBe(true)
})

test('Renders readaloud', () => {
  // @ts-expect-error no-other-way
  window.location = new URL('http://localhost/#/readaloud')
  const wrapper = mount(App)
  expect(wrapper.findComponent(ReadAloud).exists()).toBe(true)
})