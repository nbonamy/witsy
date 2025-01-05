
import { vi, beforeAll, beforeEach, afterAll, expect, test } from 'vitest'
import { mount, VueWrapper, enableAutoUnmount } from '@vue/test-utils'
import { useWindowMock } from '../mocks/window'
import { store } from '../../src/services/store'
import Settings from '../../src/screens/Settings.vue'
import { standardEngines } from '../../src/llms/llm'

import useEventBus from '../../src/composables/event_bus'
const { emitEvent } = useEventBus()

enableAutoUnmount(afterAll)

HTMLDialogElement.prototype.showModal = vi.fn()
HTMLDialogElement.prototype.close = vi.fn()

vi.mock('../../src/services/store.ts', async (importOriginal) => {
  const commands = await import('../../defaults/commands.json')
  const mod: any = await importOriginal()
  return {
    clone: mod.clone,
    store: {
      ...mod.store,
      commands: commands.default,
      saveSettings: vi.fn()
    }
  }
})

let wrapper: VueWrapper<any>

const tabs = [
  'settingsGeneral',
  'settingsAppearance',
  'settingsCommands',
  'settingsExperts',
  'settingsShortcuts',
  'settingsLLM',
  'settingsPlugins',
  'settingsVoice',
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
  
  expect(store.config.prompt.engine).toBe('')
  expect(store.config.prompt.model).toBe('')
  expect(tab.findAll('.group.prompt select.engine option')).toHaveLength(standardEngines.length+1)
  tab.find('.group.prompt select.engine').setValue('anthropic')
  await wrapper.vm.$nextTick()
  expect(store.config.prompt.engine).toBe('anthropic')
  expect(store.config.prompt.model).toBe('model1')
  expect(window.api.runAtLogin.set).toHaveBeenCalledOnce()
  expect(store.saveSettings).toHaveBeenCalledOnce()
  tab.find('.group.prompt select.model').setValue('model2')
  await wrapper.vm.$nextTick()
  expect(store.config.prompt.model).toBe('model2')
  expect(window.api.runAtLogin.set).toHaveBeenCalledTimes(2)
  expect(store.saveSettings).toHaveBeenCalledTimes(2)
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
  expect(tab.findAll('.group')).toHaveLength(6)

  expect(store.config.appearance.theme).toBe('system')
  await tab.find('.group.appearance div:nth-of-type(2)').trigger('click')
  expect(store.config.appearance.theme).toBe('dark')
  expect(window.api.setAppearanceTheme).toHaveBeenCalledWith('dark')
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
  
  const tab = await switchToTab(8)
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
  store.config.get = (key: string): string => {
    const tokens = key.split('.')
    let value = store.config
    for (const token of tokens) {
      value = value[token]
    }
    return value
  }

  const instructions = [
    'instructions.default', 'instructions.titling', 'instructions.titling_user', 'instructions.docquery',
    'instructions.scratchpad.system', 'instructions.scratchpad.prompt', 'instructions.scratchpad.spellcheck',
    'instructions.scratchpad.improve', 'instructions.scratchpad.takeaways', 'instructions.scratchpad.title',
    'instructions.scratchpad.simplify', 'instructions.scratchpad.expand', 'instructions.scratchpad.complete',
    'plugins.memory.description'
  ]
  
  for (const instr in instructions) {

    // check it is not bot
    expect(store.config.get(instructions[instr])).not.toBe('bot')

    // select and set value
    await tab.find('.group.instruction select').setValue(instructions[instr])
    await tab.find('.group.instruction textarea').setValue('bot')
    expect(store.config.get(instructions[instr])).toBe('bot')
    expect(store.saveSettings).toHaveBeenCalledOnce()
    vi.clearAllMocks()

    // reset default
    await tab.find('.group.instruction a').trigger('click')
    expect(store.config.get(instructions[instr])).not.toBe('bot')
    expect(store.saveSettings).toHaveBeenCalledOnce()
    vi.clearAllMocks()

  }

})
