
import { App } from 'electron'
import { History } from 'types/index'
import { historyFilePath } from './history'
import { chatsFolder, saveChat, listChatIds } from './chat'
import fs from 'fs'

/**
 * Migrate history.json from monolithic format to individual chat files
 * This is a one-time migration that runs automatically on first startup
 */
export const migrateHistoryToIndividualChats = (
  app: App,
  workspaceId: string
): boolean => {
  const historyPath = historyFilePath(app, workspaceId)

  // Check if history.json exists
  if (!fs.existsSync(historyPath)) {
    console.log('No history.json to migrate')
    return false
  }

  // Check if already migrated by looking for existing chat files
  const chatsDir = chatsFolder(app, workspaceId)
  const existingChatIds = listChatIds(app, workspaceId)
  if (existingChatIds.length > 0) {
    console.log('Already migrated to individual chat files')
    return false
  }

  // Load old history format
  let oldHistory: History
  try {
    const historyData = fs.readFileSync(historyPath, 'utf-8')
    oldHistory = JSON.parse(historyData)
  } catch (error) {
    console.error('Failed to read history.json:', error)
    return false
  }

  // Validate history structure
  if (!oldHistory || !Array.isArray(oldHistory.chats)) {
    console.log('Invalid history format, skipping migration')
    return false
  }

  // If there are no chats to migrate, nothing to do
  if (oldHistory.chats.length === 0) {
    console.log('No chats to migrate')
    return false
  }

  // BACKUP old history BEFORE any changes
  const backupPath = `${historyPath}.backup`
  try {
    // Only create backup if it doesn't already exist (preserve first backup)
    if (!fs.existsSync(backupPath)) {
      fs.copyFileSync(historyPath, backupPath)
      console.log(`Created backup at ${backupPath}`)
    } else {
      console.log(`Backup already exists at ${backupPath}`)
    }
  } catch (error) {
    console.error('Failed to create backup, aborting migration:', error)
    return false
  }

  // Create chats directory
  try {
    fs.mkdirSync(chatsDir, { recursive: true })
  } catch (error) {
    console.error('Failed to create chats directory:', error)
    return false
  }

  // Save each chat individually
  let successCount = 0
  let failureCount = 0

  for (const chat of oldHistory.chats) {
    try {
      const saved = saveChat(app, workspaceId, chat)
      if (saved) {
        successCount++
      } else {
        failureCount++
        console.error(`Failed to save chat ${chat.uuid}`)
      }
    } catch (error) {
      failureCount++
      console.error(`Error saving chat ${chat.uuid}:`, error)
    }
  }

  // If any failures occurred, abort and rollback
  if (failureCount > 0) {
    console.error(`Migration failed: ${failureCount} chats could not be saved`)
    console.log('Rolling back migration...')

    // Clean up partial migration
    try {
      fs.rmSync(chatsDir, { recursive: true, force: true })
      console.log('Cleaned up partial migration')
    } catch (error) {
      console.error('Failed to clean up partial migration:', error)
    }

    return false
  }

  // Create new metadata-only history.json
  // Note: At this point we're NOT changing the format yet
  // We're keeping the full history.json intact for backwards compatibility
  // The new chat files are additional, not replacements
  // This allows gradual migration and rollback if needed

  console.log(`Successfully migrated ${successCount} chats to individual files`)
  console.log(`Original history backed up to ${backupPath}`)

  return true
}

/**
 * Check if migration has been completed
 */
export const isMigrationComplete = (app: App, workspaceId: string): boolean => {
  const chatIds = listChatIds(app, workspaceId)
  return chatIds.length > 0
}
