
import { vi, expect, test, beforeEach } from 'vitest'
import { Command, Expert } from '../../src/types/index.d'
import { store } from '../../src/services/store'
import Chat from '../../src/models/chat'
import Message from '../../src/models/message'
import defaultSettings from '../../defaults/settings.json'
import defaultCommands from '../../defaults/commands.json'
import defaultExperts from '../../defaults/experts.json'

const listeners: ((signal: string) => void)[] = []

const chats = [
  new Chat(),
  new Chat({
    uuid: '123',
    engine: 'engine',
    model: 'model',
    messages: [
      { uuid: 1, role: 'system', content: 'Hi' },
      { uuid: 2, role: 'user', content: 'Hello' }
    ]
  })
]

window.api = {
  config: {
    load: vi.fn(() => defaultSettings),
    save: vi.fn(),
  },
  commands: {
    load: vi.fn(() => defaultCommands as Command[]),
  },
  experts: {
    load: vi.fn(() => defaultExperts as Expert[]),
  },
  history: {
    load: vi.fn(() => chats),
    save: vi.fn(),
  },
  on: (signal: string, listener: any) => {
    listeners.push(listener)
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  listeners.length = 0
})

test('Check atributtes', async () => {
  expect(store.config).toBe(null)
  expect(store.commands).toEqual([])
  expect(store.experts).toEqual([])
  expect(store.chats).toEqual([])
  expect(store.chatFilter).toBe(null)
  expect(store.pendingAttachment).toBe(null)
})

test('Load', async () => {
  store.load()
  expect(window.api.config.load).toHaveBeenCalled()
  expect(window.api.experts.load).toHaveBeenCalled()
  expect(window.api.commands.load).toHaveBeenCalled()
  expect(window.api.history.load).toHaveBeenCalled()
  expect(store.config).toStrictEqual(defaultSettings)
  expect(store.commands).toStrictEqual(defaultCommands)
  expect(store.experts).toStrictEqual(defaultExperts)
})

test('Save settings', async () => {
  store.load()
  store.saveSettings()
  expect(window.api.config.save).toHaveBeenCalled()
})

test('Reload settings', async () => {
  store.load()
  vi.clearAllMocks()
  expect(window.api.config.load).not.toHaveBeenCalled()
  listeners[0]('settings')
  expect(window.api.config.load).toHaveBeenCalled()
})

test('Load history', async () => {
  store.load()
  expect(store.chats).toHaveLength(2)
  expect(store.chats[0].messages).toHaveLength(0)
  expect(store.chats[1].messages).toHaveLength(2)
})

test('Save history', async () => {
  store.saveHistory()
  expect(window.api.history.save).toHaveBeenCalledWith([ {
    uuid: '123',
    engine: 'engine',
    model: 'model',
    deleted: false,
    messages: [
      { uuid: 1, role: 'system', type: 'text', content: 'Hi', toolCall: null, attachment: null, transient: false },
      { uuid: 2, role: 'user', type: 'text', content: 'Hello', toolCall: null, attachment: null, transient: false }
    ]
  }])
})

test('Merge history', async () => {
  store.load()
  chats.push(new Chat())
  chats[1].messages.push(new Message('user', ''))
  listeners[0]('history')
  expect(store.chats).toHaveLength(3)
  expect(store.chats[1].messages).toHaveLength(3)
  chats[2].deleted = true
  listeners[0]('history')
  expect(store.chats).toHaveLength(2)
  expect(store.chats[1].messages).toHaveLength(3)
})
