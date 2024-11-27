
import { vi, beforeAll, beforeEach, expect, test } from 'vitest'
import { Notification } from 'electron'
import { Command } from '../../src/types/index.d'
import { store } from '../../src/services/store'
import defaults from '../../defaults/settings.json'
import * as window from '../../src/main/window'
import Commander, { notEditablePrompts } from '../../src/automations/commander'
import Automator from '../../src/automations/automator'
import LlmMock from '../mocks/llm'
import { getCachedText, putCachedText } from '../../src/main/utils'

let cachedTextId: string = null
let selectedText: string|null = ''

// mock electron
vi.mock('electron', async() => {
  const Notification = vi.fn();
  Notification.prototype.show = vi.fn();
  return {
    Notification
  }
})

// mock windows
vi.mock('../../src/main/window.ts', async () => {
  return {
    openCommandPicker: vi.fn(),
    openCommandResult: vi.fn(),
    openPromptAnywhere: vi.fn(),
    hideWindows: vi.fn(),
    restoreWindows: vi.fn(),
    releaseFocus: vi.fn()
  }
})

// mock automator
vi.mock('../../src/automations/automator.ts', async () => {
  const Automator = vi.fn()
  Automator.prototype.moveCaretBelow =  vi.fn()
  Automator.prototype.getSelectedText = vi.fn(() => selectedText)
  Automator.prototype.pasteText = vi.fn()
  Automator.prototype.copyToClipboard = vi.fn()
  return { default: Automator }
})

// mock llm
vi.mock('../../src/llms/llm.ts', async () => {
  const LlmFactory = vi.fn()
  LlmFactory.prototype.getChatEngineModel = () => ({ engine: 'mock', model: 'chat' })
  LlmFactory.prototype.igniteEngine = () => new LlmMock(store.config.engines.mock)
	return { default: LlmFactory }
})

beforeAll(() => {
  store.config = JSON.parse(JSON.stringify(defaults))
})

beforeEach(() => {

  // clear mocks
  vi.clearAllMocks()

  // store some text
  cachedTextId = putCachedText('Grabbed text')

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

  selectedText = 'Grabbed text'

  await Commander.initCommand()

  expect(window.hideWindows).toHaveBeenCalledOnce()
  expect(window.releaseFocus).toHaveBeenCalledOnce()
  expect(Automator.prototype.getSelectedText).toHaveBeenCalledOnce()
  expect(window.openCommandPicker).toHaveBeenCalledOnce()

  const textId = window.openCommandPicker.mock.calls[0][0]
  expect(getCachedText(textId)).toBe('Grabbed text')

})

test('Error while grabbing', async () => {

  selectedText = null

  await Commander.initCommand()

  expect(window.hideWindows).toHaveBeenCalledOnce()
  expect(window.releaseFocus).toHaveBeenCalledOnce()
  expect(Automator.prototype.getSelectedText).toHaveBeenCalledOnce()

  expect(Notification).toHaveBeenCalledWith({ title: 'Witsy', body: expect.stringMatching(/error/) })

  expect(window.restoreWindows).toHaveBeenCalledOnce()

})

test('No text to grab', async () => {

  selectedText = ''

  await Commander.initCommand()

  expect(window.hideWindows).toHaveBeenCalledOnce()
  expect(window.releaseFocus).toHaveBeenCalledOnce()
  expect(Automator.prototype.getSelectedText).toHaveBeenCalledOnce()

  expect(Notification).toHaveBeenCalledWith({ title: 'Witsy', body: expect.stringMatching(/highlight/) })

  expect(window.restoreWindows).toHaveBeenCalledOnce()

})

test('Prompt command', async () => {

  const commander = new Commander()
  const command = buildCommand('chat_window')
  command.id = notEditablePrompts[0]
  await commander.execCommand(null, cachedTextId, command)

  expect(window.openPromptAnywhere).toHaveBeenCalledOnce()
  expect(window.restoreWindows).toHaveBeenCalledOnce()
  expect(window.releaseFocus).toHaveBeenCalledOnce()

  expect(Automator.prototype.moveCaretBelow).not.toHaveBeenCalled()
  expect(Automator.prototype.pasteText).not.toHaveBeenCalled()
  expect(Automator.prototype.copyToClipboard).not.toHaveBeenCalled()

  const args = window.openPromptAnywhere.mock.calls[0][0]
  const prompt = getCachedText(args.promptId)
  expect(prompt).toBe('Explain this:\n"""Grabbed text"""')
  expect(args.engine).toBe('mock')
  expect(args.model).toBe('chat')

})

test('Other commands', async () => {

  const commander = new Commander()
  const command = buildCommand('chat_window')
  await commander.execCommand(null, cachedTextId, command)

  expect(window.openCommandResult).toHaveBeenCalledOnce()

  expect(Automator.prototype.moveCaretBelow).not.toHaveBeenCalled()
  expect(Automator.prototype.pasteText).not.toHaveBeenCalled()
  expect(Automator.prototype.copyToClipboard).not.toHaveBeenCalled()

  const args = window.openCommandResult.mock.calls[0][0]
  const prompt = getCachedText(args.promptId)
  expect(prompt).toBe('Explain this:\n"""Grabbed text"""')
  expect(args.engine).toBe('mock')
  expect(args.model).toBe('chat')

})

// test('Paste in-place command', async () => {

//   const commander = new Commander()
//   const command = buildCommand('paste_in_place')
//   await commander.execCommand(null, cachedTextId, command)

//   expect(window.openChatWindow).not.toHaveBeenCalled()
//   expect(Automator.prototype.moveCaretBelow).not.toHaveBeenCalled()
//   expect(Automator.prototype.pasteText).toHaveBeenCalledOnce()
//   expect(Automator.prototype.copyToClipboard).not.toHaveBeenCalled()

//   expect(Automator.prototype.pasteText).toHaveBeenCalledWith('[{"role":"user","content":"Explain this:\\n\\"\\"\\"Grabbed text\\"\\"\\""},{"role":"assistant","content":"Be kind. Don\'t mock me"}]')

// })

// test('Paste below command', async () => {

//   const commander = new Commander()
//   const command = buildCommand('paste_below')
//   await commander.execCommand(null, cachedTextId, command)

//   expect(window.openChatWindow).not.toHaveBeenCalled()
//   expect(Automator.prototype.moveCaretBelow).toHaveBeenCalledOnce()
//   expect(Automator.prototype.pasteText).toHaveBeenCalledOnce()
//   expect(Automator.prototype.copyToClipboard).not.toHaveBeenCalled()

//   expect(Automator.prototype.pasteText).toHaveBeenCalledWith('[{"role":"user","content":"Explain this:\\n\\"\\"\\"Grabbed text\\"\\"\\""},{"role":"assistant","content":"Be kind. Don\'t mock me"}]')

// })

// test('Copy to clipboard command', async () => {

//   const commander = new Commander()
//   const command = buildCommand('clipboard_copy')
//   await commander.execCommand(null, cachedTextId, command)

//   expect(window.openChatWindow).not.toHaveBeenCalled()
//   expect(Automator.prototype.moveCaretBelow).not.toHaveBeenCalled()
//   expect(Automator.prototype.pasteText).not.toHaveBeenCalled()
//   expect(Automator.prototype.copyToClipboard).toHaveBeenCalledOnce()

//   expect(Automator.prototype.copyToClipboard).toHaveBeenCalledWith('[{"role":"user","content":"Explain this:\\n\\"\\"\\"Grabbed text\\"\\"\\""},{"role":"assistant","content":"Be kind. Don\'t mock me"}]')
//   //expect(clipboard.readText()).toBe('[{"role":"user","content":"Explain this:\\n\\"\\"\\"Grabbed text\\"\\"\\""},{"role":"assistant","content":"Be kind. Don\'t mock me"}]')

// })
  
