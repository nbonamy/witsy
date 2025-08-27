
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

// mock electron
vi.mock('electron', async() => {
  const Notification = vi.fn();
  Notification.prototype.show = vi.fn();
  return {
    app: {
      getLocale: vi.fn(() => 'en-US'),
      getPath: vi.fn(() => '')
    },
    safeStorage: {
      isEncryptionAvailable: vi.fn(() => true),
      encryptString: vi.fn((data) => `encrypted-${data}`),
      decryptString: vi.fn((data) => data.toString('latin1'))
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

// mock llm
vi.mock('../../src/llms/manager.ts', async () => {
  const LlmManager = vi.fn()
  LlmManager.prototype.getChatEngineModel = () => ({ engine: 'mock', model: 'chat' })
  LlmManager.prototype.igniteEngine = () => new LlmMock(store.config.engines.mock)
	return { default: LlmManager }
})

// mock i18n
vi.mock('../../src/main/i18n.ts', async () => {
  return {
    useI18n: vi.fn(() => (key: string) => key),
    useI18nLlm: vi.fn(() => (key: string) => `${key}:"{input}"`)
  }
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

const buildCommand = (action: 'chat_window' | 'paste_below' | 'paste_in_place' | 'clipboard_copy', template?: string): Command => {
  return {
    id: 'id',
    type: 'system',
    icon: '',
    label: '',
    action: action,
    template: template,
    shortcut: '',
    state: 'enabled',
    engine: '',
    model: ''
  }
}

test('Prepare command', async () => {

  vi.mocked(Automator.prototype.getSelectedText).mockResolvedValue('Grabbed text')

  await Commander.initCommand(app, 100)
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

  vi.mocked(Automator.prototype.getSelectedText).mockResolvedValue(null as any)

  await Commander.initCommand(app, 100)
  expect(Automator.prototype.getSelectedText).toHaveBeenCalled()
  expect(Notification).toHaveBeenLastCalledWith({ title: 'StationOne', body: 'automation.grabError' })

})

test('No text to grab', async () => {

  vi.mocked(Automator.prototype.getSelectedText).mockResolvedValue('')

  await Commander.initCommand(app, 100)
  expect(Automator.prototype.getSelectedText).toHaveBeenCalled()
  expect(Notification).toHaveBeenLastCalledWith({ title: 'StationOne', body: 'automation.commander.emptyText' })

})

test('Prompt command', async () => {

  const commander = new Commander()
  const command = buildCommand('chat_window')
  command.id = notEditablePrompts[0]
  await commander.execCommand(app, {
    textId: cachedTextId!,
    sourceApp: {
      id: 'appId',
      name: 'appName',
      path: 'appPath',
      window: 'title'
    },
    action: 'default',
    command
  })

  expect(window.openPromptAnywhere).toHaveBeenCalledOnce()

  expect(Automator.prototype.moveCaretBelow).not.toHaveBeenCalled()
  expect(Automator.prototype.pasteText).not.toHaveBeenCalled()

  const args = (window.openPromptAnywhere as Mock).mock.calls[0][0]
  const prompt = getCachedText(args.promptId)
  expect(prompt).toBe('commands.commands.00000000-0000-0000-0000-000000000000.template:"Grabbed text"')
  expect(args.sourceApp).toMatchObject({
    id: 'appId',
    name: 'appName',
    path: 'appPath',
    window: 'title'
  })
  expect(args.engine).toBe('mock')
  expect(args.model).toBe('chat')
  expect(args.execute).toBe(false)
  expect(args.replace).toBe(true)

})

test('Other commands', async () => {

  const commander = new Commander()
  const command = buildCommand('chat_window', 'Explain this:\n"""{input}"""')
  await commander.execCommand(app, {
    textId: cachedTextId!,
    sourceApp: {
      id: 'appId',
      name: 'appName',
      path: 'appPath',
      window: 'title'
    },
    action: 'default',
    command
  })

  expect(window.openPromptAnywhere).toHaveBeenCalledOnce()

  expect(Automator.prototype.moveCaretBelow).not.toHaveBeenCalled()
  expect(Automator.prototype.pasteText).not.toHaveBeenCalled()

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
  expect(await commander.execCommand(app, {
    textId: 'unknown',
    sourceApp: {
      id: 'appId',
      name: 'appName',
      path: 'appPath',
      window: 'title'
    },
    action: 'default',
    command
  })).toBe(false)

  expect(window.openPromptAnywhere).not.toHaveBeenCalled()
  expect(window.releaseFocus).not.toHaveBeenCalledOnce()

})
