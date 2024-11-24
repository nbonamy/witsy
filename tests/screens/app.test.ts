
import { expect, test, beforeAll, afterAll } from 'vitest'
import { enableAutoUnmount, mount } from '@vue/test-utils'
import { useWindowMock, useNavigatorMock } from '../mocks/window'
import App from '../../src/App.vue'
import Main from '../../src/screens/Main.vue'
import Wait from '../../src/screens/Wait.vue'
import CommandPicker from '../../src/screens/CommandPicker.vue'
import PromptAnywhere from '../../src/screens/PromptAnywhere.vue'

enableAutoUnmount(afterAll)

beforeAll(() => {
  useNavigatorMock()
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

test('Renders Wait', () => {
  // @ts-expect-error no-other-way
  window.location = new URL('http://localhost/#/wait')
  const wrapper = mount(App)
  expect(wrapper.findComponent(Wait).exists()).toBe(true)
})

test('Renders Commands', () => {
  // @ts-expect-error no-other-way
  window.location = new URL('http://localhost/#/commands')
  const wrapper = mount(App)
  expect(wrapper.findComponent(CommandPicker).exists()).toBe(true)
})

test('Renders PromptAnywhere', () => {
  // @ts-expect-error no-other-way
  window.location = new URL('http://localhost/#/prompt')
  const wrapper = mount(App)
  expect(wrapper.findComponent(PromptAnywhere).exists()).toBe(true)
})

test('Transmits query params', () => {
  // @ts-expect-error no-other-way
  window.location = new URL('http://localhost/?textId=6#/commands')
  const wrapper = mount(App)
  expect(wrapper.findComponent(CommandPicker).props().extra?.textId).toBe('6')
})
