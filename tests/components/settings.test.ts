
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

const checkVisibility = (visible: number) => {
  for (let i=0; i<tabs.length; i++) {
    const display = i === visible ? 'block' : 'none'
    expect(wrapper.getComponent({ ref: tabs[i] }).attributes('style')).toMatch(new RegExp(`display: ${display}`))
  }
}

beforeEach(() => {

  // init store
  store.config = defaults

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
    await wrapper.find(`.tabs .tab:nth-child(${i+1})`).trigger('click')
    expect(wrapper.getComponent({ ref: tabs[i] }).find('.group')).not.toBeNull()
    checkVisibility(i)
  })
}

test('Settings close', async () => {
  await wrapper.find('.settings header .windows').trigger('click')
  expect(HTMLDialogElement.prototype.close).toHaveBeenCalledOnce()
})
