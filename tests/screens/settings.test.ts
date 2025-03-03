
import { vi, beforeAll, beforeEach, afterAll, expect, test } from 'vitest'
import { mount, VueWrapper, enableAutoUnmount } from '@vue/test-utils'
import { useWindowMock } from '../mocks/window'
import { store } from '../../src/services/store'
import { standardEngines } from '../../src/llms/llm'
import { tabs, switchToTab, getTab } from './settings_utils'
import Settings from '../../src/screens/Settings.vue'

import useEventBus from '../../src/composables/event_bus'
const { emitEvent } = useEventBus()

enableAutoUnmount(afterAll)

HTMLDialogElement.prototype.showModal = vi.fn()
HTMLDialogElement.prototype.close = vi.fn()

vi.mock('../../src/services/store.ts', async (importOriginal) => {
  const mod: any = await importOriginal()
  return {
    store: {
      ...mod.store,
      saveSettings: vi.fn()
    }
  }
})

let wrapper: VueWrapper<any>

const checkVisibility = (visible: number) => {
  for (let i=0; i<tabs.length; i++) {
    const display = i === visible ? 'block' : 'none'
    expect(getTab(wrapper, i).attributes().style).toMatch(new RegExp(`display: ${display}`))
  }
}

beforeAll(() => {

  useWindowMock()
  store.loadSettings()

  // init store
  store.config.engines.anthropic = {
    model: { chat: 'model2' },
    models: { chat: [
      { id: 'model1', name: 'Model 1' },
      { id: 'model2', name: 'Model 2' }
     ]
    }
  }

  // override
  window.api.config.localeLLM = () => store.config.llm.locale || 'en-US'
    
  // wrapper
  document.body.innerHTML = `<dialog id="settings"></dialog>`
  wrapper = mount(Settings, { attachTo: '#settings' })
  emitEvent('open-settings', null)
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
    switchToTab(wrapper, i)
    checkVisibility(i)
    expect(wrapper.getComponent({ ref: tabs[i] }).find('.group')).not.toBeNull()
  })
}

test('Settings close', async () => {
  await wrapper.find('.settings header .windows').trigger('click')
  expect(HTMLDialogElement.prototype.close).toHaveBeenCalledOnce()
})

test('Settings General', async () => {
  
  const tab = await switchToTab(wrapper, 0)
  expect(tab.findAll('.group')).toHaveLength(7)
  expect(tab.findAll('.group.localeUI select option')).toHaveLength(3)
  expect(tab.findAll('.group.localeLLM select option')).toHaveLength(21)
  expect(store.config.prompt.engine).toBe('')
  expect(store.config.prompt.model).toBe('')
  expect(tab.findAll('.group.prompt select.engine option')).toHaveLength(standardEngines.length+1)
  
  // helper
  const checkAndReset = (times: number = 1) => {
    expect(window.api.runAtLogin.set).toHaveBeenCalledTimes(times)
    expect(store.saveSettings).toHaveBeenCalledTimes(times)
    vi.clearAllMocks()
  }

  // set prompt engine
  tab.find('.group.prompt select.engine').setValue('anthropic')
  await wrapper.vm.$nextTick()
  expect(store.config.llm.forceLocale).toBe(false)
  expect(store.config.prompt.engine).toBe('anthropic')
  expect(store.config.prompt.model).toBe('model1')
  checkAndReset()
  
  // set prompt model
  tab.find('.group.prompt select.model').setValue('model2')
  await wrapper.vm.$nextTick()
  expect(store.config.prompt.model).toBe('model2')
  checkAndReset()

  // set ui locale to french
  expect(store.config.general.locale).toBe('')
  tab.find('.group.localeUI select').setValue('fr-FR')
  expect(store.config.general.locale).toBe('fr-FR')
  checkAndReset()

  // set it back to default
  tab.find('.group.localeUI select').setValue('')
  expect(store.config.general.locale).toBe('')
  checkAndReset()

  // set llm locale to french: translation exists so forceLocale is false
  expect(store.config.llm.locale).toBe('')
  expect(store.config.llm.forceLocale).toBe(false)
  tab.find('.group.localeLLM select').setValue('fr-FR')
  expect(store.config.llm.locale).toBe('fr-FR')
  expect(store.config.llm.forceLocale).toBe(false)
  checkAndReset()

  // set forceLocale to true
  tab.find('.group.localeLLM input').setValue(true)
  expect(store.config.llm.forceLocale).toBe(true)
  checkAndReset()

  // set it back to false
  tab.find('.group.localeLLM input').setValue(false)
  expect(store.config.llm.forceLocale).toBe(false)
  checkAndReset()

  // set llm locale to spanish: translation does not exist so forceLocale is true
  expect(store.config.llm.locale).not.toBe('es-ES')
  tab.find('.group.localeLLM select').setValue('es-ES')
  expect(store.config.llm.locale).toBe('es-ES')
  expect(store.config.llm.forceLocale).toBe(true)
  checkAndReset(2)

  // now run at login
  expect(window.api.runAtLogin.get()).not.toBe(true)
  tab.find('.group.run-at-login input').setValue(true)
  expect(window.api.runAtLogin.get()).toBe(true)
  checkAndReset()

  // hide on startup
  expect(store.config.general.hideOnStartup).not.toBe(true)
  tab.find('.group.hide-on-startup input').setValue(true)
  expect(store.config.general.hideOnStartup).toBe(true)
  checkAndReset()

  // and keep running
  expect(store.config.general.keepRunning).not.toBe(false)
  tab.find('.group.keep-running input').setValue(false)
  expect(store.config.general.keepRunning).toBe(false)
  checkAndReset()

})

test('Settings Appearance', async () => {
  
  const tab = await switchToTab(wrapper, 1)
  expect(tab.findAll('.group')).toHaveLength(6)

  expect(store.config.appearance.theme).toBe('system')
  await tab.find('.group.appearance div:nth-of-type(2)').trigger('click')
  expect(store.config.appearance.theme).toBe('dark')
  expect(window.api.setAppearanceTheme).toHaveBeenLastCalledWith('dark')
  expect(store.saveSettings).toHaveBeenCalledOnce()
  vi.clearAllMocks()

  expect(store.config.appearance.tint).not.toBe('blue')
  tab.find('.group.tint select').setValue('blue')
  expect(store.config.appearance.tint).toBe('blue')
  expect(store.saveSettings).toHaveBeenCalledOnce()
  vi.clearAllMocks()

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
  
  const tab = await switchToTab(wrapper, 8)
  expect(tab.findAll('.group')).toHaveLength(5)

  expect(store.config.llm.autoVisionSwitch).not.toBe(false)
  tab.find('.group.vision input').setValue(false)
  expect(store.config.llm.autoVisionSwitch).toBe(false)
  expect(store.saveSettings).toHaveBeenCalledOnce()
  vi.clearAllMocks()

  expect(store.config.prompt.autosave).not.toBe(true)
  tab.find('.group.autosave input').setValue(true)
  expect(store.config.prompt.autosave).toBe(true)
  expect(store.saveSettings).toHaveBeenCalledOnce()
  vi.clearAllMocks()

  expect(store.config.llm.conversationLength).not.toBe(10)
  tab.find('.group.length input').setValue(10)
  expect(store.config.llm.conversationLength).toBe(10)
  expect(store.saveSettings).toHaveBeenCalledOnce()
  vi.clearAllMocks()

  expect(store.config.llm.imageResize).not.toBe(1024)
  tab.find('.group.size select').setValue(1024)
  expect(store.config.llm.imageResize).toBe(1024)
  expect(store.saveSettings).toHaveBeenCalledOnce()
  vi.clearAllMocks()

  // helper to get instructions at any level
  store.config.get = (key: string): string => 
    key.split('.').reduce((obj, token) => obj?.[token], store.config)

  const instructions = [
    'instructions.default', 'instructions.titling', 'instructions.titling_user', 'instructions.docquery',
    'instructions.scratchpad.system', 'instructions.scratchpad.prompt', 'instructions.scratchpad.spellcheck',
    'instructions.scratchpad.improve', 'instructions.scratchpad.takeaways', 'instructions.scratchpad.title',
    'instructions.scratchpad.simplify', 'instructions.scratchpad.expand', 'instructions.scratchpad.complete',
    'plugins.memory.description'
  ]
  
  for (const instr in instructions) {

    // check it is not set
    expect(store.config.get(instructions[instr])).toBeUndefined()

    // select and set value
    await tab.find('.group.instruction select').setValue(instructions[instr])
    await tab.find('.group.instruction textarea').setValue('bot')
    expect(store.config.get(instructions[instr])).toBe('bot')
    expect(store.saveSettings).toHaveBeenCalledOnce()
    vi.clearAllMocks()

    // reset default
    await tab.find('.group.instruction a').trigger('click')
    expect(store.config.get(instructions[instr])).toBeUndefined()
    expect(store.saveSettings).toHaveBeenCalledOnce()
    vi.clearAllMocks()

  }

})
