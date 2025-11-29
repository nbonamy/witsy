
import { vi, beforeAll, beforeEach, expect, test } from 'vitest'
import { useWindowMock, listeners } from '@tests/mocks/window'
import { store } from '@services/store'
import { DEFAULT_WORKSPACE_ID } from '@main/workspace'
import Chat from '@models/chat'
import Message from '@models/message'
import defaultSettings from '@root/defaults/settings.json'

const chats = [
  new Chat(),
  Chat.fromJson({
    uuid: '123',
    engine: 'engine',
    model: 'model',
    disableStreaming: false,
    tools: null,
    modelOpts: {
      temperature: 1.0
    },
    messages: [
      new Message('system', 'Hi'),
      new Message('user', 'Hello')
    ]
  })
]

// to make testing easier
// was trying to use expect.any(String) but it was not working
chats[1].messages[0].uuid = '1'
chats[1].messages[0].createdAt = 0
chats[1].messages[1].uuid = '2'
chats[1].messages[1].createdAt = 0
chats[1].messages[1].engine = 'engine'
chats[1].messages[1].model = 'model'

beforeAll(() => {
  useWindowMock()
  window.api.history.load = vi.fn(() => ({ folders: [], chats: chats, quickPrompts: [] }))
  window.api.history.loadChat = vi.fn((workspaceId: string, chatId: string) => {
    return chats.find(c => c.uuid === chatId) || null
  })
})

beforeEach(() => {
  vi.clearAllMocks()
  listeners.length = 0

  // Reset chats array to original state
  chats.length = 2
  if (chats[1].messages.length > 2) {
    chats[1].messages.length = 2
  }
})

test('Check atributtes', async () => {
  expect(store.config).toEqual({})
  expect(store.commands).toEqual([])
  expect(store.experts).toEqual([])
  expect(store.history).toBeNull()
  expect(store.chatState.filter).toBeNull()
  expect(store.transcribeState.transcription).toBe('')
})

test('Load', async () => {
  store.load()
  store.config.llm.favorites = []
  expect(window.api.config?.load).toHaveBeenCalled()
  expect(window.api.experts?.load).toHaveBeenCalled()
  expect(window.api.commands?.load).toHaveBeenCalled()
  expect(window.api.history?.load).toHaveBeenCalled()
  expect(store.config).toStrictEqual(defaultSettings)
  expect(store.history.folders).toHaveLength(0)
  expect(store.history.chats).toHaveLength(2)
  expect(store.commands).toHaveLength(5)
  expect(store.experts).toHaveLength(4)
})

test('Save settings', async () => {
  store.load()
  store.saveSettings()
  expect(window.api.config?.save).toHaveBeenCalled()
})

test('Reload settings without changing reference', async () => {
  store.load()
  expect(window.api.config?.load).toHaveBeenCalledTimes(1)
  const backup = store.config
  expect(store.config.llm.engine).toBe('openai')
  expect(store.config.plugins).toBeDefined()
  defaultSettings.llm.engine = 'xai'
  delete defaultSettings.plugins
  listeners.map(l => l('settings'))
  expect(window.api.config?.load).toHaveBeenCalledTimes(2)
  expect(store.config).toBe(backup)
  expect(store.config.llm.engine).toBe('xai')
  expect(store.config.plugins).toBeUndefined()
})

test('Load history', async () => {
  store.load()
  expect(store.history.chats).toHaveLength(2)
  expect(store.history.chats[0].messages).toHaveLength(0)
  expect(store.history.chats[1].messages).toHaveLength(2)
})

test('Save history', async () => {
  store.load()
  store.loadChat('123')
  store.saveHistory()
  expect(window.api.history.saveChat).toHaveBeenCalledWith(DEFAULT_WORKSPACE_ID, {
    uuid: '123',
    engine: 'engine',
    model: 'model',
    disableStreaming: false,
    tools: null,
    temporary: false,
    modelOpts: { temperature: 1 },
    messages: expect.arrayContaining([
      {
        uuid: '1', engine: null, model: null, createdAt: 0, role: 'system', type: 'text', content: 'Hi', reasoning: null,
        execType: 'prompt', toolCalls: [], attachments: [], transient: false, uiOnly: false, edited: false
      },
      {
        uuid: '2', engine: 'engine', model: 'model', createdAt: 0, role: 'user', type: 'text', content: 'Hello', reasoning: null,
        execType: 'prompt', toolCalls: [], attachments: [], transient: false, uiOnly: false, edited: false
      }
    ])
  })
  expect(window.api.history.save).toHaveBeenLastCalledWith(DEFAULT_WORKSPACE_ID, {
    folders: [],
    chats: expect.arrayContaining([
      expect.any(Object), {
      uuid: '123',
      engine: 'engine',
      model: 'model',
      disableStreaming: false,
      tools: null,
      temporary: false,
      modelOpts: { temperature: 1 },
    } ]),
    quickPrompts: [],
  })
})

test('Merge history', async () => {
  store.load()
  expect(store.history.chats).toHaveLength(2)
  expect(store.history.chats[1].messages).toHaveLength(2)
  chats.push(new Chat())
  chats[1].messages.push(new Message('user', ''))
  listeners.map(l => l('history'))
  expect(store.history.chats).toHaveLength(3)
  expect(store.history.chats[1].messages).toHaveLength(3)
  chats.splice(2, 1)
  listeners.map(l => l('history'))
  expect(store.history.chats).toHaveLength(2)
  expect(store.history.chats[1].messages).toHaveLength(3)
})

test('Add quick prompt', async () => {
  store.load()
  expect(store.history.quickPrompts).toHaveLength(0)
  store.addQuickPrompt('my prompt')
  expect(store.history.quickPrompts).toHaveLength(1)
  expect(store.history.quickPrompts[0]).toBe('my prompt')
  store.addQuickPrompt('my other prompt')
  expect(store.history.quickPrompts).toHaveLength(2)
  expect(store.history.quickPrompts[1]).toBe('my other prompt')
  store.addQuickPrompt('my prompt')
  expect(store.history.quickPrompts).toHaveLength(2)
  expect(store.history.quickPrompts[1]).toBe('my prompt')
})

test('Load chat - successful load from file', async () => {
  store.load()
  expect(store.history.chats[1].messages).toHaveLength(2)

  // Clear messages to simulate metadata-only state
  store.history.chats[1].messages = undefined

  // Load chat should call IPC and restore messages
  const chat = store.loadChat('123')

  expect(window.api.history.loadChat).toHaveBeenCalledWith(DEFAULT_WORKSPACE_ID, '123')
  expect(chat).toBeDefined()
  expect(chat.uuid).toBe('123')
  expect(chat.messages).toHaveLength(2)
  expect(store.history.chats[1].messages).toHaveLength(2)
})

test('Load chat - chat not saved yet (returns metadata)', async () => {
  store.load()

  // Mock loadChat to return null (chat not saved yet)
  window.api.history.loadChat = vi.fn(() => null)

  // Should return the chat from history without messages
  const chat = store.loadChat('123')

  expect(window.api.history.loadChat).toHaveBeenCalledWith(DEFAULT_WORKSPACE_ID, '123')
  expect(chat).toBeDefined()
  expect(chat.uuid).toBe('123')
})

test('Load chat - chat not found in history', async () => {
  store.load()

  // Should throw error for non-existent chat
  expect(() => store.loadChat('nonexistent')).toThrow('Chat not found: nonexistent')
})

test('Load chat - unloads other chats messages', async () => {
  store.load()

  // Load first chat
  const chat1 = store.loadChat('123')
  expect(chat1.messages).toHaveLength(2)

  // Add another chat with messages
  const chat2 = Chat.fromJson({
    uuid: '456',
    engine: 'engine2',
    model: 'model2',
    messages: [
      new Message('user', 'Test')
    ]
  })
  store.addChat(chat2)

  // Mock loadChat to return chat2 with messages
  window.api.history.loadChat = vi.fn((workspaceId: string, chatId: string) => {
    if (chatId === '456') return chat2
    return chats.find(c => c.uuid === chatId) || null
  })

  // Load second chat
  const loadedChat2 = store.loadChat('456')

  // First chat should have messages unloaded
  expect(store.history.chats.find(c => c.uuid === '123')?.messages).toBeUndefined()
  expect(loadedChat2.messages).toHaveLength(1)
})

test('Load chat - updates history with loaded chat', async () => {
  store.load()

  // Clear messages to simulate metadata-only state
  store.history.chats[1].messages = undefined

  const chatBefore = store.history.chats[1]
  const chatBeforeUuid = chatBefore.uuid

  // Load chat - the default mock returns the chat from the chats array
  // which then gets passed through Chat.fromJson() creating a new object
  const chat = store.loadChat('123')

  // Should update the chat in history with the new object
  const chatAfter = store.history.chats[1]

  // The key assertions: chat is now in the history and has messages
  expect(chat.uuid).toBe('123')
  expect(chat.messages).toHaveLength(2)
  expect(chatAfter.uuid).toBe(chatBeforeUuid)
  expect(chatAfter.messages).toHaveLength(2)

  // chatAfter and chat should be the same object (both reference the spliced-in object)
  expect(chatAfter.uuid).toBe(chat.uuid)
})

test('Save history - handles chats without messages', async () => {
  store.load()

  // Add a chat without messages (metadata only)
  const metadataChat = Chat.fromJson({
    uuid: 'metadata-only',
    engine: 'engine',
    model: 'model'
  })
  store.addChat(metadataChat)

  store.saveHistory()

  // Should not call saveChat for chats without messages
  expect(window.api.history.saveChat).not.toHaveBeenCalledWith(
    DEFAULT_WORKSPACE_ID,
    expect.objectContaining({ uuid: 'metadata-only' })
  )

  // Should include in history.save
  expect(window.api.history.save).toHaveBeenLastCalledWith(
    DEFAULT_WORKSPACE_ID,
    expect.objectContaining({
      chats: expect.arrayContaining([
        expect.objectContaining({ uuid: 'metadata-only' })
      ])
    })
  )
})

test('Save history - deletes orphaned chat files', async () => {
  store.load()
  store.loadChat('123')

  // Remove a chat from history
  store.removeChat('123')

  // Should call deleteChat
  expect(window.api.history.deleteChat).toHaveBeenCalledWith(DEFAULT_WORKSPACE_ID, '123')
})

test('Remove chat - removes from folders', async () => {
  store.load()

  // Add a folder with the chat
  store.history.folders.push({
    id: 'folder1',
    name: 'Test Folder',
    chats: ['123', 'other-chat']
  })

  store.removeChat('123')

  // Should remove from folder
  expect(store.history.folders[0].chats).toEqual(['other-chat'])
  expect(store.history.folders[0].chats).not.toContain('123')
})

test('Add chat - with folder', async () => {
  store.load()

  // Add a folder
  store.history.folders.push({
    id: 'folder1',
    name: 'Test Folder',
    chats: []
  })

  const newChat = new Chat('New Chat')
  const initialLength = store.history.chats.length
  store.addChat(newChat, 'folder1')

  // Should add to folder
  expect(store.history.folders[0].chats).toContain(newChat.uuid)
  expect(store.history.chats).toHaveLength(initialLength + 1)
  expect(store.history.chats.find(c => c.uuid === newChat.uuid)).toBeDefined()
})

test('Add chat - with non-existent folder', async () => {
  store.load()

  const newChat = new Chat('New Chat')
  const initialLength = store.history.chats.length
  store.addChat(newChat, 'nonexistent-folder')

  // Should still add chat to history
  expect(store.history.chats).toHaveLength(initialLength + 1)
  expect(store.history.chats.find(c => c.uuid === newChat.uuid)).toBeDefined()
  // But not crash
})

test('Unselect chat - clears all messages', async () => {
  store.load()
  store.loadChat('123')

  expect(store.history.chats[1].messages).toHaveLength(2)

  store.unselectChat()

  // All chats should have messages cleared
  for (const chat of store.history.chats) {
    expect(chat.messages).toBeUndefined()
  }
})

test('Save history - filters out empty chats not in folders', async () => {
  store.load()

  // Add a chat with only 1 message (system message) - should be filtered out
  const emptyChat = Chat.fromJson({
    uuid: 'empty-chat',
    engine: 'engine',
    model: 'model',
    messages: [
      new Message('system', 'System message only')
    ]
  })
  store.addChat(emptyChat)

  store.saveHistory()

  // Should not save the empty chat to history.json
  expect(window.api.history.save).toHaveBeenLastCalledWith(
    DEFAULT_WORKSPACE_ID,
    expect.objectContaining({
      chats: expect.not.arrayContaining([
        expect.objectContaining({ uuid: 'empty-chat' })
      ])
    })
  )

  // Should also delete the chat file
  expect(window.api.history.deleteChat).toHaveBeenCalledWith(DEFAULT_WORKSPACE_ID, 'empty-chat')
})

test('Save history - keeps empty chats that are in folders', async () => {
  store.load()

  // Add a folder
  store.history.folders.push({
    id: 'folder1',
    name: 'Test Folder',
    chats: []
  })

  // Add a chat with only 1 message but in a folder - should be kept
  const emptyChat = Chat.fromJson({
    uuid: 'empty-in-folder',
    engine: 'engine',
    model: 'model',
    messages: [
      new Message('system', 'System message only')
    ]
  })
  store.addChat(emptyChat, 'folder1')

  store.saveHistory()

  // Should save the chat because it's in a folder
  expect(window.api.history.save).toHaveBeenLastCalledWith(
    DEFAULT_WORKSPACE_ID,
    expect.objectContaining({
      chats: expect.arrayContaining([
        expect.objectContaining({ uuid: 'empty-in-folder' })
      ])
    })
  )

  // Should NOT delete the chat file
  expect(window.api.history.deleteChat).not.toHaveBeenCalledWith(DEFAULT_WORKSPACE_ID, 'empty-in-folder')
})

test('Save history - keeps chats with undefined messages', async () => {
  store.load()

  // Add a chat with undefined messages (metadata only) - should be kept
  const metadataChat = Chat.fromJson({
    uuid: 'metadata-chat',
    engine: 'engine',
    model: 'model'
  })
  // Explicitly set messages to undefined
  metadataChat.messages = undefined
  store.history.chats.push(metadataChat)

  store.saveHistory()

  // Should save the metadata chat
  expect(window.api.history.save).toHaveBeenLastCalledWith(
    DEFAULT_WORKSPACE_ID,
    expect.objectContaining({
      chats: expect.arrayContaining([
        expect.objectContaining({ uuid: 'metadata-chat' })
      ])
    })
  )

  // Should NOT delete the chat file
  expect(window.api.history.deleteChat).not.toHaveBeenCalledWith(DEFAULT_WORKSPACE_ID, 'metadata-chat')
})

test('Save history - handles chats with 2+ messages correctly', async () => {
  store.load()
  store.loadChat('123')

  // Chat has 2 messages - should be saved
  expect(store.history.chats[1].messages).toHaveLength(2)

  vi.clearAllMocks()
  store.saveHistory()

  // Should save both the individual file AND the metadata
  expect(window.api.history.saveChat).toHaveBeenCalledWith(
    DEFAULT_WORKSPACE_ID,
    expect.objectContaining({
      uuid: '123',
      messages: expect.arrayContaining([
        expect.any(Object),
        expect.any(Object)
      ])
    })
  )

  expect(window.api.history.save).toHaveBeenCalledWith(
    DEFAULT_WORKSPACE_ID,
    expect.objectContaining({
      chats: expect.arrayContaining([
        expect.objectContaining({ uuid: '123' })
      ])
    })
  )
})
