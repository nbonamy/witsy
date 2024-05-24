
import { vi, beforeAll, beforeEach, expect, test } from 'vitest'
import { Command } from '../../src/types/index.d'
import { store } from '../../src/services/store'
import defaults from '../../defaults/settings.json'
import * as window from '../../src/main/window'
import Commander from '../../src/automations/commander'
import Automator from '../../src/automations/automator'
import LlmMock from '../mocks/llm'

let cachedTextId: string = null

// mock config
vi.mock('../../src/main/config.ts', async () => {
  return {
    loadSettings: () => defaults,
  }
})  

// mock windows
vi.mock('../../src/main/window.ts', async () => {
  return {
    openCommandPalette: vi.fn(),
    openWaitingPanel: vi.fn(),
    closeWaitingPanel: vi.fn(),
    openChatWindow: vi.fn(),
    hideWindows: vi.fn(),
    restoreWindows: vi.fn(),
    releaseFocus: vi.fn()
  }
})

// mock automator
vi.mock('../../src/automations/automator.ts', async () => {
  const Automator = vi.fn()
  Automator.prototype.moveCaretBelow =  vi.fn()
  Automator.prototype.getSelectedText = vi.fn(() => 'Grabbed text')
  Automator.prototype.pasteText = vi.fn()
  Automator.prototype.copyToClipboard = vi.fn()
  return { default: Automator }
})

beforeAll(() => {

  // init store
  store.config = defaults
  store.config.llm.engine = 'mock'
  store.config.instructions = {
    default: 'You are a chat assistant',
    titling: 'You are a titling assistant'
  }
  store.config.getActiveModel = () => 'chat'

})

beforeEach(() => {

  // clear mocks
  vi.clearAllMocks()

  // store some text
  cachedTextId = Commander.putCachedText('Grabbed text')

})

const buildCommand = (action: 'chat_window' | 'paste_below' | 'paste_in_place' | 'clipboard_copy'): Command => {
  return {
    id: '',
    type: 'system',
    icon: '',
    label: '',
    action: action,
    template: 'Explain this:\n"""{input}"""',
    shortcut: '',
    state: 'enabled',
    engine: '',
    model: ''
  }
}

test('Prepare command', async () => {

  await Commander.initCommand()

  expect(window.hideWindows).toHaveBeenCalledOnce()
  expect(window.releaseFocus).toHaveBeenCalledOnce()
  expect(Automator.prototype.getSelectedText).toHaveBeenCalledOnce()
  expect(window.openCommandPalette).toHaveBeenCalledOnce()

  const textId = window.openCommandPalette.mock.calls[0][0]
  expect(Commander.getCachedText(textId)).toBe('Grabbed text')

})

test('Chat Window command', async () => {

  const commander = new Commander(new LlmMock(store.config))
  const command = buildCommand('chat_window')
  await commander.execCommand(null, cachedTextId, command)

  expect(window.openChatWindow).toHaveBeenCalledOnce()
  expect(window.closeWaitingPanel).toHaveBeenCalledOnce()
  expect(window.restoreWindows).toHaveBeenCalledOnce()
  expect(window.releaseFocus).toHaveBeenCalledOnce()

  expect(Automator.prototype.moveCaretBelow).not.toHaveBeenCalled()
  expect(Automator.prototype.pasteText).not.toHaveBeenCalled()
  expect(Automator.prototype.copyToClipboard).not.toHaveBeenCalled()

  const args = window.openChatWindow.mock.calls[0][0]
  const prompt = Commander.getCachedText(args.promptId)
  expect(prompt).toBe('Explain this:\n"""Grabbed text"""')
  expect(args.engine).toBe('mock')
  expect(args.model).toBe('chat')

})

test('Paste in-place command', async () => {

  const commander = new Commander(new LlmMock(store.config))
  const command = buildCommand('paste_in_place')
  await commander.execCommand(null, cachedTextId, command)

  expect(window.openChatWindow).not.toHaveBeenCalled()
  expect(Automator.prototype.moveCaretBelow).not.toHaveBeenCalled()
  expect(Automator.prototype.pasteText).toHaveBeenCalledOnce()
  expect(Automator.prototype.copyToClipboard).not.toHaveBeenCalled()

  expect(Automator.prototype.pasteText).toHaveBeenCalledWith('[{"role":"user","content":"Explain this:\\n\\"\\"\\"Grabbed text\\"\\"\\""},{"role":"assistant","content":"Be kind. Don\'t mock me"}]')

})

test('Paste below command', async () => {

  const commander = new Commander(new LlmMock(store.config))
  const command = buildCommand('paste_below')
  await commander.execCommand(null, cachedTextId, command)

  expect(window.openChatWindow).not.toHaveBeenCalled()
  expect(Automator.prototype.moveCaretBelow).toHaveBeenCalledOnce()
  expect(Automator.prototype.pasteText).toHaveBeenCalledOnce()
  expect(Automator.prototype.copyToClipboard).not.toHaveBeenCalled()

  expect(Automator.prototype.pasteText).toHaveBeenCalledWith('[{"role":"user","content":"Explain this:\\n\\"\\"\\"Grabbed text\\"\\"\\""},{"role":"assistant","content":"Be kind. Don\'t mock me"}]')

})

test('Copy to clipboard command', async () => {

  const commander = new Commander(new LlmMock(store.config))
  const command = buildCommand('clipboard_copy')
  await commander.execCommand(null, cachedTextId, command)

  expect(window.openChatWindow).not.toHaveBeenCalled()
  expect(Automator.prototype.moveCaretBelow).not.toHaveBeenCalled()
  expect(Automator.prototype.pasteText).not.toHaveBeenCalled()
  expect(Automator.prototype.copyToClipboard).toHaveBeenCalledOnce()

  expect(Automator.prototype.copyToClipboard).toHaveBeenCalledWith('[{"role":"user","content":"Explain this:\\n\\"\\"\\"Grabbed text\\"\\"\\""},{"role":"assistant","content":"Be kind. Don\'t mock me"}]')
  //expect(clipboard.readText()).toBe('[{"role":"user","content":"Explain this:\\n\\"\\"\\"Grabbed text\\"\\"\\""},{"role":"assistant","content":"Be kind. Don\'t mock me"}]')

})
  