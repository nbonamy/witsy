
import { vi, beforeAll, expect, test } from 'vitest'
import * as commands from '../../src/services/commands'
import { store } from '../../src/services/store'

beforeAll(() => {

  // api
  window.api = {
    commands: {
      load: vi.fn(() => []),
      save: vi.fn(),
    }
  }

})

test('New command', () => {
  const command = commands.newCommand()
  expect(command).toStrictEqual({
    id: null,
    type: 'user',
    icon: null,
    label: 'New Command',
    action: 'chat_window',
    template: null,
    shortcut: '',
    engine: '',
    model: '',
    state: 'enabled'
  })
})

test('Install commands', () => {
  commands.loadCommands()
  expect(window.api.commands.load).toHaveBeenCalled()
  expect(store.commands).toStrictEqual([])
})

test('Save commands', () => {
  commands.saveCommands()
  expect(window.api.commands.save).toHaveBeenCalled()
})
