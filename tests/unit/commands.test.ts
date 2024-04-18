
import { vi, expect, test } from 'vitest'
import { store } from '../../src/services/store'
import * as commands from '../../src/services/commands'
import defaultCommands from '../../defaults/commands.json'
import fs from 'fs'

vi.mock('fs', async () => {
  return { default: {
    readFileSync: vi.fn(() => '{}'),
    writeFileSync: vi.fn(),
  }}
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
  commands.installCommands()
  expect(store.commands).toStrictEqual(defaultCommands)
})

test('Save commands', () => {
  commands.saveCommands()
  //TODO
  //expect(fs.writeFileSync).toHaveBeenCalled()
})
