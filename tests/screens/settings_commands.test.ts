
import { vi, beforeAll, beforeEach, afterAll, expect, test, Mock } from 'vitest'
import { mount, VueWrapper, enableAutoUnmount } from '@vue/test-utils'
import { createI18nMock } from '../mocks'
import { useWindowMock } from '../mocks/window'
import { stubTeleport } from '../mocks/stubs'
import { store } from '../../src/renderer/services/store'
import { switchToTab, tabs } from './settings_utils'
import Settings from '../../src/renderer/screens/Settings.vue'
import { findModelSelectorPlus } from '../utils'
import { ChatModel } from 'multi-llm-ts'
import Dialog from '../../src/renderer/utils/dialog'

enableAutoUnmount(afterAll)

HTMLDialogElement.prototype.showModal = vi.fn()
HTMLDialogElement.prototype.close = vi.fn()

vi.mock('../../src/renderer/services/i18n', async () => {
  return createI18nMock()
})

vi.mock('../../src/renderer/services/store.ts', async (importOriginal) => {
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
  expect(tab.findAll('.list-with-toolbar')).toHaveLength(1)
  expect(tab.findAll('.list-with-toolbar table tr.command')).toHaveLength(41)
  expect(tab.findAll('.toolbar')).toHaveLength(1)

})

test('Disable items', async () => {

  const tab = await switchToTab(wrapper, commandsIndex)
  expect(store.commands[0].state).toBe('enabled')
  // Click the checkbox input inside ButtonSwitch
  await tab.find('.list-with-toolbar table tr.command:nth-of-type(1) td.enabled .button-switch input.switch-input').trigger('change')
  expect(store.commands[0].state).toBe('disabled')
  await tab.find('.list-with-toolbar table tr.command:nth-of-type(1) td.enabled .button-switch input.switch-input').trigger('change')
  expect(store.commands[0].state).toBe('enabled')

})

test('Move items', async () => {

  const tab = await switchToTab(wrapper, commandsIndex)
  const first = tab.find('.list-with-toolbar table tr.command').attributes('data-id')
  const second = tab.find('.list-with-toolbar table tr.command:nth-of-type(2)').attributes('data-id')

  // Open context menu on second row and click move up
  await tab.find('.list-with-toolbar table tr.command:nth-of-type(2) .context-menu-trigger .trigger').trigger('click')
  await tab.vm.$nextTick()
  await tab.findAll('.context-menu .item')[1].trigger('click') // moveUp is second item
  await tab.vm.$nextTick()

  expect (tab.find('.list-with-toolbar table tr.command').attributes('data-id')).toBe(second)
  expect (tab.find('.list-with-toolbar table tr.command:nth-of-type(2)').attributes('data-id')).toBe(first)

  // Open context menu on first row and click move down
  await tab.find('.list-with-toolbar table tr.command:nth-of-type(1) .context-menu-trigger .trigger').trigger('click')
  await tab.vm.$nextTick()
  await tab.findAll('.context-menu .item')[2].trigger('click') // moveDown is third item
  await tab.vm.$nextTick()

  expect (tab.find('.list-with-toolbar table tr.command').attributes('data-id')).toBe(first)
  expect (tab.find('.list-with-toolbar table tr.command:nth-of-type(2)').attributes('data-id')).toBe(second)

})

test('New command', async () => {

  const tab = await switchToTab(wrapper, commandsIndex)
  const editor = tab.findComponent({ name: 'CommandEditor' })
  await tab.find('.toolbar button[name="new"]').trigger('click')

  // new command creates
  expect(tab.findAll('.list-with-toolbar table tr.command')).toHaveLength(41)
  await editor.find('[name=label]').setValue('command')
  await editor.find('[name=template]').setValue('{input}')
  await editor.find('button.default').trigger('click')

  // check
  expect(store.commands).toHaveLength(42)
  expect(tab.findAll('.list-with-toolbar table tr.command')).toHaveLength(42)
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

  // Click edit button for the 42nd command
  await tab.find('.list-with-toolbar table tr.command:nth-of-type(42) .button-icon.edit').trigger('click')

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
  expect(tab.findAll('.list-with-toolbar table tr.command')).toHaveLength(42)
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
  await tab.find('.list-with-toolbar table tr.command:nth-of-type(2) .button-icon.edit').trigger('click')

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
  expect(tab.findAll('.list-with-toolbar table tr.command')).toHaveLength(42)
  expect(store.commands[1]).toMatchObject({
    id: 'command',
    type: 'system',
    label: 'command',
    template: '{input}',
  })

  await tab.find('.list-with-toolbar table tr.command:nth-of-type(2) .button-icon.edit').trigger('click')

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
  await tab.find('.list-with-toolbar table tr.command:nth-of-type(1) .button-icon.edit').trigger('click')
  expect(editor.find<HTMLTextAreaElement>('[name=template]').element.disabled).toBe(true)
})

test('Delete command', async () => {

  const tab = await switchToTab(wrapper, commandsIndex)
  // Check current command count first
  const currentCount = tab.findAll('.list-with-toolbar table tr.command').length
  expect(currentCount).toBe(42)

  // Select the last command via checkbox
  await tab.find(`.list-with-toolbar table tr.command:nth-of-type(${currentCount}) td.name input[type="checkbox"]`).setValue(true)
  await tab.vm.$nextTick()

  // Click the delete button in the toolbar
  await tab.find('.toolbar button[name="delete"]').trigger('click')
  await tab.vm.$nextTick()

  expect(tab.findAll('.list-with-toolbar table tr.command')).toHaveLength(41)
  expect(store.commands).toHaveLength(41)

})

test('Context Menu', async () => {

  const tab = await switchToTab(wrapper, commandsIndex)
  expect(tab.findAll('.context-menu')).toHaveLength(0)
  await tab.find('.toolbar .toolbar-menu .trigger').trigger('click')
  await tab.vm.$nextTick()
  expect(tab.findAll('.context-menu')).toHaveLength(1)

})
