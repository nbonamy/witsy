
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { App } from 'electron'
import fs from 'fs'
import path from 'path'
import os from 'os'
import { Chat, History } from '../../../src/types/index'
import { migrateHistoryToIndividualChats, isMigrationComplete } from '../../../src/main/migration'
import { listChatIds, loadChat } from '../../../src/main/chat'

describe('migration.ts', () => {

  let app: App
  let workspaceId: string
  let testDir: string

  beforeEach(() => {
    // Create a temporary directory for testing
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'witsy-migration-test-'))

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

  const createHistoryFile = (history: History): string => {
    const workspacePath = path.join(testDir, 'workspaces', workspaceId)
    fs.mkdirSync(workspacePath, { recursive: true })

    const historyPath = path.join(workspacePath, 'history.json')
    fs.writeFileSync(historyPath, JSON.stringify(history, null, 2))

    return historyPath
  }

  const createSampleHistory = (): History => {
    const chat1: Chat = {
      uuid: 'chat-1',
      title: 'First Chat',
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

    const chat2: Chat = {
      uuid: 'chat-2',
      title: 'Second Chat',
      createdAt: Date.now(),
      lastModified: Date.now(),
      messages: [],
      tools: null,
      disableStreaming: false,
      temporary: false
    } as Chat

    return {
      folders: [],
      chats: [chat1, chat2],
      quickPrompts: ['test prompt']
    }
  }

  describe('migrateHistoryToIndividualChats', () => {

    it('should return false when history.json does not exist', () => {
      const result = migrateHistoryToIndividualChats(app, workspaceId)
      expect(result).toBe(false)
    })

    it('should migrate chats to individual files successfully', () => {
      const history = createSampleHistory()
      createHistoryFile(history)

      const result = migrateHistoryToIndividualChats(app, workspaceId)
      expect(result).toBe(true)

      // Verify individual chat files were created
      const chatIds = listChatIds(app, workspaceId)
      expect(chatIds).toHaveLength(2)
      expect(chatIds).toContain('chat-1')
      expect(chatIds).toContain('chat-2')

      // Verify chat content is correct
      const chat1 = loadChat(app, workspaceId, 'chat-1')
      expect(chat1).not.toBeNull()
      expect(chat1?.title).toBe('First Chat')
      expect(chat1?.messages).toHaveLength(1)

      const chat2 = loadChat(app, workspaceId, 'chat-2')
      expect(chat2).not.toBeNull()
      expect(chat2?.title).toBe('Second Chat')
    })

    it('should create backup of history.json before migration', () => {
      const history = createSampleHistory()
      const historyPath = createHistoryFile(history)
      const backupPath = `${historyPath}.backup`

      // Get original content before migration
      const originalContent = fs.readFileSync(historyPath, 'utf-8')

      migrateHistoryToIndividualChats(app, workspaceId)

      // Verify backup exists
      expect(fs.existsSync(backupPath)).toBe(true)

      // Verify backup content matches original (before migration)
      const backupContent = fs.readFileSync(backupPath, 'utf-8')
      expect(backupContent).toBe(originalContent)
    })

    it('should preserve existing backup and not overwrite it', () => {
      const history = createSampleHistory()
      const historyPath = createHistoryFile(history)
      const backupPath = `${historyPath}.backup`

      // Create initial backup
      migrateHistoryToIndividualChats(app, workspaceId)
      const firstBackupTime = fs.statSync(backupPath).mtimeMs

      // Wait a bit
      const start = Date.now()
      while (Date.now() - start < 10) { /* wait */ }

      // Try to migrate again (should detect existing backup)
      // First remove chat files to allow migration check to pass
      const chatsDir = path.join(testDir, 'workspaces', workspaceId, 'chats')
      fs.rmSync(chatsDir, { recursive: true, force: true })

      migrateHistoryToIndividualChats(app, workspaceId)

      // Backup timestamp should not have changed
      const secondBackupTime = fs.statSync(backupPath).mtimeMs
      expect(secondBackupTime).toBe(firstBackupTime)
    })

    it('should return false and skip migration if already migrated', () => {
      const history = createSampleHistory()
      createHistoryFile(history)

      // First migration
      const result1 = migrateHistoryToIndividualChats(app, workspaceId)
      expect(result1).toBe(true)

      // Second migration attempt should be skipped
      const result2 = migrateHistoryToIndividualChats(app, workspaceId)
      expect(result2).toBe(false)
    })

    it('should handle empty chats array', () => {
      const history: History = {
        folders: [],
        chats: [],
        quickPrompts: []
      }
      createHistoryFile(history)

      const result = migrateHistoryToIndividualChats(app, workspaceId)
      expect(result).toBe(false)

      const chatIds = listChatIds(app, workspaceId)
      expect(chatIds).toHaveLength(0)
    })

    it('should handle corrupted history.json gracefully', () => {
      const workspacePath = path.join(testDir, 'workspaces', workspaceId)
      fs.mkdirSync(workspacePath, { recursive: true })

      const historyPath = path.join(workspacePath, 'history.json')
      fs.writeFileSync(historyPath, 'invalid json {')

      const result = migrateHistoryToIndividualChats(app, workspaceId)
      expect(result).toBe(false)
    })

    it('should handle invalid history format gracefully', () => {
      const workspacePath = path.join(testDir, 'workspaces', workspaceId)
      fs.mkdirSync(workspacePath, { recursive: true })

      const historyPath = path.join(workspacePath, 'history.json')
      fs.writeFileSync(historyPath, JSON.stringify({ invalid: 'format' }))

      const result = migrateHistoryToIndividualChats(app, workspaceId)
      expect(result).toBe(false)
    })

    it('should abort migration and rollback on save failure', () => {
      const history = createSampleHistory()

      // Add an invalid chat that will fail to save
      const invalidChat = {
        uuid: 'invalid-chat',
        // Missing required fields
      } as unknown as Chat

      history.chats.push(invalidChat)

      createHistoryFile(history)

      // Mock saveChat to fail for invalid chat
      // Since we can't easily mock the saveChat import, we'll test
      // by creating a chat with filesystem issues

      // Create chats directory as read-only to cause save failures
      const workspacePath = path.join(testDir, 'workspaces', workspaceId)
      const chatsDir = path.join(workspacePath, 'chats')
      fs.mkdirSync(chatsDir, { recursive: true })

      // Make chats directory read-only (on non-Windows systems)
      if (process.platform !== 'win32') {
        fs.chmodSync(chatsDir, 0o444)

        const result = migrateHistoryToIndividualChats(app, workspaceId)
        expect(result).toBe(false)

        // Restore permissions for cleanup (if directory still exists)
        if (fs.existsSync(chatsDir)) {
          fs.chmodSync(chatsDir, 0o755)
        }
      }
    })

    it('should preserve all chat data including messages and metadata', () => {
      const now = Date.now()
      const chat: Chat = {
        uuid: 'detailed-chat',
        title: 'Detailed Chat',
        createdAt: now,
        lastModified: now,
        engine: 'anthropic',
        model: 'claude-3-opus',
        instructions: 'Be helpful',
        disableStreaming: true,
        tools: ['search', 'python'],
        locale: 'en-US',
        messages: [
          {
            uuid: 'msg-1',
            role: 'user',
            type: 'text',
            createdAt: now,
            content: 'First message',
            attachments: [],
            toolCalls: []
          },
          {
            uuid: 'msg-2',
            role: 'assistant',
            type: 'text',
            createdAt: now + 1000,
            content: 'Second message',
            attachments: [],
            toolCalls: []
          }
        ],
        temporary: false
      } as Chat

      const history: History = {
        folders: [{
          id: 'folder-1',
          name: 'Test Folder',
          chats: ['detailed-chat']
        }],
        chats: [chat],
        quickPrompts: ['prompt1', 'prompt2']
      }

      createHistoryFile(history)

      migrateHistoryToIndividualChats(app, workspaceId)

      const loaded = loadChat(app, workspaceId, 'detailed-chat')
      expect(loaded).not.toBeNull()
      expect(loaded?.title).toBe('Detailed Chat')
      expect(loaded?.engine).toBe('anthropic')
      expect(loaded?.model).toBe('claude-3-opus')
      expect(loaded?.instructions).toBe('Be helpful')
      expect(loaded?.disableStreaming).toBe(true)
      expect(loaded?.tools).toEqual(['search', 'python'])
      expect(loaded?.locale).toBe('en-US')
      expect(loaded?.messages).toHaveLength(2)
      expect(loaded?.messages[0].content).toBe('First message')
      expect(loaded?.messages[1].content).toBe('Second message')
    })
  })

  describe('isMigrationComplete', () => {

    it('should return false when no chats exist', () => {
      const result = isMigrationComplete(app, workspaceId)
      expect(result).toBe(false)
    })

    it('should return true after successful migration', () => {
      const history = createSampleHistory()
      createHistoryFile(history)

      migrateHistoryToIndividualChats(app, workspaceId)

      const result = isMigrationComplete(app, workspaceId)
      expect(result).toBe(true)
    })
  })
})
