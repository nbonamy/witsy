
import { mount, VueWrapper } from '@vue/test-utils'
import Settings from '../../src/screens/Settings.vue'
import { vi, beforeAll, beforeEach, afterAll, expect, test } from 'vitest'
import { ipcRenderer } from 'electron'
import { store } from '../../src/services/store'
import defaults from '../../defaults/settings.json'

import useEventBus from '../../src/composables/useEventBus'
const { emitEvent } = useEventBus()

HTMLDialogElement.prototype.showModal = vi.fn()
HTMLDialogElement.prototype.close = vi.fn()

let runAtLogin = false
vi.mock('electron', async (importOriginal) => {
  const mod: any = await importOriginal()
  return {
    ...mod,
    ipcRenderer: {
      send: vi.fn((_, payload) => {
        runAtLogin = payload
      }),
      sendSync: vi.fn(() => {
        return { openAtLogin: runAtLogin }
      }),
    }
  }
})

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
  'settingsShortcuts',
  'settingsLLM',
  'settingsPlugins',
  'settingsTTS',
  'settingsAdvanced',
]

const switchToTab = (i: number): Omit<VueWrapper<any, any>, 'exists'> => {
  wrapper.find(`.tabs .tab:nth-child(${i+1})`).trigger('click')
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

beforeAll(() => {

  // init store
  store.config = defaults

  // wrapper
  document.body.innerHTML = `<dialog id="settings"></dialog>`
  wrapper = mount(Settings, { attachTo: '#settings' })
  emitEvent('openSettings')
})

beforeEach(() => {
  vi.clearAllMocks()
})

afterAll(() => {
  wrapper.unmount()
})

test('Settings renders correctly', () => {
  expect(wrapper.exists()).toBe(true)
  //expect(HTMLDialogElement.prototype.showModal).toHaveBeenCalledOnce()
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
  
  const tab = switchToTab(0)
  expect(tab.findAll('.group')).toHaveLength(4)
  
  expect(store.config.llm.engine).not.toBe('anthropic')
  expect(tab.findAll('.group.engine select option')).toHaveLength(4)
  tab.find('.group.engine select').setValue('anthropic')
  expect(store.config.llm.engine).toBe('anthropic')
  expect(ipcRenderer.send).toHaveBeenCalledOnce()
  expect(store.saveSettings).toHaveBeenCalledOnce()
  vi.clearAllMocks()

  expect(store.config.general.language).not.toBe('es')
  expect(tab.findAll('.group.language select option')).toHaveLength(22)
  tab.find('.group.language select').setValue('es')
  expect(store.config.general.language).toBe('es')
  expect(ipcRenderer.send).toHaveBeenCalledOnce()
  expect(store.saveSettings).toHaveBeenCalledOnce()
  vi.clearAllMocks()

  expect(ipcRenderer.sendSync('get-run-at-login').openAtLogin).not.toBe(true)
  tab.find('.group.run-at-login input').setValue('true')
  expect(ipcRenderer.sendSync('get-run-at-login').openAtLogin).toBe(true)
  expect(ipcRenderer.send).toHaveBeenCalledOnce()
  expect(store.saveSettings).toHaveBeenCalledOnce()
  vi.clearAllMocks()

  expect(store.config.general.keepRunning).not.toBe(false)
  tab.find('.group.keep-running input').setValue(false)
  expect(store.config.general.keepRunning).toBe(false)
  expect(ipcRenderer.send).toHaveBeenCalledOnce()
  expect(store.saveSettings).toHaveBeenCalledOnce()
  vi.clearAllMocks()

})

test('Settings Appearance', async () => {
  
  const tab = switchToTab(1)
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
  
  const tab = switchToTab(7)
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
