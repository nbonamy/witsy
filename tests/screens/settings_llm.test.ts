import { vi, beforeAll, beforeEach, afterAll, expect, test } from 'vitest'
import { mount, VueWrapper, enableAutoUnmount } from '@vue/test-utils'
import { useWindowMock } from '../mocks/window'
import { store } from '../../src/services/store'
import { tabs, switchToTab } from './settings_utils'
import Settings from '../../src/screens/Settings.vue'
import LlmFactory from '../../src/llms/llm'
import { defaultCapabilities } from 'multi-llm-ts'
import { findModelSelectoPlus } from '../utils'
import { CustomInstruction } from '../../src/types/config'

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

vi.mock('../../src/composables/dialog.ts', () => ({
  default: {
    show: vi.fn()
  }
}))

let wrapper: VueWrapper<any>

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

beforeEach(async () => {
  vi.clearAllMocks()
  // Reset custom instructions before each test
  store.config.llm.customInstructions = []
  store.config.llm.instructions = 'standard'
  
  // Force component reload to pick up changes
  const settingsComponent = wrapper.getComponent({ ref: 'settingsLLM' })
  settingsComponent.vm.load()
  await wrapper.vm.$nextTick()
})

test('Settings LLM basic functionality', async () => {
  
  const manager = LlmFactory.manager(store.config)
  const tab = await switchToTab(wrapper, tabs.indexOf('settingsLLM'))
  expect(tab.findAll('.group')).toHaveLength(6) // Updated to account for new groups
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

test('Settings LLM custom instructions initialization', async () => {
  
  const tab = await switchToTab(wrapper, tabs.indexOf('settingsLLM'))
  
  // Check that custom instructions actions are present
  expect(tab.find('.actions').exists()).toBe(true)
  expect(tab.findAll('.actions button')).toHaveLength(3)
  
  const buttons = tab.findAll('.actions button')
  expect(buttons[0].text()).toBe('common.add')
  expect(buttons[1].text()).toBe('common.edit')
  expect(buttons[2].text()).toBe('common.delete')
  
  // Delete button should be disabled initially (no custom instruction selected)
  // Edit button should always be enabled now (can edit defaults too)
  expect(buttons[1].attributes('disabled')).toBeUndefined()
  expect(buttons[2].attributes('disabled')).toBeDefined()
  
  // Instructions dropdown should only have default options
  const options = tab.find('.group.chat-prompt select').findAll('option')
  expect(options).toHaveLength(7) // 7 default instruction types
})

test('Settings LLM add custom instruction', async () => {
  
  const tab = await switchToTab(wrapper, tabs.indexOf('settingsLLM'))
  const settingsComponent = wrapper.getComponent({ ref: 'settingsLLM' })
  
  // Click Add button
  await tab.find('.actions button:first-child').trigger('click')
  await wrapper.vm.$nextTick()
  
  // Should switch to editor view  
  expect(tab.find('.sliding-root').classes()).not.toContain('visible')
  expect(tab.find('.sliding-pane').classes()).toContain('visible')
  
  // Check that a selectedInstruction is set
  expect(settingsComponent.vm.selectedInstruction).toBeTruthy()
  expect(settingsComponent.vm.selectedInstruction.id).toBeTruthy()
  expect(settingsComponent.vm.selectedInstruction.label).toBe('')
  expect(settingsComponent.vm.selectedInstruction.instructions).toBe('')
})

test('Settings LLM save custom instruction', async () => {
  
  const tab = await switchToTab(wrapper, tabs.indexOf('settingsLLM'))
  const settingsComponent = wrapper.getComponent({ ref: 'settingsLLM' })
  
  // Click Add button
  await tab.find('.actions button:first-child').trigger('click')
  await wrapper.vm.$nextTick()
  
  const customInstruction: CustomInstruction = {
    id: '123',
    label: 'Test Instruction',
    instructions: 'This is a test instruction'
  }
  
  // Simulate saving the instruction
  settingsComponent.vm.onInstructionSaved(customInstruction)
  await wrapper.vm.$nextTick()
  
  // Check that instruction was added to store
  expect(store.config.llm.customInstructions).toHaveLength(1)
  expect(store.config.llm.customInstructions[0]).toEqual(customInstruction)
  
  // Check that it's now selected
  expect(store.config.llm.instructions).toBe('123')
  
  // Check that editor is closed
  expect(settingsComponent.vm.selectedInstruction).toBeNull()
  
  // Check that save was called
  expect(store.saveSettings).toHaveBeenCalled()
})

test('Settings LLM custom instruction appears in dropdown', async () => {
  
  // Add a custom instruction to store
  const customInstruction: CustomInstruction = {
    id: 'custom1',
    label: 'My Custom Instruction',
    instructions: 'Custom instruction content'
  }
  store.config.llm.customInstructions = [customInstruction]
  
  // Force component reload to pick up the new custom instruction
  const settingsComponent = wrapper.getComponent({ ref: 'settingsLLM' })
  settingsComponent.vm.load()
  
  const tab = await switchToTab(wrapper, tabs.indexOf('settingsLLM'))
  await wrapper.vm.$nextTick()
  
  // Check that custom instruction appears in dropdown
  const options = tab.find('.group.chat-prompt select').findAll('option')
  expect(options).toHaveLength(8) // 7 default + 1 custom
  
  const customOption = options.find(option => option.attributes('value') === 'custom1')
  expect(customOption).toBeTruthy()
  expect(customOption!.text()).toBe('My Custom Instruction')
})

test('Settings LLM edit/delete buttons enabled for custom instruction', async () => {
  
  // Add a custom instruction and select it
  const customInstruction: CustomInstruction = {
    id: 'custom1',
    label: 'My Custom Instruction',
    instructions: 'Custom instruction content'
  }
  store.config.llm.customInstructions = [customInstruction]
  store.config.llm.instructions = 'custom1'
  
  // Force component reload
  const settingsComponent = wrapper.getComponent({ ref: 'settingsLLM' })
  settingsComponent.vm.load()
  
  const tab = await switchToTab(wrapper, tabs.indexOf('settingsLLM'))
  await wrapper.vm.$nextTick()
  
  // Set the select value to custom instruction
  await tab.find('.group.chat-prompt select').setValue('custom1')
  await wrapper.vm.$nextTick()
  
  const buttons = tab.findAll('.actions button')
  
  // Edit and Delete buttons should now be enabled for custom instructions
  expect(buttons[1].attributes('disabled')).toBeUndefined()
  expect(buttons[2].attributes('disabled')).toBeUndefined()
})

test('Settings LLM edit custom instruction', async () => {
  
  // Add a custom instruction and select it
  const customInstruction: CustomInstruction = {
    id: 'custom1',
    label: 'My Custom Instruction',
    instructions: 'Custom instruction content'
  }
  store.config.llm.customInstructions = [customInstruction]
  store.config.llm.instructions = 'custom1'
  
  const tab = await switchToTab(wrapper, tabs.indexOf('settingsLLM'))
  const settingsComponent = wrapper.getComponent({ ref: 'settingsLLM' })
  
  // Force component reload
  settingsComponent.vm.load()
  await wrapper.vm.$nextTick()
  
  // Set the select value to custom instruction
  await tab.find('.group.chat-prompt select').setValue('custom1')
  await wrapper.vm.$nextTick()
  
  // Click Edit button
  await tab.findAll('.actions button')[1].trigger('click')
  await wrapper.vm.$nextTick()
  
  // Should switch to editor view with the instruction loaded
  expect(settingsComponent.vm.selectedInstruction).toEqual(customInstruction)
})

test('Settings LLM delete custom instruction with confirmation', async () => {
  
  const Dialog = await import('../../src/composables/dialog')
  
  // Add a custom instruction and select it
  const customInstruction: CustomInstruction = {
    id: 'custom1',
    label: 'My Custom Instruction',
    instructions: 'Custom instruction content'
  }
  store.config.llm.customInstructions = [customInstruction]
  store.config.llm.instructions = 'custom1'
  
  const tab = await switchToTab(wrapper, tabs.indexOf('settingsLLM'))
  const settingsComponent = wrapper.getComponent({ ref: 'settingsLLM' })
  
  // Force component reload
  settingsComponent.vm.load()
  await wrapper.vm.$nextTick()
  
  // Set the select value to custom instruction
  await tab.find('.group.chat-prompt select').setValue('custom1')
  await wrapper.vm.$nextTick()
  
  // Mock dialog confirmation
  vi.mocked(Dialog.default.show).mockResolvedValue({ isConfirmed: true })
  
  // Click Delete button
  await tab.findAll('.actions button')[2].trigger('click')
  await wrapper.vm.$nextTick()
  
  // Check that dialog was shown
  expect(Dialog.default.show).toHaveBeenCalledWith({
    title: 'common.confirmation.deleteCustomInstruction',
    text: 'common.confirmation.cannotUndo',
    confirmButtonText: 'common.delete',
    showCancelButton: true,
  })
  
  // Check that instruction was removed
  expect(store.config.llm.customInstructions).toHaveLength(0)
  expect(store.config.llm.instructions).toBe('standard')
  expect(store.saveSettings).toHaveBeenCalled()
})

test('Settings LLM delete custom instruction canceled', async () => {
  
  const Dialog = await import('../../src/composables/dialog')
  
  // Add a custom instruction and select it
  const customInstruction: CustomInstruction = {
    id: 'custom1',
    label: 'My Custom Instruction',
    instructions: 'Custom instruction content'
  }
  store.config.llm.customInstructions = [customInstruction]
  store.config.llm.instructions = 'custom1'
  
  const tab = await switchToTab(wrapper, tabs.indexOf('settingsLLM'))
  const settingsComponent = wrapper.getComponent({ ref: 'settingsLLM' })
  
  // Force component reload
  settingsComponent.vm.load()
  await wrapper.vm.$nextTick()
  
  // Set the select value to custom instruction
  await tab.find('.group.chat-prompt select').setValue('custom1')
  await wrapper.vm.$nextTick()
  
  // Mock dialog cancellation
  vi.mocked(Dialog.default.show).mockResolvedValue({ isConfirmed: false })
  
  // Clear previous saveSettings calls
  vi.clearAllMocks()
  
  // Click Delete button
  await tab.findAll('.actions button')[2].trigger('click')
  await wrapper.vm.$nextTick()
  
  // Check that instruction was NOT removed
  expect(store.config.llm.customInstructions).toHaveLength(1)
  expect(store.config.llm.instructions).toBe('custom1')
  expect(store.saveSettings).not.toHaveBeenCalled()
})

test('Settings LLM edit/delete disabled for default instructions', async () => {
  
  const tab = await switchToTab(wrapper, tabs.indexOf('settingsLLM'))
  
  // Test with each default instruction type
  const defaultInstructions = ['standard', 'structured', 'playful', 'empathic', 'uplifting', 'reflective', 'visionary']
  
  for (const instruction of defaultInstructions) {
    await tab.find('.group.chat-prompt select').setValue(instruction)
    await wrapper.vm.$nextTick()
    
    const buttons = tab.findAll('.actions button')
    
    // Edit button should be enabled, Delete button should be disabled for default instructions
    expect(buttons[1].attributes('disabled')).toBeUndefined()
    expect(buttons[2].attributes('disabled')).toBeDefined()
  }
})

test('Settings LLM update existing custom instruction', async () => {
  
  // Add a custom instruction
  const customInstruction: CustomInstruction = {
    id: 'custom1',
    label: 'Original Label',
    instructions: 'Original instructions'
  }
  store.config.llm.customInstructions = [customInstruction]
  
  await switchToTab(wrapper, tabs.indexOf('settingsLLM'))
  const settingsComponent = wrapper.getComponent({ ref: 'settingsLLM' })
  
  const updatedInstruction: CustomInstruction = {
    id: 'custom1',
    label: 'Updated Label',
    instructions: 'Updated instructions'
  }
  
  // Simulate updating the instruction
  settingsComponent.vm.onInstructionSaved(updatedInstruction)
  await wrapper.vm.$nextTick()
  
  // Check that instruction was updated (not added)
  expect(store.config.llm.customInstructions).toHaveLength(1)
  expect(store.config.llm.customInstructions[0]).toEqual(updatedInstruction)
  expect(store.config.llm.instructions).toBe('custom1')
  expect(store.saveSettings).toHaveBeenCalled()
})

test('Settings LLM sliding panel mechanism', async () => {
  
  const tab = await switchToTab(wrapper, tabs.indexOf('settingsLLM'))
  const settingsComponent = wrapper.getComponent({ ref: 'settingsLLM' })
  
  // Initially should show main view
  expect(tab.find('.sliding-root').classes()).toContain('visible')
  expect(tab.find('.sliding-pane').classes()).not.toContain('visible')
  expect(settingsComponent.vm.selectedInstruction).toBeNull()
  
  // Click Add to open editor
  await tab.find('.actions button:first-child').trigger('click')
  await wrapper.vm.$nextTick()
  
  // Should show editor view
  expect(tab.find('.sliding-root').classes()).not.toContain('visible')
  expect(tab.find('.sliding-pane').classes()).toContain('visible')
  expect(settingsComponent.vm.selectedInstruction).toBeTruthy()
  
  // Simulate cancel/close
  settingsComponent.vm.onEditInstruction(null)
  await wrapper.vm.$nextTick()
  
  // Should return to main view
  expect(tab.find('.sliding-root').classes()).toContain('visible')
  expect(tab.find('.sliding-pane').classes()).not.toContain('visible')
  expect(settingsComponent.vm.selectedInstruction).toBeNull()
})

test('Settings LLM edit default instruction', async () => {
  
  const tab = await switchToTab(wrapper, tabs.indexOf('settingsLLM'))
  const settingsComponent = wrapper.getComponent({ ref: 'settingsLLM' })
  
  // Set to standard instruction
  await tab.find('.group.chat-prompt select').setValue('standard')
  await wrapper.vm.$nextTick()
  
  // Click Edit button for default instruction
  await tab.findAll('.actions button')[1].trigger('click')
  await wrapper.vm.$nextTick()
  
  // Should switch to editor view with default instruction
  expect(settingsComponent.vm.selectedInstruction).toBeTruthy()
  expect(settingsComponent.vm.selectedInstruction.id).toBe('default_standard')
  expect(settingsComponent.vm.selectedInstruction.label).toBe('settings.llm.instructions.standard')
  expect(settingsComponent.vm.selectedInstruction.instructions).toBeTruthy()
  
  // Label should not be editable for default instructions
  expect(settingsComponent.vm.selectedInstruction.id.startsWith('default_')).toBe(true)
})

test('Settings LLM save default instruction override', async () => {
  
  await switchToTab(wrapper, tabs.indexOf('settingsLLM'))
  const settingsComponent = wrapper.getComponent({ ref: 'settingsLLM' })
  
  // Create a default instruction override
  const defaultOverride = {
    id: 'default_standard',
    label: 'Standard Instructions',
    instructions: 'Custom override for standard instructions'
  }
  
  // Simulate saving the default instruction override
  settingsComponent.vm.onInstructionSaved(defaultOverride)
  await wrapper.vm.$nextTick()
  
  // Check that override was stored in config (not in customInstructions array)
  expect(store.config.llm.customInstructions).toHaveLength(0)
  expect(store.config.instructions?.chat?.standard).toBe('Custom override for standard instructions')
  
  // Check that editor is closed
  expect(settingsComponent.vm.selectedInstruction).toBeNull()
  
  // Check that save was called
  expect(store.saveSettings).toHaveBeenCalled()
})