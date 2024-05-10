
import { vi, expect, test } from 'vitest'
import { clipboard } from 'electron'
import Automator from '../../src/automations/automator'
import MacosAutomator from '../../src/automations/macos'
import RobotAutomator from '../../src/automations/robot'

vi.mock('electron', () => ({
  clipboard: {
    readText: vi.fn(),
    writeText: vi.fn()
  }
}))

vi.mock(`../../src/automations/${process.platform === 'darwin' ? 'macos' : 'robot'}.ts`, async () => {
  const MockAutomator = vi.fn()
  MockAutomator.prototype.selectAll = vi.fn()
  MockAutomator.prototype.moveCaretBelow = vi.fn()
  MockAutomator.prototype.copySelectedText = vi.fn()
  MockAutomator.prototype.pasteText = vi.fn()
  return { default: MockAutomator }
})

test('Create', async () => {
  const automator = new Automator()
  expect(automator).toBeTruthy()
})

const prototype = process.platform === 'darwin' ? MacosAutomator.prototype : RobotAutomator.prototype

test('Select all', async () => {
  const automator = new Automator()
  await automator.selectAll()
  expect(prototype.selectAll).toHaveBeenCalled()
})

test('Move caret below', async () => {
  const automator = new Automator()
  await automator.moveCaretBelow()
  expect(prototype.moveCaretBelow).toHaveBeenCalled()
})

test('Get selected text', async () => {
  const automator = new Automator()
  await automator.getSelectedText()
  expect(prototype.copySelectedText).toHaveBeenCalled()
})

test('Paste text', async () => {
  const automator = new Automator()
  await automator.pasteText('text')
  expect(prototype.pasteText).toHaveBeenCalled()
})

test('Copy to clipboard', async () => {
  const automator = new Automator()
  await automator.copyToClipboard('text')
  expect(clipboard.writeText).toHaveBeenCalledWith('text')
})
