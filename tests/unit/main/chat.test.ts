
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { App } from 'electron'
import fs from 'fs'
import path from 'path'
import os from 'os'
import { Chat } from '../../../src/types/index'
import {
  chatsFolder,
  chatFilePath,
  loadChat,
  saveChat,
  deleteChat,
  listChatIds,
  loadAllChats
} from '../../../src/main/chat'

describe('chat.ts', () => {

  let app: App
  let workspaceId: string
  let testDir: string

  beforeEach(() => {
    // Create a temporary directory for testing
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'witsy-chat-test-'))

    // Mock app object
    app = {
      getPath: vi.fn(() => testDir)
    } as unknown as App

    workspaceId = 'test-workspace'
  })

  afterEach(() => {
    // Clean up temporary directory
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true })
    }
  })

  describe('chatsFolder', () => {
    it('should return the correct chats folder path', () => {
      const result = chatsFolder(app, workspaceId)
      expect(result).toContain('workspaces')
      expect(result).toContain(workspaceId)
      expect(result).toContain('chats')
    })

    it('should create the chats folder if it does not exist', () => {
      const result = chatsFolder(app, workspaceId)
      expect(fs.existsSync(result)).toBe(true)
      expect(fs.statSync(result).isDirectory()).toBe(true)
    })
  })

  describe('chatFilePath', () => {
    it('should return the correct file path for a chat', () => {
      const chatId = 'test-chat-id'
      const result = chatFilePath(app, workspaceId, chatId)
      expect(result).toContain('chats')
      expect(result).toContain(`${chatId}.json`)
    })
  })

  describe('saveChat and loadChat', () => {
    it('should save and load a chat successfully', () => {
      const chat: Chat = {
        uuid: 'test-chat-1',
        title: 'Test Chat',
        createdAt: Date.now(),
        lastModified: Date.now(),
        engine: 'openai',
        model: 'gpt-4',
        messages: [
          {
            uuid: 'msg-1',
            role: 'user',
            type: 'text',
            createdAt: Date.now(),
            content: 'Hello',
            attachments: [],
            toolCalls: []
          }
        ],
        tools: null,
        disableStreaming: false,
        temporary: false
      } as Chat

      const saved = saveChat(app, workspaceId, chat)
      expect(saved).toBe(true)

      const loaded = loadChat(app, workspaceId, chat.uuid)
      expect(loaded).not.toBeNull()
      expect(loaded?.uuid).toBe(chat.uuid)
      expect(loaded?.title).toBe(chat.title)
      expect(loaded?.messages).toHaveLength(1)
      expect(loaded?.messages[0].content).toBe('Hello')
    })

    it('should return null when loading a non-existent chat', () => {
      const result = loadChat(app, workspaceId, 'non-existent-id')
      expect(result).toBeNull()
    })

    it('should handle corrupted chat files gracefully', () => {
      const chatId = 'corrupted-chat'
      const filepath = chatFilePath(app, workspaceId, chatId)

      // Ensure chats folder exists
      chatsFolder(app, workspaceId)

      // Write invalid JSON
      fs.writeFileSync(filepath, 'invalid json {')

      const result = loadChat(app, workspaceId, chatId)
      expect(result).toBeNull()
    })

    it('should overwrite existing chat on save', () => {
      const chat: Chat = {
        uuid: 'test-chat-2',
        title: 'Original Title',
        createdAt: Date.now(),
        lastModified: Date.now(),
        messages: [],
        tools: null,
        disableStreaming: false,
        temporary: false
      } as Chat

      saveChat(app, workspaceId, chat)

      chat.title = 'Updated Title'
      saveChat(app, workspaceId, chat)

      const loaded = loadChat(app, workspaceId, chat.uuid)
      expect(loaded?.title).toBe('Updated Title')
    })
  })

  describe('deleteChat', () => {
    it('should delete an existing chat file', () => {
      const chat: Chat = {
        uuid: 'test-chat-3',
        title: 'To Delete',
        createdAt: Date.now(),
        lastModified: Date.now(),
        messages: [],
        tools: null,
        disableStreaming: false,
        temporary: false
      } as Chat

      saveChat(app, workspaceId, chat)

      const filepath = chatFilePath(app, workspaceId, chat.uuid)
      expect(fs.existsSync(filepath)).toBe(true)

      const deleted = deleteChat(app, workspaceId, chat.uuid)
      expect(deleted).toBe(true)
      expect(fs.existsSync(filepath)).toBe(false)
    })

    it('should return true when deleting a non-existent chat', () => {
      const result = deleteChat(app, workspaceId, 'non-existent-id')
      expect(result).toBe(true)
    })
  })

  describe('listChatIds', () => {
    it('should return empty array when chats folder is empty', () => {
      const result = listChatIds(app, workspaceId)
      expect(result).toEqual([])
    })

    it('should list all chat IDs', () => {
      const chat1: Chat = {
        uuid: 'chat-1',
        createdAt: Date.now(),
        lastModified: Date.now(),
        messages: [],
        tools: null,
        disableStreaming: false,
        temporary: false
      } as Chat

      const chat2: Chat = {
        uuid: 'chat-2',
        createdAt: Date.now(),
        lastModified: Date.now(),
        messages: [],
        tools: null,
        disableStreaming: false,
        temporary: false
      } as Chat

      saveChat(app, workspaceId, chat1)
      saveChat(app, workspaceId, chat2)

      const result = listChatIds(app, workspaceId)
      expect(result).toHaveLength(2)
      expect(result).toContain('chat-1')
      expect(result).toContain('chat-2')
    })

    it('should ignore non-JSON files', () => {
      const chat: Chat = {
        uuid: 'chat-1',
        createdAt: Date.now(),
        lastModified: Date.now(),
        messages: [],
        tools: null,
        disableStreaming: false,
        temporary: false
      } as Chat

      saveChat(app, workspaceId, chat)

      // Create a non-JSON file
      const chatsFolderPath = chatsFolder(app, workspaceId)
      fs.writeFileSync(path.join(chatsFolderPath, 'README.txt'), 'test')

      const result = listChatIds(app, workspaceId)
      expect(result).toHaveLength(1)
      expect(result).toContain('chat-1')
    })
  })

  describe('loadAllChats', () => {
    it('should load all chats from the folder', () => {
      const chat1: Chat = {
        uuid: 'chat-1',
        title: 'Chat 1',
        createdAt: Date.now(),
        lastModified: Date.now(),
        messages: [],
        tools: null,
        disableStreaming: false,
        temporary: false
      } as Chat

      const chat2: Chat = {
        uuid: 'chat-2',
        title: 'Chat 2',
        createdAt: Date.now(),
        lastModified: Date.now(),
        messages: [],
        tools: null,
        disableStreaming: false,
        temporary: false
      } as Chat

      saveChat(app, workspaceId, chat1)
      saveChat(app, workspaceId, chat2)

      const result = loadAllChats(app, workspaceId)
      expect(result).toHaveLength(2)

      const titles = result.map(c => c.title)
      expect(titles).toContain('Chat 1')
      expect(titles).toContain('Chat 2')
    })

    it('should skip corrupted chat files', () => {
      const chat: Chat = {
        uuid: 'valid-chat',
        title: 'Valid',
        createdAt: Date.now(),
        lastModified: Date.now(),
        messages: [],
        tools: null,
        disableStreaming: false,
        temporary: false
      } as Chat

      saveChat(app, workspaceId, chat)

      // Create corrupted file
      const chatsFolderPath = chatsFolder(app, workspaceId)
      fs.writeFileSync(path.join(chatsFolderPath, 'corrupted.json'), 'invalid {')

      const result = loadAllChats(app, workspaceId)
      expect(result).toHaveLength(1)
      expect(result[0].title).toBe('Valid')
    })

    it('should return empty array when no chats exist', () => {
      const result = loadAllChats(app, workspaceId)
      expect(result).toEqual([])
    })
  })

  describe('multiple workspaces', () => {
    it('should keep chats separate between workspaces', () => {
      const workspace1 = 'workspace-1'
      const workspace2 = 'workspace-2'

      const chat1: Chat = {
        uuid: 'chat-1',
        title: 'Workspace 1 Chat',
        createdAt: Date.now(),
        lastModified: Date.now(),
        messages: [],
        tools: null,
        disableStreaming: false,
        temporary: false
      } as Chat

      const chat2: Chat = {
        uuid: 'chat-2',
        title: 'Workspace 2 Chat',
        createdAt: Date.now(),
        lastModified: Date.now(),
        messages: [],
        tools: null,
        disableStreaming: false,
        temporary: false
      } as Chat

      saveChat(app, workspace1, chat1)
      saveChat(app, workspace2, chat2)

      const ws1Chats = loadAllChats(app, workspace1)
      const ws2Chats = loadAllChats(app, workspace2)

      expect(ws1Chats).toHaveLength(1)
      expect(ws2Chats).toHaveLength(1)
      expect(ws1Chats[0].title).toBe('Workspace 1 Chat')
      expect(ws2Chats[0].title).toBe('Workspace 2 Chat')
    })
  })
})
