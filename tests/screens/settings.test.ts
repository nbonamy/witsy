
import { vi, beforeAll, beforeEach, afterAll, expect, test } from 'vitest'
import { mount, VueWrapper, enableAutoUnmount } from '@vue/test-utils'
import { useWindowMock } from '../mocks/window'
import { store } from '../../src/services/store'
import { tabs, switchToTab, getTab } from './settings_utils'
import Settings from '../../src/screens/Settings.vue'
import LlmFactory from '../../src/llms/llm'
import { defaultCapabilities } from 'multi-llm-ts'
import { findModelSelectoPlus } from '../utils'

enableAutoUnmount(afterAll)

vi.mock('../../src/services/store.ts', async (importOriginal) => {
  const mod: any = await importOriginal()
  return {
    store: {
      ...mod.store,
      saveSettings: vi.fn()
    }
  }
})

vi.mock('../../src/composables/appearance_theme.ts', async () => {
  return { default: () => ({
    getTheme: () => store.config.appearance.theme === 'system' ? 'light' : store.config.appearance.theme
  })}
})

let wrapper: VueWrapper<any>

const checkVisibility = (visible: number) => {
  for (let i=0; i<tabs.length; i++) {
    const display = i === visible ? 'flex' : 'none'
    expect(getTab(wrapper, i).attributes().style)?.toMatch(new RegExp(`display: ${display}`))
  }
}

beforeAll(() => {

  useWindowMock()
  store.loadSettings()
  store.load = () => {}

  // init store
  store.config.engines.anthropic = {
    model: { chat: 'model2' },
    // @ts-expect-error testing
    models: { _chat: [
        { id: 'model1', name: 'Model 1', meta: {}, ...defaultCapabilities },
        { id: 'model2', name: 'Model 2', meta: {}, ...defaultCapabilities }
      ],
      get chat() {
        return this._chat
      },
      set chat(value) {
        this._chat = value
      },
    }
  }

  // override
  window.api.config.localeLLM = () => store.config.llm.locale || 'en-US'
    
  // wrapper
  wrapper = mount(Settings)
})

beforeEach(() => {
  vi.clearAllMocks()
})

test('Settings renders correctly', () => {
  expect(wrapper.exists()).toBe(true)
  expect(wrapper.props().extra.initialTab).toBe('general')
  checkVisibility(0)
})

for (let i=1; i<tabs.length; i++) {
  test(`Settings switch to tab #${i}`, async () => {
    switchToTab(wrapper, i)
    checkVisibility(i)
    expect(wrapper.getComponent({ ref: tabs[i] }).find('.group')).not.toBeNull()
  })
}

test('Settings General', async () => {
  
  const tab = await switchToTab(wrapper, 0)
  expect(tab.findAll('.group')).toHaveLength(7)
  expect(tab.findAll('.group.localeUI select option')).toHaveLength(3)
  
  // helper
  const checkAndReset = (times: number = 1) => {
    expect(window.api.runAtLogin.set).toHaveBeenCalledTimes(times)
    expect(store.saveSettings).toHaveBeenCalledTimes(times)
    vi.clearAllMocks()
  }

  expect(store.config.appearance.theme).toBe('system')

  expect(store.config.appearance.lightTint).not.toBe('white')
  tab.find('.group.lightTint select').setValue('gray')
  expect(store.config.appearance.lightTint).toBe('gray')
  expect(store.saveSettings).toHaveBeenCalledOnce()
  vi.clearAllMocks()

  await tab.find('.group.appearance div:nth-of-type(2)').trigger('click')
  expect(store.config.appearance.theme).toBe('dark')
  expect(window.api.setAppearanceTheme).toHaveBeenLastCalledWith('dark')
  expect(store.saveSettings).toHaveBeenCalledOnce()
  vi.clearAllMocks()

  expect(store.config.appearance.darkTint).not.toBe('blue')
  tab.find('.group.darkTint select').setValue('blue')
  expect(store.config.appearance.darkTint).toBe('blue')
  expect(store.saveSettings).toHaveBeenCalledOnce()
  vi.clearAllMocks()

  // set ui locale to french
  expect(store.config.general.locale).toBe('')
  tab.find('.group.localeUI select').setValue('fr-FR')
  expect(store.config.general.locale).toBe('fr-FR')
  checkAndReset()

  // set it back to default
  tab.find('.group.localeUI select').setValue('')
  expect(store.config.general.locale).toBe('')
  checkAndReset()

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

test('Settings LLM', async () => {
  
  const manager = LlmFactory.manager(store.config)
  const tab = await switchToTab(wrapper, 1)
  expect(tab.findAll('.group')).toHaveLength(4)
  expect(tab.findAll('.group.localeLLM select option')).toHaveLength(21)
  expect(findModelSelectoPlus(wrapper).exists()).toBe(true)
  expect(store.config.prompt.engine).toBe('')
  expect(store.config.prompt.model).toBe('')
  expect(tab.findAll('.group.quick-prompt select.engine option')).toHaveLength(manager.getStandardEngines().length+1)

  // set default prompt
  expect(store.config.llm.instructions).toBe('standard')
  tab.find('.group.chat-prompt select').setValue('playful')
  expect(store.config.llm.instructions).toBe('playful')
  vi.clearAllMocks()

  // set prompt engine
  tab.find('.group.quick-prompt select.engine').setValue('anthropic')
  await wrapper.vm.$nextTick()
  expect(store.config.llm.forceLocale).toBe(false)
  expect(store.config.prompt.engine).toBe('anthropic')
  expect(store.config.prompt.model).toBe('model1')
  vi.clearAllMocks()
  
  // set prompt model
  const modelSelect = findModelSelectoPlus(tab)
  await modelSelect.open()
  await modelSelect.select(1)
  await wrapper.vm.$nextTick()
  expect(store.config.prompt.model).toBe('model2')
  vi.clearAllMocks()

  // set llm locale to french: translation exists so forceLocale is false
  expect(store.config.llm.locale).toBe('')
  expect(store.config.llm.forceLocale).toBe(false)
  tab.find('.group.localeLLM select').setValue('fr-FR')
  expect(store.config.llm.locale).toBe('fr-FR')
  expect(store.config.llm.forceLocale).toBe(false)
  vi.clearAllMocks()

  // set forceLocale to true
  tab.find('.group.localeLLM input').setValue(true)
  expect(store.config.llm.forceLocale).toBe(true)
  vi.clearAllMocks()

  // set it back to false
  tab.find('.group.localeLLM input').setValue(false)
  expect(store.config.llm.forceLocale).toBe(false)
  vi.clearAllMocks()

  // set llm locale to spanish: translation does not exist so forceLocale is true
  expect(store.config.llm.locale).not.toBe('es-ES')
  tab.find('.group.localeLLM select').setValue('es-ES')
  expect(store.config.llm.locale).toBe('es-ES')
  expect(store.config.llm.forceLocale).toBe(true)
  vi.clearAllMocks()

  expect(store.config.llm.conversationLength).not.toBe(10)
  tab.find('.group.length input').setValue(10)
  expect(store.config.llm.conversationLength).toBe(10)
  expect(store.saveSettings).toHaveBeenCalledOnce()
  vi.clearAllMocks()

})

test('Settings Chat', async () => {
  
  const tab = await switchToTab(wrapper, 2)
  expect(tab.findAll('.group')).toHaveLength(6)

  expect(store.config.appearance.chat.theme).not.toBe('conversation')
  tab.find('.group.theme select').setValue('conversation')
  expect(store.config.appearance.chat.theme).toBe('conversation')
  expect(store.saveSettings).toHaveBeenCalledOnce()
  vi.clearAllMocks()

  expect(store.config.appearance.chat.showToolCalls).toBe('always')
  tab.find('.group.tools select').setValue('never')
  expect(store.config.appearance.chat.showToolCalls).toBe('never')
  expect(store.saveSettings).toHaveBeenCalledOnce()
  tab.find('.group.tools select').setValue('always')
  expect(store.config.appearance.chat.showToolCalls).toBe('always')
  expect(store.saveSettings).toHaveBeenCalledTimes(2)
  vi.clearAllMocks()

  expect(store.config.appearance.chat.fontSize).not.toBe('2')
  tab.find('.group.font-size input').setValue('2')
  expect(store.config.appearance.chat.fontSize).toBe('2')
  expect(store.saveSettings).toHaveBeenCalledOnce()
  vi.clearAllMocks()

})

test('Settings Advanced', async () => {
  
  const tab = await switchToTab(wrapper, 10)
  expect(tab.findAll('.group')).toHaveLength(5)

  expect(store.config.prompt.autosave).not.toBe(true)
  tab.find('.group.autosave input').setValue(true)
  expect(store.config.prompt.autosave).toBe(true)
  expect(store.saveSettings).toHaveBeenCalledOnce()
  vi.clearAllMocks()

  expect(store.config.general.proxyMode).toBe('default')
  expect(tab.find('[name=customProxy]').exists()).toBe(false)
  tab.find('[name=proxyMode]').setValue('bypass')
  expect(store.config.general.proxyMode).toBe('bypass')
  expect(store.saveSettings).toHaveBeenCalledOnce()
  vi.clearAllMocks()

  tab.find('[name=proxyMode]').setValue('custom')
  expect(store.config.general.proxyMode).toBe('custom')
  await tab.vm.$nextTick()
  expect(tab.find('[name=customProxy]').exists()).toBe(true)
  expect(store.saveSettings).toHaveBeenCalledOnce()
  vi.clearAllMocks()

  await tab.find('[name=customProxy]').setValue('http://localhost:8080')
  expect(store.config.general.proxyMode).toBe('custom')
  expect(store.config.general.customProxy).toBe('http://localhost:8080')
  expect(store.saveSettings).toHaveBeenCalledOnce()
  vi.clearAllMocks()

  expect(store.config.llm.imageResize).not.toBe(1024)
  tab.find('.group.size select').setValue(1024)
  expect(store.config.llm.imageResize).toBe(1024)
  expect(store.saveSettings).toHaveBeenCalledOnce()
  vi.clearAllMocks()

  // helper to get instructions at any level
  // @ts-expect-error testing
  store.config.get = (key: string): string => 
    // @ts-expect-error testing
    key.split('.').reduce((obj, token) => obj?.[token], store.config)

  const instructions = [
    'instructions.chat.standard', 'instructions.chat.structured', 'instructions.chat.playful',
    'instructions.chat.empathic', 'instructions.chat.uplifting', 'instructions.chat.reflective', 'instructions.chat.visionary', 
    'instructions.utils.titling', 'instructions.utils.titlingUser', 'instructions.chat.docquery',
    'instructions.scratchpad.system', 'instructions.scratchpad.prompt', 'instructions.scratchpad.spellcheck',
    'instructions.scratchpad.improve', 'instructions.scratchpad.takeaways', 'instructions.scratchpad.title',
    'instructions.scratchpad.simplify', 'instructions.scratchpad.expand', 'instructions.scratchpad.complete',
    'plugins.memory.description'
  ]
  
  for (const instr in instructions) {

    // check it is not set
    // @ts-expect-error testing
    expect(store.config.get(instructions[instr])).toBeUndefined()

    // select and set value
    await tab.find('.group.instruction select').setValue(instructions[instr])
    await tab.find('.group.instruction textarea').setValue('bot')
    // @ts-expect-error testing
    expect(store.config.get(instructions[instr])).toBe('bot')
    expect(store.saveSettings).toHaveBeenCalledOnce()
    vi.clearAllMocks()

    // reset default
    await tab.find('.group.instruction a').trigger('click')
    // @ts-expect-error testing
    expect(store.config.get(instructions[instr])).toBeUndefined()
    expect(store.saveSettings).toHaveBeenCalledOnce()
    vi.clearAllMocks()

  }

})

test('Settings Advanced Image resize none - save', async () => {
  const tab = await switchToTab(wrapper, 10)
  expect(store.config.llm.imageResize).toBe(1024)
  tab.find('.group.size select').setValue(0)
  expect(store.config.llm.imageResize).toBe(0)
})

test('Settings Advanced Image resize none - reload', async () => {
  const tab = await switchToTab(wrapper, 10)
  expect(tab.find<HTMLSelectElement>('.group.size select').element.value).toBe('0')
})
