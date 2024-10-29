
import { vi, expect, test, beforeAll, afterAll } from 'vitest'
import { enableAutoUnmount, mount } from '@vue/test-utils'
import App from '../../src/App.vue'
import Main from '../../src/screens/Main.vue'
import Wait from '../../src/screens/Wait.vue'
import Commands from '../../src/screens/Commands.vue'
import PromptAnywhere from '../../src/screens/PromptAnywhere.vue'
import defaults from '../../defaults/settings.json'

enableAutoUnmount(afterAll)

beforeAll(() => {

  // eslint-disable-next-line no-global-assign
  navigator = {
    // @ts-expect-error mock
    mediaDevices: {
      getUserMedia: vi.fn()
    }
  }
  
  window.api = {
    on: vi.fn(),
    off: vi.fn(),
    listFonts: vi.fn(() => []),
    config: {
      load: vi.fn(() => JSON.parse(JSON.stringify(defaults))),
      save: vi.fn(),
    },
    store: {
      get: vi.fn(() => null),
    },
    commands: {
      load: vi.fn(() => []),
      isPromptEditable: vi.fn(() => true)
    },
    experts: {
      load: vi.fn(() => []),
    },
    history: {
      load: vi.fn(() => []),
    },
    docrepo: {
      list: vi.fn(() => []),
    },
    nestor: {
      isAvailable: vi.fn(() => false),
    }
  }

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
  window.location = new URL('http://localhost/#/command')
  const wrapper = mount(App)
  expect(wrapper.findComponent(Commands).exists()).toBe(true)
})

test('Renders PromptAnywhere', () => {
  // @ts-expect-error no-other-way
  window.location = new URL('http://localhost/#/prompt')
  const wrapper = mount(App)
  expect(wrapper.findComponent(PromptAnywhere).exists()).toBe(true)
})

test('Transmits query params', () => {
  // @ts-expect-error no-other-way
  window.location = new URL('http://localhost/?textId=6#/command')
  const wrapper = mount(App)
  expect(wrapper.findComponent(Commands).props().extra.textId).toBe('6')
})
