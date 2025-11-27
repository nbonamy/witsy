
import { Chat, ChatMetadata } from 'types/index'
import { App } from 'electron'
import { workspaceFolderPath } from './workspace'
import path from 'path'
import fs from 'fs'

/**
 * Get the path to the chats folder for a workspace
 */
export const chatsFolder = (app: App, workspaceId: string): string => {
  const workspacePath = workspaceFolderPath(app, workspaceId)
  const chatsFolderPath = path.join(workspacePath, 'chats')
  fs.mkdirSync(chatsFolderPath, { recursive: true })
  return chatsFolderPath
}

/**
 * Get the file path for a specific chat
 */
export const chatFilePath = (app: App, workspaceId: string, chatId: string): string => {
  const chatsFolderPath = chatsFolder(app, workspaceId)
  return path.join(chatsFolderPath, `${chatId}.json`)
}

export const chatToMetadata = (chat: Chat): ChatMetadata => {
  const clone: ChatMetadata = JSON.parse(JSON.stringify(chat))
  delete (clone as any).messages
  return clone
}

/**
 * Load a single chat from its file
 */
export const loadChat = (app: App, workspaceId: string, chatId: string): Chat | null => {
  const filepath = chatFilePath(app, workspaceId, chatId)

  try {
    if (!fs.existsSync(filepath)) {
      return null
    }

    const data = fs.readFileSync(filepath, 'utf-8')
    return JSON.parse(data)
  } catch (error) {
    console.error(`Error loading chat ${chatId}:`, error)
    return null
  }
}

/**
 * Save a single chat to its file
 */
export const saveChat = (app: App, workspaceId: string, chat: Chat): boolean => {
  const filepath = chatFilePath(app, workspaceId, chat.uuid)

  try {
    // Ensure chats folder exists
    chatsFolder(app, workspaceId)

    // Save chat data
    fs.writeFileSync(filepath, JSON.stringify(chat, null, 2))
    return true
  } catch (error) {
    console.error(`Error saving chat ${chat.uuid}:`, error)
    return false
  }
}

/**
 * Delete a chat file
 */
export const deleteChat = (app: App, workspaceId: string, chatId: string): boolean => {
  const filepath = chatFilePath(app, workspaceId, chatId)

  try {
    if (fs.existsSync(filepath)) {
      fs.unlinkSync(filepath)
    }
    return true
  } catch (error) {
    console.error(`Error deleting chat ${chatId}:`, error)
    return false
  }
}

/**
 * List all chat IDs in a workspace
 */
export const listChatIds = (app: App, workspaceId: string): string[] => {
  const chatsFolderPath = chatsFolder(app, workspaceId)

  try {
    if (!fs.existsSync(chatsFolderPath)) {
      return []
    }

    const files = fs.readdirSync(chatsFolderPath)
    return files
      .filter(file => file.endsWith('.json'))
      .map(file => file.replace('.json', ''))
  } catch (error) {
    console.error('Error listing chat IDs:', error)
    return []
  }
}

/**
 * Load all chats from their files
 */
export const loadAllChats = (app: App, workspaceId: string): Chat[] => {
  const chatIds = listChatIds(app, workspaceId)
  const chats: Chat[] = []

  for (const chatId of chatIds) {
    const chat = loadChat(app, workspaceId, chatId)
    if (chat) {
      chats.push(chat)
    }
  }

  return chats
}

/**
 * Search across all chat files for matching content
 */
export const searchChatsInMessages = (
  app: App,
  workspaceId: string,
  excludeChats: string[],
  query: string
): string[] => {
  const lowerQuery = query.toLowerCase()
  const matchingChatIds: string[] = []
  const chatIds = listChatIds(app, workspaceId)

  for (const chatId of chatIds) {

    if (excludeChats.includes(chatId)) {
      continue
    }

    const chat = loadChat(app, workspaceId, chatId)
    if (!chat) continue

    // Search in messages
    const hasMatch = chat.messages?.some(m =>
      m.content?.toLowerCase().includes(lowerQuery)
    )

    if (hasMatch) {
      matchingChatIds.push(chatId)
    }
  }

  return matchingChatIds
}
