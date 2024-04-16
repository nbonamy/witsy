
import { vi, beforeEach, expect, test } from 'vitest'
import { store } from '../src/services/store'
import { Command } from '../src/index.d'
import defaults from '../defaults/settings.json'
import * as commander from '../src/automations/commander'
import * as window from '../src/main/window'
import Automator from '../src/automations/automator'
import LlmMock from './mocks/llm'

// mock config
vi.mock('../src/main/config.ts', async () => {
  return {
    settingsFilePath: () => '',
    loadSettings: () => defaults,
  }
})  

// mock windows
vi.mock('../src/main/window.ts', async () => {
  return {
    openCommandPalette: vi.fn(),
    openWaitingPanel: vi.fn(),
    closeWaitingPanel: vi.fn(),
    openChatWindow: vi.fn(),
    hideActiveWindows: vi.fn(),
    releaseFocus: vi.fn()
  }
})

// mock automator
vi.mock('../src/automations/automator.ts', async () => {
  const Automator = vi.fn()
  Automator.prototype.moveCaretBelow =  vi.fn()
  Automator.prototype.getSelectedText = vi.fn(() => 'Grabbed text')
  Automator.prototype.pasteText = vi.fn()
  Automator.prototype.copyToClipboard = vi.fn()
  return { default: Automator }
})

beforeEach(() => {

  // init store
  store.config = defaults
  store.config.llm.engine = 'mock'
  store.config.instructions = {
    default: 'You are a chat assistant',
    routing: 'You are a routing assistant',
    titling: 'You are a titling assistant'
  }
  store.config.getActiveModel = () => 'chat'

  // reset mocks call history
  vi.clearAllMocks()

})

const buildCommand = (action: 'chat_window' | 'paste_below' | 'paste_in_place' | 'clipboard_copy'): Command => {
  return {
    id: '',
    type: 'system',
    icon: '',
    label: '',
    action: action,
    template: 'Explain this:\n"""{input}"""',
    state: 'enabled',
    engine: '',
    model: ''
  }
}

test('Prepare command', async () => {

  await commander.prepareCommand()

  expect(window.hideActiveWindows).toHaveBeenCalledOnce()
  expect(window.releaseFocus).toHaveBeenCalledOnce()
  expect(Automator.prototype.getSelectedText).toHaveBeenCalledOnce()
  expect(window.openCommandPalette).toHaveBeenCalledOnce()
  expect(window.openCommandPalette).toHaveBeenCalledWith('Grabbed text')

})

test('Chat Window command', async () => {

  const command = buildCommand('chat_window')
  await commander.runCommand(null, new LlmMock(store.config), 'Grabbed text', command)

  expect(window.openChatWindow).toHaveBeenCalledOnce()
  expect(window.closeWaitingPanel).toHaveBeenCalledOnce()
  expect(window.releaseFocus).toHaveBeenCalledOnce()

  expect(Automator.prototype.moveCaretBelow).not.toHaveBeenCalled()
  expect(Automator.prototype.pasteText).not.toHaveBeenCalled()
  expect(Automator.prototype.copyToClipboard).not.toHaveBeenCalled()

  expect(window.openChatWindow).toHaveBeenCalledWith({
    engine: 'mock',
    model: 'chat',
    prompt: 'Explain this:\n"""Grabbed text"""'
  })

})

test('Paste in-place command', async () => {

  const command = buildCommand('paste_in_place')
  await commander.runCommand(null, new LlmMock(store.config), 'Grabbed text', command)

  expect(window.openChatWindow).not.toHaveBeenCalled()
  expect(Automator.prototype.moveCaretBelow).not.toHaveBeenCalled()
  expect(Automator.prototype.pasteText).toHaveBeenCalledOnce()
  expect(Automator.prototype.copyToClipboard).not.toHaveBeenCalled()

  expect(Automator.prototype.pasteText).toHaveBeenCalledWith('[{"role":"user","content":"Explain this:\\n\\"\\"\\"Grabbed text\\"\\"\\""},{"role":"assistant","content":"Be kind. Don\'t mock me"}]')

})

test('Paste below command', async () => {

  const command = buildCommand('paste_below')
  await commander.runCommand(null, new LlmMock(store.config), 'Grabbed text', command)

  expect(window.openChatWindow).not.toHaveBeenCalled()
  expect(Automator.prototype.moveCaretBelow).toHaveBeenCalledOnce()
  expect(Automator.prototype.pasteText).toHaveBeenCalledOnce()
  expect(Automator.prototype.copyToClipboard).not.toHaveBeenCalled()

  expect(Automator.prototype.pasteText).toHaveBeenCalledWith('[{"role":"user","content":"Explain this:\\n\\"\\"\\"Grabbed text\\"\\"\\""},{"role":"assistant","content":"Be kind. Don\'t mock me"}]')

})

test('Copy to clipboard command', async () => {

  const command = buildCommand('clipboard_copy')
  await commander.runCommand(null, new LlmMock(store.config), 'Grabbed text', command)

  expect(window.openChatWindow).not.toHaveBeenCalled()
  expect(Automator.prototype.moveCaretBelow).not.toHaveBeenCalled()
  expect(Automator.prototype.pasteText).not.toHaveBeenCalled()
  expect(Automator.prototype.copyToClipboard).toHaveBeenCalledOnce()

  expect(Automator.prototype.copyToClipboard).toHaveBeenCalledWith('[{"role":"user","content":"Explain this:\\n\\"\\"\\"Grabbed text\\"\\"\\""},{"role":"assistant","content":"Be kind. Don\'t mock me"}]')
  //expect(clipboard.readText()).toBe('[{"role":"user","content":"Explain this:\\n\\"\\"\\"Grabbed text\\"\\"\\""},{"role":"assistant","content":"Be kind. Don\'t mock me"}]')

})
  