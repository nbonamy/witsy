
import { mount, VueWrapper } from '@vue/test-utils'
import Settings from '../../src/screens/Settings.vue'
import { vi, beforeEach, afterEach, expect, test } from 'vitest'
import { store } from '../../src/services/store'
import defaults from '../../defaults/settings.json'

import useEventBus from '../../src/composables/useEventBus'
const { emitEvent } = useEventBus()

HTMLDialogElement.prototype.showModal = vi.fn()
HTMLDialogElement.prototype.close = vi.fn()

vi.mock('electron', async (importOriginal) => {
  const mod: any = await importOriginal()
  return {
    ...mod,
    ipcRenderer: {
      send: vi.fn(),
      sendSync: vi.fn(() => {
        return { openAtLogin: false }
      }),
    }
  }
})

vi.mock('../../src/services/store.ts', async () => {
  return {
    store: {
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

beforeEach(() => {

  // init store
  store.config = defaults
  store.saveSettings.mockClear()

  // wrapper
  document.body.innerHTML = `<dialog id="settings"></dialog>`
  wrapper = mount(Settings, { attachTo: '#settings' })
  emitEvent('openSettings')
})

afterEach(() => {
  wrapper.unmount()
})

test('Settings renders correctly', () => {
  expect(wrapper.exists()).toBe(true)
  expect(HTMLDialogElement.prototype.showModal).toHaveBeenCalledOnce()
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
  
  expect(tab.findAll('.group.engine select option')).toHaveLength(4)
  tab.get('.group.engine select').setValue('anthropic')
  expect(store.config.llm.engine).toBe('anthropic')
  expect(store.saveSettings).toHaveBeenCalledOnce()
  store.saveSettings.mockClear()

  expect(tab.findAll('.group.language select option')).toHaveLength(22)
  tab.get('.group.language select').setValue('es')
  expect(store.config.general.language).toBe('es')
  expect(store.saveSettings).toHaveBeenCalledOnce()
  store.saveSettings.mockClear()

  tab.get('.group.keep-running input').setValue('true')
  expect(store.config.general.keepRunning).toBe(true)
  expect(store.saveSettings).toHaveBeenCalledOnce()
  store.saveSettings.mockClear()
})

test('Settings Appearance', async () => {
  const tab = switchToTab(1)
  expect(tab.findAll('.group')).toHaveLength(2)

  tab.get('.group.theme select').setValue('conversation')
  expect(store.config.appearance.chat.theme).toBe('conversation')
  expect(store.saveSettings).toHaveBeenCalledOnce()
  store.saveSettings.mockClear()

  tab.get('.group.font-size input').setValue('2')
  expect(store.config.appearance.chat.fontSize).toBe('2')
  expect(store.saveSettings).toHaveBeenCalledOnce()
  store.saveSettings.mockClear()

})