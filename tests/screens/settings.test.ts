
import { vi, beforeAll, beforeEach, afterAll, expect, test } from 'vitest'
import { mount, VueWrapper, enableAutoUnmount } from '@vue/test-utils'
import { store } from '../../src/services/store'
import Settings from '../../src/screens/Settings.vue'
import defaults from '../../defaults/settings.json'
import { availableEngines } from '../../src/services/llm'

import useEventBus from '../../src/composables/useEventBus'
const { emitEvent } = useEventBus()

enableAutoUnmount(afterAll)

HTMLDialogElement.prototype.showModal = vi.fn()
HTMLDialogElement.prototype.close = vi.fn()

vi.mock('../../src/services/store.ts', async (importOriginal) => {
  const mod: any = await importOriginal()
  return {
    clone: mod.clone,
    store: {
      ...mod.store,
      commands: require('../../defaults/commands.json'),
      saveSettings: vi.fn()
    }
  }
})

let wrapper: VueWrapper<any>

const tabs = [
  'settingsGeneral',
  'settingsAppearance',
  'settingsCommands',
  'settingsPrompts',
  'settingsShortcuts',
  'settingsLLM',
  'settingsPlugins',
  'settingsTTS',
  'settingsAdvanced',
]

const switchToTab = async (i: number): Promise<Omit<VueWrapper<any, any>, 'exists'>> => {
  await wrapper.find(`.tabs .tab:nth-child(${i+1})`).trigger('click')
  return getTab(i)
}

const getTab = (i: number): Omit<VueWrapper<any, any>, 'exists'> => {
  return wrapper.getComponent({ ref: tabs[i] })
}
  
const checkVisibility = (visible: number) => {
  for (let i=0; i<tabs.length; i++) {
    const display = i === visible ? 'block' : 'none'
    expect(getTab(i).attributes().style).toMatch(new RegExp(`display: ${display}`))
  }
}

// window
let runAtLogin = false
window.api = {
  platform: 'darwin',
  on: vi.fn(),
  runAtLogin: {
    get: () => runAtLogin,
    set: vi.fn((state) => {
      runAtLogin = state
    })
  },
}

beforeAll(() => {

  // init store
  store.config = defaults

  // wrapper
  document.body.innerHTML = `<dialog id="settings"></dialog>`
  wrapper = mount(Settings, { attachTo: '#settings' })
  emitEvent('openSettings')
  expect(HTMLDialogElement.prototype.showModal).toHaveBeenCalledOnce()
})

beforeEach(() => {
  vi.clearAllMocks()
})

test('Settings renders correctly', () => {
  expect(wrapper.exists()).toBe(true)
  expect(wrapper.props('initialTab')).toBe('general')
  checkVisibility(0)
})

for (let i=1; i<tabs.length; i++) {
  test(`Settings switch to tab #${i}`, async () => {
    switchToTab(i)
    checkVisibility(i)
    expect(wrapper.getComponent({ ref: tabs[i] }).find('.group')).not.toBeNull()
  })
}

test('Settings close', async () => {
  await wrapper.find('.settings header .windows').trigger('click')
  expect(HTMLDialogElement.prototype.close).toHaveBeenCalledOnce()
})

test('Settings General', async () => {
  
  const tab = await switchToTab(0)
  expect(tab.findAll('.group')).toHaveLength(6)
  
  expect(store.config.llm.engine).not.toBe('anthropic')
  expect(tab.findAll('.group.engine select option')).toHaveLength(availableEngines.length)
  tab.find('.group.engine select').setValue('anthropic')
  expect(store.config.llm.engine).toBe('anthropic')
  expect(window.api.runAtLogin.set).toHaveBeenCalledOnce()
  expect(store.saveSettings).toHaveBeenCalledOnce()
  vi.clearAllMocks()

  expect(store.config.general.language).not.toBe('es')
  expect(tab.findAll('.group.language select option')).toHaveLength(22)
  tab.find('.group.language select').setValue('es')
  expect(store.config.general.language).toBe('es')
  expect(window.api.runAtLogin.set).toHaveBeenCalledOnce()
  expect(store.saveSettings).toHaveBeenCalledOnce()
  vi.clearAllMocks()

  expect(window.api.runAtLogin.get()).not.toBe(true)
  tab.find('.group.run-at-login input').setValue('true')
  expect(window.api.runAtLogin.get()).toBe(true)
  expect(window.api.runAtLogin.set).toHaveBeenCalledOnce()
  expect(store.saveSettings).toHaveBeenCalledOnce()
  vi.clearAllMocks()

  expect(store.config.general.hideOnStartup).not.toBe(true)
  tab.find('.group.hide-on-startup input').setValue(true)
  expect(store.config.general.hideOnStartup).toBe(true)
  expect(window.api.runAtLogin.set).toHaveBeenCalledOnce()
  expect(store.saveSettings).toHaveBeenCalledOnce()
  vi.clearAllMocks()

  expect(store.config.general.keepRunning).not.toBe(false)
  tab.find('.group.keep-running input').setValue(false)
  expect(store.config.general.keepRunning).toBe(false)
  expect(window.api.runAtLogin.set).toHaveBeenCalledOnce()
  expect(store.saveSettings).toHaveBeenCalledOnce()
  vi.clearAllMocks()

})

test('Settings Appearance', async () => {
  
  const tab = await switchToTab(1)
  expect(tab.findAll('.group')).toHaveLength(2)

  expect(store.config.appearance.chat.theme).not.toBe('conversation')
  tab.find('.group.theme select').setValue('conversation')
  expect(store.config.appearance.chat.theme).toBe('conversation')
  expect(store.saveSettings).toHaveBeenCalledOnce()
  vi.clearAllMocks()

  expect(store.config.appearance.chat.fontSize).not.toBe('2')
  tab.find('.group.font-size input').setValue('2')
  expect(store.config.appearance.chat.fontSize).toBe('2')
  expect(store.saveSettings).toHaveBeenCalledOnce()
  vi.clearAllMocks()

})

test('Settings Advanced', async () => {
  
  const tab = await switchToTab(8)
  expect(tab.findAll('.group')).toHaveLength(3)

  expect(store.config.llm.autoVisionSwitch).not.toBe(false)
  tab.find('.group.vision input').setValue(false)
  expect(store.config.llm.autoVisionSwitch).toBe(false)
  expect(store.saveSettings).toHaveBeenCalledOnce()
  vi.clearAllMocks()

  expect(store.config.llm.conversationLength).not.toBe(1)
  tab.find('.group.length select').setValue(1)
  expect(store.config.llm.conversationLength).toBe(1)
  expect(store.saveSettings).toHaveBeenCalledOnce()
  vi.clearAllMocks()

  expect(store.config.instructions.default).not.toBe('bot')
  tab.find('.group.instruction textarea').setValue('bot')
  expect(store.config.instructions.default).toBe('bot')
  expect(store.saveSettings).toHaveBeenCalledOnce()
  vi.clearAllMocks()

  // await tab.find('.group.instruction a').trigger('click')
  // expect(store.config.instructions.default).not.toBe('bot')
  // expect(store.saveSettings).toHaveBeenCalledOnce()
  // vi.clearAllMocks()

})
