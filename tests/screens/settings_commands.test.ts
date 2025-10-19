
import { vi, beforeAll, beforeEach, afterAll, expect, test, Mock } from 'vitest'
import { mount, VueWrapper, enableAutoUnmount } from '@vue/test-utils'
import { createI18nMock } from '../mocks'
import { useWindowMock } from '../mocks/window'
import { stubTeleport } from '../mocks/stubs'
import { store } from '../../src/services/store'
import { switchToTab, tabs } from './settings_utils'
import Settings from '../../src/screens/Settings.vue'
import { findModelSelectorPlus } from '../utils'
import { ChatModel } from 'multi-llm-ts'
import Dialog from '../../src/composables/dialog'

enableAutoUnmount(afterAll)

HTMLDialogElement.prototype.showModal = vi.fn()
HTMLDialogElement.prototype.close = vi.fn()

vi.mock('../../src/services/i18n', async () => {
  return createI18nMock()
})

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
const commandsIndex = tabs.indexOf('settingsCommands')

beforeAll(() => {

  useWindowMock()
  store.loadSettings()
  store.load = () => {}

  // override
  store.commands[1].id = 'command'
  store.config.engines.openai = {
    models: {
      chat: [ { id: 'chat1', name: 'chat1'} as ChatModel, { id: 'chat2', name: 'chat2' } as ChatModel ]
    },
    model: {
      chat: 'chat1'
    }
  }
  window.api.config.localeLLM = () => store.config.llm.locale || 'en-US'
    
  // wrapper
  wrapper = mount(Settings, { ...stubTeleport })
})

beforeEach(() => {
  vi.clearAllMocks()
})

test('Renders', async () => {

  const tab = await switchToTab(wrapper, commandsIndex)
  expect(tab.findAll('.sticky-table-container')).toHaveLength(1)
  expect(tab.findAll('.sticky-table-container tr.command')).toHaveLength(41)
  expect(tab.findAll('.sticky-table-container tr.command button')).toHaveLength(82)

})

test('Disable items', async () => {

  const tab = await switchToTab(wrapper, commandsIndex)
  expect(store.commands[0].state).toBe('enabled')
  await tab.find('.sticky-table-container tr.command:nth-of-type(1) input[type=checkbox]').trigger('click')
  expect(store.commands[0].state).toBe('disabled')
  await tab.find('.sticky-table-container tr.command:nth-of-type(1) input[type=checkbox]').trigger('click')
  expect(store.commands[0].state).toBe('enabled')

})

test('Move items', async () => {

  const tab = await switchToTab(wrapper, commandsIndex)
  const first = tab.find('.sticky-table-container tr.command').attributes('data-id')
  const second = tab.find('.sticky-table-container tr.command:nth-of-type(2)').attributes('data-id')
  await tab.find('.sticky-table-container tr.command:nth-of-type(2) button:nth-of-type(2)').trigger('click')
  expect (tab.find('.sticky-table-container tr.command').attributes('data-id')).toBe(second)
  expect (tab.find('.sticky-table-container tr.command:nth-of-type(2)').attributes('data-id')).toBe(first)
  await tab.find('.sticky-table-container tr.command:nth-of-type(1) button:nth-of-type(1)').trigger('click')
  expect (tab.find('.sticky-table-container tr.command').attributes('data-id')).toBe(first)
  expect (tab.find('.sticky-table-container tr.command:nth-of-type(2)').attributes('data-id')).toBe(second)

})

test('New command', async () => {

  const tab = await switchToTab(wrapper, commandsIndex)
  const editor = tab.findComponent({ name: 'CommandEditor' })
  await tab.find('.list-actions .list-action.new').trigger('click')

  // for test stability
  tab.vm.selected = null

  // new command creates
  expect(tab.findAll('.sticky-table-container tr.command')).toHaveLength(41)
  await editor.find('[name=label]').setValue('command')
  await editor.find('[name=template]').setValue('{input}')
  await editor.find('button.default').trigger('click')

  // check
  expect(store.commands).toHaveLength(42)
  expect(tab.findAll('.sticky-table-container tr.command')).toHaveLength(42)
  expect(store.commands[41]).toStrictEqual({
    id: expect.any(String),
    type: 'user',
    icon: '⚡️',
    label: 'command',
    action: 'chat_window',
    template: '{input}',
    shortcut: '',
    engine: '',
    model: '',
    state: 'enabled'
  })
})

test('Edit user command', async () => {

  const tab = await switchToTab(wrapper, commandsIndex)
  const editor = tab.findComponent({ name: 'CommandEditor' })
  await tab.find('.sticky-table-container tr.command:nth-of-type(42)').trigger('dblclick')

  expect(editor.find<HTMLInputElement>('[name=label]').element.value).toBe('command')
  expect(editor.find<HTMLTextAreaElement>('[name=template]').element.value).toBe('{input}')

  await editor.find('[name=label]').setValue('')
  await editor.find('[name=template]').setValue('{input2')
  await editor.find('[name=engine]').setValue('openai')
  await findModelSelectorPlus(editor).setValue('chat2')
  await editor.find('[name=icon]').setValue('😀')
  await editor.find('[name=shortcut]').setValue('S')
  await editor.find('button.default').trigger('click')

  expect((Dialog.alert as Mock).mock.calls[0][0]).toBe('commands.editor.validation.requiredFields')

  await editor.find('[name=label]').setValue('command2')
  await editor.find('button.default').trigger('click')

  expect((Dialog.alert as Mock).mock.calls[1][0]).toBe('commands.editor.validation.inputPlaceholder')

  expect(store.commands[41]).toStrictEqual({
    id: expect.any(String),
    type: 'user',
    icon: '⚡️',
    label: 'command',
    action: 'chat_window',
    template: '{input}',
    shortcut: '',
    engine: '',
    model: '',
    state: 'enabled'
  })

  await editor.find('[name=template]').setValue('{input}2')
  await editor.find('button.default').trigger('click')

  // check
  expect(store.commands).toHaveLength(42)
  expect(tab.findAll('.sticky-table-container tr.command')).toHaveLength(42)
  expect(store.commands[41]).toStrictEqual({
    id: expect.any(String),
    type: 'user',
    icon: '😀',
    label: 'command2',
    action: 'chat_window',
    template: '{input}2',
    shortcut: 'S',
    engine: 'openai',
    model: 'chat2',
    state: 'enabled'
  })
})

test('Edit system command', async () => {

  const tab = await switchToTab(wrapper, commandsIndex)
  const editor = tab.findComponent({ name: 'CommandEditor' })
  await tab.find('.sticky-table-container tr.command:nth-of-type(2)').trigger('dblclick')

  expect(store.commands[1].label).toBeUndefined()
  expect(store.commands[1].template).toBeUndefined()

  expect(editor.find<HTMLInputElement>('[name=label]').element.value).toBe('command_command_label_{input}')
  expect(editor.find<HTMLTextAreaElement>('[name=template]').element.value).toBe('command_command_template_{input}')
  expect(editor.find<HTMLAnchorElement>('[name=reset]').exists()).toBe(true)

  await editor.find('[name=label]').setValue('command')
  await editor.find('[name=template]').setValue('{input}')
  await editor.find('[name=label]').trigger('keyup')
  expect(editor.find<HTMLAnchorElement>('[name=reset]').exists()).toBe(true)

  await editor.find('button.default').trigger('click')

  expect(store.commands).toHaveLength(42)
  expect(tab.findAll('.sticky-table-container tr.command')).toHaveLength(42)
  expect(store.commands[1]).toMatchObject({
    id: 'command',
    type: 'system',
    label: 'command',
    template: '{input}',
  })

  await tab.find('.sticky-table-container tr.command:nth-of-type(2)').trigger('dblclick')

  expect(editor.find<HTMLInputElement>('[name=label]').element.value).toBe('command')
  expect(editor.find<HTMLTextAreaElement>('[name=template]').element.value).toBe('{input}')
  expect(editor.find<HTMLAnchorElement>('[name=reset]').exists()).toBe(true)

  await editor.find('[name=reset]').trigger('click')
  expect(editor.find<HTMLInputElement>('[name=label]').element.value).toBe('command_default_command_label')
  expect(editor.find<HTMLTextAreaElement>('[name=template]').element.value).toBe('command_default_command_template-{input}')
  expect(editor.find<HTMLAnchorElement>('[name=reset]').exists()).toBe(false)

  await editor.find('button.default').trigger('click')
  expect(store.commands[1].label).toBeUndefined()
  expect(store.commands[1].template).toBeUndefined()

})

test('Edit ask me anything', async () => {
  const tab = await switchToTab(wrapper, commandsIndex)
  const editor = tab.findComponent({ name: 'CommandEditor' })
  await tab.find('.sticky-table-container tr.command:nth-of-type(1)').trigger('dblclick')
  expect(editor.find<HTMLTextAreaElement>('[name=template]').element.disabled).toBe(true)
})

test('Delete command', async () => {

  const tab = await switchToTab(wrapper, commandsIndex)
  await tab.find('.sticky-table-container tr.command:nth-of-type(42)').trigger('click')
  await tab.find('.list-actions .list-action.delete').trigger('click')
  expect(tab.findAll('.sticky-table-container tr.command')).toHaveLength(41)
  expect(store.commands).toHaveLength(41)

})

test('Context Menu', async () => {

  const tab = await switchToTab(wrapper, commandsIndex)
  expect(tab.findAll('.context-menu')).toHaveLength(0)
  await tab.find('.list-actions .list-action.menu .trigger').trigger('click')
  await tab.vm.$nextTick()
  expect(tab.findAll('.context-menu')).toHaveLength(1)

})
