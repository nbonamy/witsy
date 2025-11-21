import { vi, beforeEach, expect, test, describe } from 'vitest'
import { app } from 'electron'
import * as importOai from '@main/import_oai'
import * as history from '@main/history'
import { History } from '@/types'
import fs from 'fs'

// Mock electron app
vi.mock('electron', () => ({
  app: {
    getPath: vi.fn(() => '/mock/userdata'),
  },
}))

// Mock fs module
vi.mock('fs', () => ({
  default: {
    readFileSync: vi.fn(),
    existsSync: vi.fn(),
    readdirSync: vi.fn(() => []),
    writeFileSync: vi.fn(), // Mock to prevent actual file writes
  }
}))

// Mock history module
vi.mock('@main/history', () => ({
  loadHistory: vi.fn(),
  saveHistory: vi.fn(),
}))

describe('OpenAI Import', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('processOpenAI mock test', () => {
    const processOpenAI = async (app: any, file: string): Promise<boolean> => {
      try {
        // read file contents
        const contents = fs.readFileSync(file as string, 'utf-8')
        if (!contents) {
          return false
        }

        // parse JSON
        const data = JSON.parse(contents)
        if (!data) {
          return false
        }

        // we also need the user id
        const sourcePath = file.replace('/conversations.json', '')
        const userFile = sourcePath + '/user.json'
        if (!fs.existsSync(userFile)) {
          console.error('User file not found:', userFile)
          return false
        }

        // read it and get the id
        const userContents = fs.readFileSync(userFile, 'utf-8')
        const userData = JSON.parse(userContents)
        if (!userData || !userData.id) {
          console.error('User ID not found in user file:', userFile)
          return false
        }

        // import
        const historyData = await history.loadHistory(app, 'test-workspace')
        const attachmentPath = '/mock/userdata/images'
        const rc = await importOai.importOpenAIConversations(userData.id, data, historyData, sourcePath, attachmentPath)

        // save
        if (rc) {
          history.saveHistory(app, 'test-workspace', historyData)
        }

        // done
        return rc

      } catch (error) {
        console.error('Error importing OpenAI file:', error)
        return false
      }
    }

    test('should return false when file does not exist or is empty', async () => {
      vi.mocked(fs.readFileSync).mockReturnValue('')
      
      const result = await processOpenAI(app, '/mock/conversations.json')
      
      expect(result).toBe(false)
    })

    test('should return false when JSON is invalid', async () => {
      vi.mocked(fs.readFileSync).mockReturnValue('invalid json')
      
      const result = await processOpenAI(app, '/mock/conversations.json')
      
      expect(result).toBe(false)
    })

    test('should return false when user.json is missing', async () => {
      vi.mocked(fs.readFileSync).mockReturnValue('[]')
      vi.mocked(fs.existsSync).mockReturnValue(false)
      
      const result = await processOpenAI(app, '/mock/conversations.json')
      
      expect(result).toBe(false)
    })

    test('should return false when user.json has no id', async () => {
      vi.mocked(fs.readFileSync)
        .mockReturnValueOnce('[]') // conversations.json
        .mockReturnValueOnce('{}') // user.json without id
      vi.mocked(fs.existsSync).mockReturnValue(true)
      
      const result = await processOpenAI(app, '/mock/conversations.json')
      
      expect(result).toBe(false)
    })

    test('should successfully import valid OpenAI conversations', async () => {
      // Mock file system
      vi.mocked(fs.existsSync).mockReturnValue(true)
      vi.mocked(fs.readdirSync).mockImplementation((dirPath: any) => {
        if (dirPath.toString().endsWith('dalle-generations')) {
          return ['img-123-generated.png', 'img-456-generated.webp'] as any
        }
        if (dirPath.toString().endsWith('user-123')) {
          return ['img-789-uploaded.jpg'] as any
        }
        return ['file-abc-document.pdf', 'img-def-screenshot.png'] as any
      })
      
      // Mock conversations.json content
      const conversationsData = [{
        id: 'conv-1',
        title: 'Test Conversation',
        create_time: 1672531200, // 2023-01-01
        update_time: 1672531260,
        model: 'gpt-4',
        mapping: {
          'client-created-root': {
            children: ['msg-1']
          },
          'msg-1': {
            id: 'msg-1',
            children: ['msg-2'],
            message: {
              author: { role: 'user' },
              create_time: 1672531200,
              content: {
                content_type: 'text',
                parts: ['Hello, how can you help me?']
              }
            }
          },
          'msg-2': {
            id: 'msg-2',
            children: ['msg-3'],
            message: {
              author: { role: 'assistant' },
              create_time: 1672531220,
              end_turn: true,
              metadata: {
                model_slug: 'gpt-4'
              },
              content: {
                content_type: 'text',
                parts: ['I can help you with various tasks. What would you like to know?']
              }
            }
          },
          'msg-3': {
            id: 'msg-3',
            children: ['msg-4'],
            message: {
              author: { role: 'user' },
              create_time: 1672531240,
              metadata: {
                attachments: [{
                  id: 'file-abc',
                  name: 'document.pdf',
                  mime_type: 'application/pdf'
                }]
              },
              content: {
                content_type: 'text',
                parts: ['Can you analyze this document?']
              }
            }
          },
          'msg-4': {
            id: 'msg-4',
            children: [],
            message: {
              author: { role: 'assistant' },
              create_time: 1672531260,
              end_turn: true,
              metadata: {
                model_slug: 'gpt-4'
              },
              content: {
                content_type: 'text',
                parts: ['I\'ll analyze the document for you.']
              }
            }
          }
        }
      }]

      // Mock user.json content
      const userData = { id: 'user-123' }

      // Mock history
      const mockHistory: History = {
        folders: [],
        chats: [],
        quickPrompts: []
      }

      vi.mocked(fs.readFileSync)
        .mockReturnValueOnce(JSON.stringify(conversationsData)) // conversations.json
        .mockReturnValueOnce(JSON.stringify(userData)) // user.json

      vi.mocked(history.loadHistory).mockResolvedValue(mockHistory)

      const result = await processOpenAI(app, '/mock/conversations.json')

      expect(result).toBe(true)
      expect(history.saveHistory).toHaveBeenCalledWith(app, 'test-workspace', mockHistory)
      expect(mockHistory.chats).toHaveLength(1)
      expect(mockHistory.folders).toHaveLength(1)
      
      const importedChat = mockHistory.chats[0]
      expect(importedChat.uuid).toBe('openai-conv-1')
      expect(importedChat.title).toBe('Test Conversation')
      expect(importedChat.model).toBe('gpt-4')
      expect(importedChat.messages).toHaveLength(4)
      
      // Check first message (user)
      expect(importedChat.messages[0].role).toBe('user')
      expect(importedChat.messages[0].content).toBe('Hello, how can you help me?')
      
      // Check second message (assistant)
      expect(importedChat.messages[1].role).toBe('assistant')
      expect(importedChat.messages[1].content).toBe('I can help you with various tasks. What would you like to know?')
      
      // Check third message with attachment
      expect(importedChat.messages[2].role).toBe('user')
      expect(importedChat.messages[2].content).toBe('Can you analyze this document?')
      expect(importedChat.messages[2].attachments).toHaveLength(1)
      expect(importedChat.messages[2].attachments[0].title).toBe('document.pdf')
      
      // Check folder structure
      expect(mockHistory.folders[0].name).toBe('ChatGPT')
      expect(mockHistory.folders[0].chats).toContain('openai-conv-1')
    })
  })

  describe('importOpenAIConversations', () => {
    let mockHistory: History

    beforeEach(() => {
      mockHistory = {
        folders: [],
        chats: [],
        quickPrompts: []
      }
      vi.mocked(fs.readdirSync).mockReturnValue([] as any)
      vi.mocked(fs.existsSync).mockReturnValue(false)
    })

    test('should return false for non-array data', async () => {
      const result = await importOai.importOpenAIConversations('user-123', {}, mockHistory, '/mock', '/mock/attachments')
      
      expect(result).toBe(false)
    })

    test('should return false for empty array', async () => {
      const result = await importOai.importOpenAIConversations('user-123', [], mockHistory, '/mock', '/mock/attachments')
      
      expect(result).toBe(false)
    })

    test('should return false for invalid conversation format', async () => {
      const invalidData = [{ invalid: 'data' }]
      
      const result = await importOai.importOpenAIConversations('user-123', invalidData, mockHistory, '/mock', '/mock/attachments')
      
      expect(result).toBe(false)
    })

    test('should skip ephemeral conversations', async () => {
      const data = [{
        id: 'conv-1',
        title: 'Ephemeral Chat',
        is_do_not_remember: true,
        mapping: {
          'client-created-root': { children: ['msg-1'] },
          'msg-1': {
            id: 'msg-1',
            message: {
              author: { role: 'user' },
              content: { parts: ['Test'] }
            }
          }
        }
      }]

      const result = await importOai.importOpenAIConversations('user-123', data, mockHistory, '/mock', '/mock/attachments')
      
      expect(result).toBe(true)
      expect(mockHistory.chats).toHaveLength(0)
    })

    test('should skip conversations without ID', async () => {
      const data = [{
        title: 'No ID Chat',
        mapping: {
          'client-created-root': { children: ['msg-1'] },
          'msg-1': {
            id: 'msg-1',
            message: {
              author: { role: 'user' },
              content: { parts: ['Test'] }
            }
          }
        }
      }]

      const result = await importOai.importOpenAIConversations('user-123', data, mockHistory, '/mock', '/mock/attachments')
      
      expect(result).toBe(true)
      expect(mockHistory.chats).toHaveLength(0)
    })

    test('should skip conversations without messages', async () => {
      const data = [{
        id: 'conv-1',
        title: 'Empty Chat',
        mapping: {}
      }]

      const result = await importOai.importOpenAIConversations('user-123', data, mockHistory, '/mock', '/mock/attachments')
      
      expect(result).toBe(true)
      expect(mockHistory.chats).toHaveLength(0)
    })

    test('should handle conversations with DALLE image generation', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(true)
      vi.mocked(fs.readdirSync).mockImplementation((dirPath: any) => {
        if (dirPath.toString().endsWith('dalle-generations')) {
          return ['img-123-generated.png'] as any
        }
        return [] as any
      })

      const data = [{
        id: 'conv-1',
        title: 'DALLE Chat',
        mapping: {
          'client-created-root': { children: ['msg-1'] },
          'msg-1': {
            id: 'msg-1',
            children: ['msg-2'],
            message: {
              author: { role: 'user' },
              content: { parts: ['Generate a cat image'] }
            }
          },
          'msg-2': {
            id: 'msg-2',
            children: ['msg-3'],
            message: {
              author: { role: 'assistant' },
              end_turn: true,
              content: {
                parts: [{
                  content_type: 'image_asset_pointer',
                  asset_pointer: 'file-service://img-123',
                  metadata: {
                    dalle: {
                      prompt: 'A cute orange cat sitting in a garden'
                    }
                  }
                }]
              }
            }
          },
          'msg-3': {
            id: 'msg-3',
            children: [],
            message: {
              author: { role: 'user' },
              end_turn: true,
              content: { parts: ['That looks great!'] }
            }
          }
        }
      }]

      const result = await importOai.importOpenAIConversations('user-123', data, mockHistory, '/mock', '/mock/attachments')
      
      expect(result).toBe(true)
      expect(mockHistory.chats).toHaveLength(1)
      
      const chat = mockHistory.chats[0]
      expect(chat.messages).toHaveLength(3)
      
      const assistantMessage = chat.messages[1]
      expect(assistantMessage.role).toBe('assistant')
      expect(assistantMessage.toolCalls).toHaveLength(1)
      expect(assistantMessage.toolCalls[0].name).toBe('dalle')
      expect(assistantMessage.toolCalls[0].params.prompt).toBe('A cute orange cat sitting in a garden')
      expect(assistantMessage.content).toContain('![A cute orange cat sitting in a garden]')
    })

    test('should handle content references and clean up text', async () => {
      const data = [{
        id: 'conv-1',
        title: 'Content References Chat',
        mapping: {
          'client-created-root': { children: ['msg-1'] },
          'msg-1': {
            id: 'msg-1',
            children: ['msg-2'],
            message: {
              author: { role: 'user' },
              content: { parts: ['Tell me about cats'] }
            }
          },
          'msg-2': {
            id: 'msg-2',
            children: ['msg-3'],
            message: {
              author: { role: 'assistant' },
              end_turn: true,
              content: {
                parts: ['Cats are great pets【reference】. They are independent animals【image】.']
              },
              metadata: {
                content_references: [
                  {
                    type: 'attribution',
                    matched_text: '【reference】'
                  },
                  {
                    type: 'image_v2',
                    matched_text: '【image】',
                    alt: '[Image of a cat]'
                  }
                ]
              }
            }
          },
          'msg-3': {
            id: 'msg-3',
            children: [],
            message: {
              author: { role: 'user' },
              end_turn: true,
              content: { parts: ['Thanks!'] }
            }
          }
        }
      }]

      const result = await importOai.importOpenAIConversations('user-123', data, mockHistory, '/mock', '/mock/attachments')
      
      expect(result).toBe(true)
      expect(mockHistory.chats).toHaveLength(1)
      
      const assistantMessage = mockHistory.chats[0].messages[1]
      expect(assistantMessage.content).toBe('Cats are great pets【reference】. They are independent animals[Image of a cat].')
    })

    test('should skip chats with less than 3 messages', async () => {
      const data = [{
        id: 'conv-1',
        title: 'Short Chat',
        mapping: {
          'client-created-root': { children: ['msg-1'] },
          'msg-1': {
            id: 'msg-1',
            children: [],
            message: {
              author: { role: 'user' },
              end_turn: true,
              content: { parts: ['Hello'] }
            }
          }
        }
      }]

      const result = await importOai.importOpenAIConversations('user-123', data, mockHistory, '/mock', '/mock/attachments')
      
      expect(result).toBe(true)
      expect(mockHistory.chats).toHaveLength(0)
      expect(mockHistory.folders).toHaveLength(0)
    })

    test('should handle system messages', async () => {
      const data = [{
        id: 'conv-1',
        title: 'System Message Chat',
        mapping: {
          'client-created-root': { children: ['msg-system'] },
          'msg-system': {
            id: 'msg-system',
            children: ['msg-1'],
            message: {
              author: { role: 'system' },
              content: { parts: ['You are a helpful assistant.'] }
            }
          },
          'msg-1': {
            id: 'msg-1',
            children: ['msg-2'],
            message: {
              author: { role: 'user' },
              content: { parts: ['Hello'] }
            }
          },
          'msg-2': {
            id: 'msg-2',
            children: [],
            message: {
              author: { role: 'assistant' },
              end_turn: true,
              content: { parts: ['Hi there!'] }
            }
          }
        }
      }]

      const result = await importOai.importOpenAIConversations('user-123', data, mockHistory, '/mock', '/mock/attachments')
      
      expect(result).toBe(true)
      expect(mockHistory.chats).toHaveLength(1)
      
      const chat = mockHistory.chats[0]
      expect(chat.messages).toHaveLength(3)
      expect(chat.messages[0].role).toBe('system')
      expect(chat.messages[0].content).toBe('You are a helpful assistant.')
    })

    test('should handle messages without content', async () => {
      const data = [{
        id: 'conv-1',
        title: 'No Content Chat',
        mapping: {
          'client-created-root': { children: ['msg-1'] },
          'msg-1': {
            id: 'msg-1',
            children: ['msg-2'],
            message: {
              author: { role: 'user' },
              content: { parts: ['Hello'] }
            }
          },
          'msg-2': {
            id: 'msg-2',
            children: ['msg-3'],
            message: {
              author: { role: 'assistant' },
              end_turn: true,
              // No content field
            }
          },
          'msg-3': {
            id: 'msg-3',
            children: [],
            message: {
              author: { role: 'user' },
              end_turn: true,
              content: { parts: ['Goodbye'] }
            }
          }
        }
      }]

      const result = await importOai.importOpenAIConversations('user-123', data, mockHistory, '/mock', '/mock/attachments')
      
      expect(result).toBe(true)
      expect(mockHistory.chats).toHaveLength(1)
      
      const chat = mockHistory.chats[0]
      expect(chat.messages).toHaveLength(3)
      expect(chat.messages[1].content).toBe('')
    })

    test('should handle attachment processing errors', async () => {
      const data = [{
        id: 'conv-1',
        title: 'Attachment Error Chat',
        mapping: {
          'client-created-root': { children: ['msg-1'] },
          'msg-1': {
            id: 'msg-1',
            children: ['msg-2'],
            message: {
              author: { role: 'user' },
              metadata: {
                attachments: [{
                  id: 'file-bad',
                  name: null, // This should cause an error
                  mime_type: 'application/pdf'
                }]
              },
              content: { parts: ['Check this file'] }
            }
          },
          'msg-2': {
            id: 'msg-2',
            children: ['msg-3'],
            message: {
              author: { role: 'assistant' },
              end_turn: true,
              content: { parts: ['I cannot process that file.'] }
            }
          },
          'msg-3': {
            id: 'msg-3',
            children: [],
            message: {
              author: { role: 'user' },
              end_turn: true,
              content: { parts: ['Ok'] }
            }
          }
        }
      }]

      const result = await importOai.importOpenAIConversations('user-123', data, mockHistory, '/mock', '/mock/attachments')
      
      expect(result).toBe(true)
      expect(mockHistory.chats).toHaveLength(1)
    })

    test('should handle tool messages', async () => {
      const data = [{
        id: 'conv-1',
        title: 'Tool Message Chat',
        mapping: {
          'client-created-root': { children: ['msg-1'] },
          'msg-1': {
            id: 'msg-1',
            children: ['msg-2'],
            message: {
              author: { role: 'user' },
              content: { parts: ['Run some code'] }
            }
          },
          'msg-2': {
            id: 'msg-2',
            children: ['msg-3'],
            message: {
              author: { role: 'tool' },
              content: {
                content_type: 'multimodal_text',
                parts: ['Code executed successfully']
              }
            }
          },
          'msg-3': {
            id: 'msg-3',
            children: ['msg-4'],
            message: {
              author: { role: 'assistant' },
              end_turn: true,
              content: { parts: ['The code ran successfully.'] }
            }
          },
          'msg-4': {
            id: 'msg-4',
            children: [],
            message: {
              author: { role: 'user' },
              end_turn: true,
              content: { parts: ['Thanks'] }
            }
          }
        }
      }]

      const result = await importOai.importOpenAIConversations('user-123', data, mockHistory, '/mock', '/mock/attachments')
      
      expect(result).toBe(true)
      expect(mockHistory.chats).toHaveLength(1)
      
      const chat = mockHistory.chats[0]
      expect(chat.messages).toHaveLength(3) // Tool message should be merged with assistant
    })

    test('should skip tool messages with wrong content type', async () => {
      const data = [{
        id: 'conv-1',
        title: 'Wrong Tool Type Chat',
        mapping: {
          'client-created-root': { children: ['msg-1'] },
          'msg-1': {
            id: 'msg-1',
            children: ['msg-2'],
            message: {
              author: { role: 'user' },
              content: { parts: ['Execute something'] }
            }
          },
          'msg-2': {
            id: 'msg-2',
            children: ['msg-3'],
            message: {
              author: { role: 'tool' },
              content: {
                content_type: 'text', // Wrong content type
                parts: ['Some result']
              }
            }
          },
          'msg-3': {
            id: 'msg-3',
            children: ['msg-4'],
            message: {
              author: { role: 'assistant' },
              end_turn: true,
              content: { parts: ['Done.'] }
            }
          },
          'msg-4': {
            id: 'msg-4',
            children: [],
            message: {
              author: { role: 'user' },
              end_turn: true,
              content: { parts: ['Ok'] }
            }
          }
        }
      }]

      const result = await importOai.importOpenAIConversations('user-123', data, mockHistory, '/mock', '/mock/attachments')
      
      expect(result).toBe(true)
      expect(mockHistory.chats).toHaveLength(1)
      
      const chat = mockHistory.chats[0]
      expect(chat.messages).toHaveLength(3) // Tool message should be skipped
    })

    test('should handle messages with invalid roles', async () => {
      const data = [{
        id: 'conv-1',
        title: 'Invalid Role Chat',
        mapping: {
          'client-created-root': { children: ['msg-1'] },
          'msg-1': {
            id: 'msg-1',
            children: ['msg-2'],
            message: {
              author: { role: 'user' },
              content: { parts: ['Hello'] }
            }
          },
          'msg-2': {
            id: 'msg-2',
            children: ['msg-3'],
            message: {
              author: { role: 'invalid_role' }, // Invalid role
              content: { parts: ['This should be skipped'] }
            }
          },
          'msg-3': {
            id: 'msg-3',
            children: ['msg-4'],
            message: {
              author: { role: 'assistant' },
              end_turn: true,
              content: { parts: ['Valid response'] }
            }
          },
          'msg-4': {
            id: 'msg-4',
            children: [],
            message: {
              author: { role: 'user' },
              end_turn: true,
              content: { parts: ['End'] }
            }
          }
        }
      }]

      const result = await importOai.importOpenAIConversations('user-123', data, mockHistory, '/mock', '/mock/attachments')
      
      expect(result).toBe(true)
      expect(mockHistory.chats).toHaveLength(1)
      
      const chat = mockHistory.chats[0]
      expect(chat.messages).toHaveLength(3) // Invalid role message should be skipped
    })

    test('should handle messages without roles', async () => {
      const data = [{
        id: 'conv-1',
        title: 'No Role Chat',
        mapping: {
          'client-created-root': { children: ['msg-1'] },
          'msg-1': {
            id: 'msg-1',
            children: ['msg-2'],
            message: {
              author: { role: 'user' },
              content: { parts: ['Hello'] }
            }
          },
          'msg-2': {
            id: 'msg-2',
            children: ['msg-3'],
            message: {
              author: {}, // No role
              content: { parts: ['No role message'] }
            }
          },
          'msg-3': {
            id: 'msg-3',
            children: ['msg-4'],
            message: {
              author: { role: 'assistant' },
              end_turn: true,
              content: { parts: ['Response'] }
            }
          },
          'msg-4': {
            id: 'msg-4',
            children: [],
            message: {
              author: { role: 'user' },
              end_turn: true,
              content: { parts: ['End'] }
            }
          }
        }
      }]

      const result = await importOai.importOpenAIConversations('user-123', data, mockHistory, '/mock', '/mock/attachments')
      
      expect(result).toBe(true)
      expect(mockHistory.chats).toHaveLength(1)
      
      const chat = mockHistory.chats[0]
      expect(chat.messages).toHaveLength(3) // No role message should be skipped
    })

    test('should handle image asset pointers in user messages', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(true)
      vi.mocked(fs.readdirSync).mockReturnValue(['img-123-screenshot.png'] as any)

      const data = [{
        id: 'conv-1',
        title: 'User Image Chat',
        mapping: {
          'client-created-root': { children: ['msg-1'] },
          'msg-1': {
            id: 'msg-1',
            children: ['msg-2'],
            message: {
              author: { role: 'user' },
              content: {
                parts: [
                  'Look at this image:',
                  {
                    content_type: 'image_asset_pointer',
                    asset_pointer: 'file-service://img-123'
                  }
                ]
              }
            }
          },
          'msg-2': {
            id: 'msg-2',
            children: ['msg-3'],
            message: {
              author: { role: 'assistant' },
              end_turn: true,
              content: { parts: ['I can see the image.'] }
            }
          },
          'msg-3': {
            id: 'msg-3',
            children: [],
            message: {
              author: { role: 'user' },
              end_turn: true,
              content: { parts: ['Thanks'] }
            }
          }
        }
      }]

      const result = await importOai.importOpenAIConversations('user-123', data, mockHistory, '/mock', '/mock/attachments')
      
      expect(result).toBe(true)
      expect(mockHistory.chats).toHaveLength(1)
      
      const chat = mockHistory.chats[0]
      expect(chat.messages[0].attachments).toHaveLength(1)
    })

    test('should handle image asset pointers not found in files', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(true)
      vi.mocked(fs.readdirSync).mockReturnValue([] as any) // No files found

      const data = [{
        id: 'conv-1',
        title: 'Missing Image Chat',
        mapping: {
          'client-created-root': { children: ['msg-1'] },
          'msg-1': {
            id: 'msg-1',
            children: ['msg-2'],
            message: {
              author: { role: 'user' },
              content: { parts: ['Look at this'] }
            }
          },
          'msg-2': {
            id: 'msg-2',
            children: ['msg-3'],
            message: {
              author: { role: 'assistant' },
              end_turn: false,
              content: {
                parts: [{
                  content_type: 'image_asset_pointer',
                  asset_pointer: 'file-service://img-missing'
                }]
              }
            }
          },
          'msg-3': {
            id: 'msg-3',
            children: [],
            message: {
              author: { role: 'user' },
              end_turn: true,
              content: { parts: ['Some text'] }
            }
          }
        }
      }]

      const result = await importOai.importOpenAIConversations('user-123', data, mockHistory, '/mock', '/mock/attachments')
      
      expect(result).toBe(true)
      expect(mockHistory.chats).toHaveLength(1)
    })

    test('should handle additional content reference types', async () => {
      const data = [{
        id: 'conv-1',
        title: 'More Content References',
        mapping: {
          'client-created-root': { children: ['msg-1'] },
          'msg-1': {
            id: 'msg-1',
            children: ['msg-2'],
            message: {
              author: { role: 'user' },
              content: { parts: ['Tell me about videos'] }
            }
          },
          'msg-2': {
            id: 'msg-2',
            children: ['msg-3'],
            message: {
              author: { role: 'assistant' },
              end_turn: true,
              content: {
                parts: ['Here is a video【video】and some products【products】and web pages【web】and hidden content【hidden】and a file【file】']
              },
              metadata: {
                content_references: [
                  {
                    type: 'video',
                    matched_text: '【video】',
                    alt: 'Video description',
                    title: 'Sample Video',
                    thumbnail_url: 'https://example.com/thumb.jpg',
                    url: 'https://example.com/video'
                  },
                  {
                    type: 'products',
                    matched_text: '【products】',
                    alt: '[Products]'
                  },
                  {
                    type: 'grouped_webpages_model_predicted_fallback',
                    matched_text: '【web】',
                    prompt_text: 'Web content'
                  },
                  {
                    type: 'hidden',
                    matched_text: '【hidden】'
                  },
                  {
                    type: 'file',
                    matched_text: '【file】'
                  }
                ]
              }
            }
          },
          'msg-3': {
            id: 'msg-3',
            children: [],
            message: {
              author: { role: 'user' },
              end_turn: true,
              content: { parts: ['Thanks'] }
            }
          }
        }
      }]

      const result = await importOai.importOpenAIConversations('user-123', data, mockHistory, '/mock', '/mock/attachments')
      
      expect(result).toBe(true)
      expect(mockHistory.chats).toHaveLength(1)
      
      const assistantMessage = mockHistory.chats[0].messages[1]
      expect(assistantMessage.content).toContain('[![Sample Video](https://example.com/thumb.jpg)](https://example.com/video)')
      expect(assistantMessage.content).toContain('[Products]')
      expect(assistantMessage.content).toContain('Web content')
      expect(assistantMessage.content).toContain('【hidden】') // hidden type does "nop" so it remains
      expect(assistantMessage.content).not.toContain('【file】') // file type gets removed
    })

    test('should handle video content references without full data', async () => {
      const data = [{
        id: 'conv-1',
        title: 'Partial Video Reference',
        mapping: {
          'client-created-root': { children: ['msg-1'] },
          'msg-1': {
            id: 'msg-1',
            children: ['msg-2'],
            message: {
              author: { role: 'user' },
              content: { parts: ['Show me videos'] }
            }
          },
          'msg-2': {
            id: 'msg-2',
            children: ['msg-3'],
            message: {
              author: { role: 'assistant' },
              end_turn: true,
              content: {
                parts: ['Video without full data【video1】and video with no alt【video2】']
              },
              metadata: {
                content_references: [
                  {
                    type: 'video',
                    matched_text: '【video1】',
                    alt: 'Just alt text'
                  },
                  {
                    type: 'video',
                    matched_text: '【video2】'
                  }
                ]
              }
            }
          },
          'msg-3': {
            id: 'msg-3',
            children: [],
            message: {
              author: { role: 'user' },
              end_turn: true,
              content: { parts: ['Ok'] }
            }
          }
        }
      }]

      const result = await importOai.importOpenAIConversations('user-123', data, mockHistory, '/mock', '/mock/attachments')
      
      expect(result).toBe(true)
      expect(mockHistory.chats).toHaveLength(1)
      
      const assistantMessage = mockHistory.chats[0].messages[1]
      expect(assistantMessage.content).toBe('Video without full dataJust alt textand video with no alt')
    })

    test('should handle unknown content reference types', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

      const data = [{
        id: 'conv-1',
        title: 'Unknown Reference Type',
        mapping: {
          'client-created-root': { children: ['msg-1'] },
          'msg-1': {
            id: 'msg-1',
            children: ['msg-2'],
            message: {
              author: { role: 'user' },
              content: { parts: ['Test'] }
            }
          },
          'msg-2': {
            id: 'msg-2',
            children: ['msg-3'],
            message: {
              author: { role: 'assistant' },
              end_turn: true,
              content: {
                parts: ['Unknown reference【unknown】']
              },
              metadata: {
                content_references: [
                  {
                    type: 'unknown_type',
                    matched_text: '【unknown】'
                  }
                ]
              }
            }
          },
          'msg-3': {
            id: 'msg-3',
            children: [],
            message: {
              author: { role: 'user' },
              end_turn: true,
              content: { parts: ['End'] }
            }
          }
        }
      }]

      const result = await importOai.importOpenAIConversations('user-123', data, mockHistory, '/mock', '/mock/attachments')
      
      expect(result).toBe(true)
      expect(consoleSpy).toHaveBeenCalledWith('Unknown content reference type:', 'unknown_type')
      
      consoleSpy.mockRestore()
    })

    test('should compare last modified for chats with same UUID', async () => {
      
      // Pre-populate history with existing chats
      mockHistory.chats.push({
        uuid: 'openai-conv-1',
        title: 'Existing Chat 1',
        lastModified: 1000,
        messages: []
      } as any)
      mockHistory.chats.push({
        uuid: 'openai-conv-2',
        title: 'Existing Chat 2',
        lastModified: 1000,
        messages: []
      } as any)

      const data = [{
        id: 'conv-1',
        title: 'Duplicate Chat 1',
        update_time: 1,
        mapping: {
          'client-created-root': { children: ['msg-1'] },
          'msg-1': { id: 'msg-1', children: ['msg-2'], message: { author: { role: 'user' }, content: { parts: ['Hello'] } } },
          'msg-2': { id: 'msg-2', children: ['msg-3'], message: { author: { role: 'assistant' }, end_turn: true, content: { parts: ['Hi'] } } },
          'msg-3': { id: 'msg-3', children: [], message: { author: { role: 'user' }, end_turn: true, content: { parts: ['Bye'] } } }
        }
      }, {
        id: 'conv-2',
        title: 'Duplicate Chat 2',
        update_time: 2,
        mapping: {
          'client-created-root': { children: ['msg-1'] },
          'msg-1': { id: 'msg-1', children: ['msg-2'], message: { author: { role: 'user' }, content: { parts: ['Hello'] } } },
          'msg-2': { id: 'msg-2', children: ['msg-3'], message: { author: { role: 'assistant' }, end_turn: true, content: { parts: ['Hi'] } } },
          'msg-3': { id: 'msg-3', children: [], message: { author: { role: 'user' }, end_turn: true, content: { parts: ['Bye'] } } }
        }
      }]

      const result = await importOai.importOpenAIConversations('user-123', data, mockHistory, '/mock', '/mock/attachments')
      
      expect(result).toBe(true)
      expect(mockHistory.chats).toHaveLength(2)
      expect(mockHistory.chats[0].title).toBe('Existing Chat 1')
      expect(mockHistory.chats[1].title).toBe('Duplicate Chat 2')
    })

    test('should handle messages with recipients other than "all"', async () => {
      const data = [{
        id: 'conv-1',
        title: 'Recipient Chat',
        mapping: {
          'client-created-root': { children: ['msg-1'] },
          'msg-1': {
            id: 'msg-1',
            children: ['msg-2'],
            message: {
              author: { role: 'user' },
              content: { parts: ['Hello'] }
            }
          },
          'msg-2': {
            id: 'msg-2',
            children: ['msg-3'],
            message: {
              author: { role: 'assistant' },
              recipient: 'specific_recipient', // Not "all"
              end_turn: true,
              content: { parts: ['This should be skipped'] }
            }
          },
          'msg-3': {
            id: 'msg-3',
            children: [],
            message: {
              author: { role: 'user' },
              end_turn: true,
              content: { parts: ['End'] }
            }
          }
        }
      }]

      const result = await importOai.importOpenAIConversations('user-123', data, mockHistory, '/mock', '/mock/attachments')
      
      expect(result).toBe(true)
      expect(mockHistory.chats).toHaveLength(1)
      
      const chat = mockHistory.chats[0]
      expect(chat.messages).toHaveLength(3) // Should include empty assistant message
      expect(chat.messages[1].content).toBe('') // Assistant message should be empty
    })

    test('should handle conversation using conversation_id instead of id', async () => {
      const data = [{
        conversation_id: 'conv-alt-1',
        title: 'Alt ID Chat',
        mapping: {
          'client-created-root': { children: ['msg-1'] },
          'msg-1': {
            id: 'msg-1',
            children: ['msg-2'],
            message: {
              author: { role: 'user' },
              content: { parts: ['Hello'] }
            }
          },
          'msg-2': {
            id: 'msg-2',
            children: ['msg-3'],
            message: {
              author: { role: 'assistant' },
              end_turn: true,
              content: { parts: ['Hi'] }
            }
          },
          'msg-3': {
            id: 'msg-3',
            children: [],
            message: {
              author: { role: 'user' },
              end_turn: true,
              content: { parts: ['Bye'] }
            }
          }
        }
      }]

      const result = await importOai.importOpenAIConversations('user-123', data, mockHistory, '/mock', '/mock/attachments')
      
      expect(result).toBe(true)
      expect(mockHistory.chats).toHaveLength(1)
      expect(mockHistory.chats[0].uuid).toBe('openai-conv-alt-1')
    })

    test('should handle multiple duplicate system messages', async () => {
      const data = [{
        id: 'conv-1',
        title: 'Multi System Chat',
        mapping: {
          'client-created-root': { children: ['msg-system1'] },
          'msg-system1': {
            id: 'msg-system1',
            children: ['msg-system2'],
            message: {
              author: { role: 'system' },
              content: { parts: ['First system message.'] }
            }
          },
          'msg-system2': {
            id: 'msg-system2',
            children: ['msg-1'],
            message: {
              author: { role: 'system' },
              content: { parts: ['Second system message (should be skipped).'] }
            }
          },
          'msg-1': {
            id: 'msg-1',
            children: ['msg-2'],
            message: {
              author: { role: 'user' },
              content: { parts: ['Hello'] }
            }
          },
          'msg-2': {
            id: 'msg-2',
            children: [],
            message: {
              author: { role: 'assistant' },
              end_turn: true,
              content: { parts: ['Hi'] }
            }
          }
        }
      }]

      const result = await importOai.importOpenAIConversations('user-123', data, mockHistory, '/mock', '/mock/attachments')
      
      expect(result).toBe(true)
      expect(mockHistory.chats).toHaveLength(1)
      
      const chat = mockHistory.chats[0]
      expect(chat.messages).toHaveLength(3) // Only one system message should be kept
      expect(chat.messages[0].role).toBe('system')
      expect(chat.messages[0].content).toBe('First system message.')
    })

    test('should handle additional content reference types that remove content', async () => {
      const data = [{
        id: 'conv-1',
        title: 'Remove Content Ref Chat',
        mapping: {
          'client-created-root': { children: ['msg-1'] },
          'msg-1': {
            id: 'msg-1',
            children: ['msg-2'],
            message: { author: { role: 'user' }, content: { parts: ['Hello'] } }
          },
          'msg-2': {
            id: 'msg-2',
            children: ['msg-3'],
            message: {
              author: { role: 'assistant' },
              content: { parts: ['Text [WEB] with [OPT] and [SPORTS] refs'] },
              metadata: {
                content_references: [
                  { type: 'webpage_extended', matched_text: '[WEB]' },
                  { type: 'optimistic_image_citation', matched_text: '[OPT]' },
                  { type: 'sports_schedule', matched_text: '[SPORTS]' }
                ]
              }
            }
          },
          'msg-3': {
            id: 'msg-3',
            children: [],
            message: { author: { role: 'user' }, content: { parts: ['Thanks'] } }
          }
        }
      }]

      const result = await importOai.importOpenAIConversations('user-123', data, mockHistory, '/mock', '/mock/attachments')

      expect(result).toBe(true)
      expect(mockHistory.chats).toHaveLength(1)
      expect(mockHistory.chats[0].messages).toHaveLength(3)
      expect(mockHistory.chats[0].messages[1].content).toBe('Text  with  and  refs')
    })

    test('should handle content reference types with alt text replacement', async () => {
      const data = [{
        id: 'conv-1',
        title: 'Alt Text Content Ref Chat',
        mapping: {
          'client-created-root': { children: ['msg-1'] },
          'msg-1': {
            id: 'msg-1',
            children: ['msg-2'],
            message: { author: { role: 'user' }, content: { parts: ['Hello'] } }
          },
          'msg-2': {
            id: 'msg-2',
            children: ['msg-3'],
            message: {
              author: { role: 'assistant' },
              content: { parts: ['Check [PAGES] and [ENTITY] and [NAV]'] },
              metadata: {
                content_references: [
                  { type: 'grouped_webpages', matched_text: '[PAGES]', alt: 'web pages' },
                  { type: 'product_entity', matched_text: '[ENTITY]', alt: 'product info' },
                  { type: 'nav_list', matched_text: '[NAV]', alt: 'navigation' }
                ]
              }
            }
          },
          'msg-3': {
            id: 'msg-3',
            children: [],
            message: { author: { role: 'user' }, content: { parts: ['Thanks'] } }
          }
        }
      }]

      const result = await importOai.importOpenAIConversations('user-123', data, mockHistory, '/mock', '/mock/attachments')

      expect(result).toBe(true)
      expect(mockHistory.chats).toHaveLength(1)
      expect(mockHistory.chats[0].messages).toHaveLength(3)
      expect(mockHistory.chats[0].messages[1].content).toBe('Check web pages and product info and navigation')
    })

    test('should handle content reference types without alt text (fallback to removal)', async () => {
      const data = [{
        id: 'conv-1',
        title: 'No Alt Text Content Ref Chat',
        mapping: {
          'client-created-root': { children: ['msg-1'] },
          'msg-1': {
            id: 'msg-1',
            children: ['msg-2'],
            message: { author: { role: 'user' }, content: { parts: ['Hello'] } }
          },
          'msg-2': {
            id: 'msg-2',
            children: ['msg-3'],
            message: {
              author: { role: 'assistant' },
              content: { parts: ['Check [PAGES] and [ENTITY] here'] },
              metadata: {
                content_references: [
                  { type: 'grouped_webpages', matched_text: '[PAGES]' }, // no alt
                  { type: 'product_entity', matched_text: '[ENTITY]' }   // no alt
                ]
              }
            }
          },
          'msg-3': {
            id: 'msg-3',
            children: [],
            message: { author: { role: 'user' }, content: { parts: ['Thanks'] } }
          }
        }
      }]

      const result = await importOai.importOpenAIConversations('user-123', data, mockHistory, '/mock', '/mock/attachments')

      expect(result).toBe(true)
      expect(mockHistory.chats).toHaveLength(1)
      expect(mockHistory.chats[0].messages).toHaveLength(3)
      expect(mockHistory.chats[0].messages[1].content).toBe('Check  and  here')
    })
  })
})
