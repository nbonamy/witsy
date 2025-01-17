
import { vi, beforeAll, beforeEach, expect, test, Mock } from 'vitest'
import { app, Notification } from 'electron'
import { Command } from '../../src/types/index'
import { store } from '../../src/services/store'
import defaults from '../../defaults/settings.json'
import * as window from '../../src/main/window'
import Commander, { notEditablePrompts } from '../../src/automations/commander'
import Automator from '../../src/automations/automator'
import LlmMock from '../mocks/llm'
import { getCachedText, putCachedText } from '../../src/main/utils'

let cachedTextId: string|null = null
let selectedText: string|null = ''

// mock electron
vi.mock('electron', async() => {
  const Notification = vi.fn();
  Notification.prototype.show = vi.fn();
  return {
    app: {
      getPath: vi.fn(() => '')
    },
    Notification
  }
})

// mock windows
vi.mock('../../src/main/window.ts', async () => {
  return {
    openCommandPicker: vi.fn(),
    openPromptAnywhere: vi.fn((params) => {
      if (params.sourceApp === 'error') {
        throw new Error('Error')
      }
    }),
    releaseFocus: vi.fn()
  }
})

// mock automator
vi.mock('../../src/automations/automator.ts', async () => {
  const Automator = vi.fn()
  Automator.prototype.getForemostApp = vi.fn(() => ({ id: 'appId', name: 'appName', path: 'appPath', window: 'title' }))
  Automator.prototype.moveCaretBelow = vi.fn()
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
  expect(Automator.prototype.getSelectedText).toHaveBeenCalledOnce()
  expect(window.openCommandPicker).toHaveBeenCalledOnce()

  const params = (window.openCommandPicker as Mock).mock.calls[0][0]
  expect(params.textId).toBeDefined()
  expect(params.sourceApp).toStrictEqual({
    id: 'appId',
    name: 'appName',
    path: 'appPath',
    window: 'title'
  })
  expect(getCachedText(params.textId)).toBe('Grabbed text')

})

test('Error while grabbing', async () => {

  selectedText = null

  await Commander.initCommand()
  expect(Automator.prototype.getSelectedText).toHaveBeenCalled()
  expect(Notification).toHaveBeenCalledWith({ title: 'Witsy', body: expect.stringMatching(/error/) })

})

test('No text to grab', async () => {

  selectedText = ''

  await Commander.initCommand()
  expect(Automator.prototype.getSelectedText).toHaveBeenCalled()
  expect(Notification).toHaveBeenCalledWith({ title: 'Witsy', body: expect.stringMatching(/highlight/) })

})

test('Prompt command', async () => {

  const commander = new Commander()
  const command = buildCommand('chat_window')
  command.id = notEditablePrompts[0]
  await commander.execCommand(app, { textId: cachedTextId!, sourceApp: 'appPath', command })

  expect(window.openPromptAnywhere).toHaveBeenCalledOnce()

  expect(Automator.prototype.moveCaretBelow).not.toHaveBeenCalled()
  expect(Automator.prototype.pasteText).not.toHaveBeenCalled()
  expect(Automator.prototype.copyToClipboard).not.toHaveBeenCalled()

  const args = (window.openPromptAnywhere as Mock).mock.calls[0][0]
  const prompt = getCachedText(args.promptId)
  expect(prompt).toBe('Explain this:\n"""Grabbed text"""')
  expect(args.sourceApp).toBe('appPath')
  expect(args.engine).toBe('mock')
  expect(args.model).toBe('chat')
  expect(args.execute).toBe(false)
  expect(args.replace).toBe(true)

})

test('Other commands', async () => {

  const commander = new Commander()
  const command = buildCommand('chat_window')
  await commander.execCommand(app, { textId: cachedTextId!, sourceApp: '', command })

  expect(window.openPromptAnywhere).toHaveBeenCalledOnce()

  expect(Automator.prototype.moveCaretBelow).not.toHaveBeenCalled()
  expect(Automator.prototype.pasteText).not.toHaveBeenCalled()
  expect(Automator.prototype.copyToClipboard).not.toHaveBeenCalled()

  const args = (window.openPromptAnywhere as Mock).mock.calls[0][0]
  const prompt = getCachedText(args.promptId)
  expect(prompt).toBe('Explain this:\n"""Grabbed text"""')
  expect(args.engine).toBe('mock')
  expect(args.model).toBe('chat')
  expect(args.execute).toBe(true)
  expect(args.replace).toBe(true)

})

test('No text', async () => {
  
  const commander = new Commander()
  const command = buildCommand('chat_window')
  expect(await commander.execCommand(app, { textId: 'unknown', sourceApp: '', command })).toBe(false)

  expect(window.openPromptAnywhere).not.toHaveBeenCalled()
  expect(window.releaseFocus).not.toHaveBeenCalledOnce()

})

test('Error while executing', async () => {
  
  const commander = new Commander()
  const command = buildCommand('chat_window')
  expect(await commander.execCommand(app, { textId: cachedTextId!, sourceApp: 'error', command })).toBe(false)

  expect(window.openPromptAnywhere).toHaveBeenCalledOnce()

})
