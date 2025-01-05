
import { vi, beforeAll, beforeEach, afterAll, expect, test } from 'vitest'
import { mount, VueWrapper, enableAutoUnmount } from '@vue/test-utils'
import { useWindowMock } from '../mocks/window'
import { store } from '../../src/services/store'
import { standardEngines } from '../../src/llms/llm'
import Settings from '../../src/screens/Settings.vue'

import useEventBus from '../../src/composables/event_bus'
const { emitEvent } = useEventBus()

enableAutoUnmount(afterAll)

HTMLDialogElement.prototype.showModal = vi.fn()
HTMLDialogElement.prototype.close = vi.fn()

vi.mock('../../src/services/store.ts', async (importOriginal) => {
  const commands = await import('../../defaults/commands.json')
  const experts = await import('../../defaults/experts.json')
  const mod: any = await importOriginal()
  return {
    clone: mod.clone,
    store: {
      ...mod.store,
      commands: commands.default,
      experts: experts.default,
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

test('Settings Commands', async () => {

  const tab = await switchToTab(2)
  
  // basic stuff
  expect(tab.findAll('.sticky-table-container')).toHaveLength(1)
  expect(tab.findAll('.sticky-table-container tr.command')).toHaveLength(41)
  expect(tab.findAll('.sticky-table-container tr.command button')).toHaveLength(82)
  expect(tab.findAll('.actions button')).toHaveLength(4)

  // move up and down
  const first = tab.find('.sticky-table-container tr.command').attributes('data-id')
  const second = tab.find('.sticky-table-container tr.command:nth-of-type(2)').attributes('data-id')
  await tab.find('.sticky-table-container tr.command:nth-of-type(2) button:nth-of-type(2)').trigger('click')
  expect (tab.find('.sticky-table-container tr.command').attributes('data-id')).toBe(second)
  expect (tab.find('.sticky-table-container tr.command:nth-of-type(2)').attributes('data-id')).toBe(first)
  await tab.find('.sticky-table-container tr.command:nth-of-type(1) button:nth-of-type(1)').trigger('click')
  expect (tab.find('.sticky-table-container tr.command').attributes('data-id')).toBe(first)
  expect (tab.find('.sticky-table-container tr.command:nth-of-type(2)').attributes('data-id')).toBe(second)

  // new command opens
  const modal = tab.find<HTMLDialogElement>('#command-editor').element
  vi.spyOn(modal, 'showModal').mockImplementation(() => modal.setAttribute('open', 'opened'))
  expect(modal.showModal).not.toHaveBeenCalled()
  await tab.find('.actions button:nth-of-type(1)').trigger('click')
  expect(modal.showModal).toHaveBeenCalledTimes(1)
  expect(modal.hasAttribute('open')).toBe(true)
  modal.removeAttribute('open')

  // new command creates
  await tab.find('#command-editor textarea').setValue('{input}')
  await tab.find('#command-editor button.default').trigger('click')
  expect(tab.findAll('.sticky-table-container tr.command')).toHaveLength(42)

  // delete
  await tab.find('.sticky-table-container tr.command:nth-of-type(42)').trigger('click')
  await tab.find('.actions button:nth-of-type(3)').trigger('click')
  expect(tab.findAll('.sticky-table-container tr.command')).toHaveLength(41)

  // edit
  expect(modal.hasAttribute('open')).toBe(false)
  await tab.find('.sticky-table-container tr.command:nth-of-type(2)').trigger('dblclick')
  expect(modal.showModal).toHaveBeenCalledTimes(2)
  expect(modal.hasAttribute('open')).toBe(true)
  // expect(tab.find<HTMLInputElement>('#command-editor input').element.value).toBe(store.commands[1].name)
  // expect(tab.find<HTMLTextAreaElement>('#command-editor textarea').element.value).toBe(store.commands[1].name)

  // context menu
  expect(tab.findAll('.context-menu')).toHaveLength(0)
  await tab.find('.actions .right button').trigger('click')
  await tab.vm.$nextTick()
  expect(tab.findAll('.context-menu')).toHaveLength(1)

})

test('Settings Experts', async () => {

  const tab = await switchToTab(3)
  
  // basic stuff
  expect(tab.findAll('.sticky-table-container')).toHaveLength(1)
  expect(tab.findAll('.sticky-table-container tr.expert')).toHaveLength(166)
  expect(tab.findAll('.sticky-table-container tr.expert button')).toHaveLength(332)
  expect(tab.findAll('.content > .actions button')).toHaveLength(5)

  // move up and down
  const first = tab.find('.sticky-table-container tr.expert').attributes('data-id')
  const second = tab.find('.sticky-table-container tr.expert:nth-of-type(2)').attributes('data-id')
  await tab.find('.sticky-table-container tr.expert:nth-of-type(2) button:nth-of-type(2)').trigger('click')
  expect (tab.find('.sticky-table-container tr.expert').attributes('data-id')).toBe(second)
  expect (tab.find('.sticky-table-container tr.expert:nth-of-type(2)').attributes('data-id')).toBe(first)
  await tab.find('.sticky-table-container tr.expert:nth-of-type(1) button:nth-of-type(1)').trigger('click')
  expect (tab.find('.sticky-table-container tr.expert').attributes('data-id')).toBe(first)
  expect (tab.find('.sticky-table-container tr.expert:nth-of-type(2)').attributes('data-id')).toBe(second)

  // new command opens
  const modal = tab.find<HTMLDialogElement>('#expert-editor').element
  vi.spyOn(modal, 'showModal').mockImplementation(() => modal.setAttribute('open', 'opened'))
  expect(modal.showModal).not.toHaveBeenCalled()
  await tab.find('.actions button:nth-of-type(1)').trigger('click')
  expect(modal.showModal).toHaveBeenCalledTimes(1)
  expect(modal.hasAttribute('open')).toBe(true)
  modal.removeAttribute('open')

  // new command creates
  await tab.find('#expert-editor textarea').setValue('expert prompt')
  await tab.find('#expert-editor button.default').trigger('click')
  expect(tab.findAll('.sticky-table-container tr.expert')).toHaveLength(167)

  // copy
  await tab.find('.sticky-table-container tr.expert:nth-of-type(167)').trigger('click')
  await tab.find('.actions button:nth-of-type(3)').trigger('click')
  expect(tab.findAll('.sticky-table-container tr.expert')).toHaveLength(168)

  // delete
  await tab.find('.sticky-table-container tr.expert:nth-of-type(168)').trigger('click')
  await tab.find('.actions button:nth-of-type(4)').trigger('click')
  expect(tab.findAll('.sticky-table-container tr.expert')).toHaveLength(167)

  // edit
  expect(modal.hasAttribute('open')).toBe(false)
  await tab.find('.sticky-table-container tr.expert:nth-of-type(2)').trigger('dblclick')
  expect(modal.showModal).toHaveBeenCalledTimes(2)
  expect(modal.hasAttribute('open')).toBe(true)
  // expect(tab.find<HTMLInputElement>('#expert-editor input').element.value).toBe(store.expert[1].name)
  // expect(tab.find<HTMLTextAreaElement>('#expert-editor textarea').element.value).toBe(store.expert[1].name)

  // context menu
  expect(tab.findAll('.context-menu')).toHaveLength(0)
  await tab.find('.actions .right button').trigger('click')
  await tab.vm.$nextTick()
  expect(tab.findAll('.context-menu')).toHaveLength(1)

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
