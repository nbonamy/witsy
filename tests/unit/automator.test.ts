
import { vi, expect, test, beforeEach, Mock } from 'vitest'
import { clipboard } from 'electron'
import Automator, { AutomationAction } from '../../src/automations/automator'
import MacosAutomator from '../../src/automations/macos'
import RobotAutomator from '../../src/automations/robot'
import * as window from '../../src/main/window'

vi.mock('electron', () => ({
  clipboard: {
    readText: vi.fn(),
    writeText: vi.fn()
  }
}))

vi.mock(`../../src/automations/${process.platform === 'darwin' ? 'macos' : 'robot'}.ts`, async () => {
  const MockAutomator = vi.fn()
  MockAutomator.prototype.getForemostApp = vi.fn()
  MockAutomator.prototype.selectAll = vi.fn()
  MockAutomator.prototype.moveCaretBelow = vi.fn()
  MockAutomator.prototype.copySelectedText = vi.fn()
  MockAutomator.prototype.deleteSelectedText = vi.fn()
  MockAutomator.prototype.pasteText = vi.fn()
  return { default: MockAutomator }
})

// mock windows
vi.mock('../../src/main/window.ts', async () => {
  return {
    openPromptAnywhere: vi.fn(),
    closePromptAnywhere: vi.fn(),
    releaseFocus: vi.fn(),
    openMainWindow: vi.fn(),
  }
})

beforeEach(() => {
  vi.clearAllMocks()
})

const prototype = process.platform === 'darwin' ? MacosAutomator.prototype : RobotAutomator.prototype

test('Create', async () => {
  const automator = new Automator()
  expect(automator).toBeTruthy()
})

test('Foremost app', async () => {
  const automator = new Automator()
  await automator.getForemostApp()
  expect(prototype.getForemostApp).toHaveBeenCalled()
})

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
  expect(clipboard.writeText).toHaveBeenLastCalledWith('text')
})

test('Insert below', async () => {

  await Automator.automate('Explain this', null, AutomationAction.INSERT_BELOW)

  expect(window.releaseFocus).toHaveBeenCalledOnce()

  expect(prototype.moveCaretBelow).toHaveBeenCalled()

  expect(clipboard.readText).toHaveBeenLastCalledWith()
  expect((clipboard.writeText as Mock).mock.calls[0]).toStrictEqual(['Explain this'])
  expect((clipboard.writeText as Mock).mock.calls[1]).toStrictEqual([undefined])
  expect(prototype.pasteText).toHaveBeenLastCalledWith()

})

test('Replace', async () => {

  await Automator.automate('Explain this', null, AutomationAction.REPLACE)

  expect(window.releaseFocus).toHaveBeenCalledOnce()

  expect(prototype.moveCaretBelow).not.toHaveBeenCalled()

  expect(clipboard.readText).toHaveBeenLastCalledWith()
  expect((clipboard.writeText as Mock).mock.calls[0]).toStrictEqual(['Explain this'])
  expect((clipboard.writeText as Mock).mock.calls[1]).toStrictEqual([undefined])
  expect(prototype.pasteText).toHaveBeenLastCalledWith()

})
