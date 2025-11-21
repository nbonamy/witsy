import { App, dialog } from 'electron'
import fs from 'fs'
import path from 'path'
import Chat from '@models/chat'
import Message from '@models/message'
import { pickFile } from './file'
import { loadHistory, saveHistory } from './history'
import { getLocaleMessages, useI18n } from './i18n'

// Build a map of all role translations from all locales
const buildRoleTranslationMap = (app: App): Map<string, 'system' | 'user' | 'assistant'> => {
  const roleMap = new Map<string, 'system' | 'user' | 'assistant'>()

  // Get all locale messages
  const allMessages = getLocaleMessages(app)
  for (const locale of Object.keys(allMessages)) {
    const messages = allMessages[locale]
    if (messages.chat?.role) {
      const { system, user, assistant } = messages.chat.role
      if (system) roleMap.set(system, 'system')
      if (user) roleMap.set(user, 'user')
      if (assistant) roleMap.set(assistant, 'assistant')
    }
  }

  return roleMap
}

export const parseMarkdownChat = (app: App, markdown: string): Chat => {
  const lines = markdown.split('\n')
  const roleMap = buildRoleTranslationMap(app)

  let title = ''
  let currentRole: 'system' | 'user' | 'assistant' | null = null
  let currentContent: string[] = []
  const messages: Message[] = []
  let expectingRole = false // Track if we're expecting a role after the title
  let firstH2Found = false // Track if we've seen the first H2 after title

  const finishCurrentMessage = () => {
    if (currentRole && currentContent.length > 0) {
      const content = currentContent.join('\n').trim()
      if (content) {
        const message = new Message(currentRole, content)
        messages.push(message)
      }
      currentContent = []
    }
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]

    // Check for H1 (title) - only if we don't have a title yet
    if (line.startsWith('# ') && !title) {
      title = line.substring(2).trim()
      expectingRole = true // After title, we expect a role
      continue
    }

    // Check for H2 - could be a role or content
    if (line.startsWith('## ')) {
      const roleText = line.substring(3).trim()
      const detectedRole = roleMap.get(roleText)

      // If this is the first H2 after the title, it MUST be a valid role
      if (expectingRole && !firstH2Found) {
        firstH2Found = true
        if (!detectedRole) {
          throw new Error(`First section after title must be a valid role (System, You, or Assistant), found: ${roleText}`)
        }
      }

      // Only treat as role switch if it's a valid role
      if (detectedRole) {
        finishCurrentMessage()
        currentRole = detectedRole
        expectingRole = false
        continue
      }
      // Otherwise, it's content (like "## Example Code")
    }

    // Collect content for current message (or skip if still expecting role)
    if (currentRole !== null) {
      currentContent.push(line)
    } else if (!expectingRole && title) {
      // If we have a title but no role yet, collect as content
      currentContent.push(line)
    }
  }

  // Finish the last message
  finishCurrentMessage()

  // Validate
  if (!title) {
    throw new Error('No title found (expected # Title at the beginning)')
  }

  if (expectingRole) {
    throw new Error('No valid role found after title (expected ## System, ## You, or ## Assistant)')
  }

  if (messages.length === 0) {
    throw new Error('No messages found (expected ## Role headers)')
  }

  // Create chat with current timestamps
  const chat = new Chat(title)
  for (const message of messages) {
    chat.addMessage(message)
  }

  return chat
}

export const importMarkdown = async (app: App, workspaceId?: string): Promise<Chat | null> => {
  // Pick file(s) - allow multiple selection
  const files = pickFile(app, {
    location: true,
    multiselection: true,
    filters: [{
      name: 'Markdown Files',
      extensions: ['md', 'markdown']
    }]
  })

  if (!files || (Array.isArray(files) && files.length === 0)) {
    return null
  }

  const t = useI18n(app)
  // Ensure files is always string[] (location: true guarantees string or string[])
  const fileList: string[] = Array.isArray(files) ? files : [files as string]

  // For single file and no workspaceId (IPC call), use old behavior
  if (fileList.length === 1 && !workspaceId) {
    return await importSingleFile(app, fileList[0], workspaceId)
  }

  // For multiple files or native menu, import all and show summary
  let successCount = 0
  let errorCount = 0
  const errors: string[] = []

  // Load history once if saving
  const history = workspaceId ? await loadHistory(app, workspaceId) : null

  for (const file of fileList) {
    try {
      const chat = await importSingleFile(app, file, undefined)
      if (chat && history) {
        history.chats.push(chat)
        successCount++
      }
    } catch (error) {
      errorCount++
      const fileName = path.basename(file)
      const errorMsg = error instanceof Error ? error.message : 'Unknown error'
      errors.push(`${fileName}: ${errorMsg}`)
      console.error(`Error importing ${fileName}:`, error)
    }
  }

  // Save history if needed
  if (history && workspaceId && successCount > 0) {
    saveHistory(app, workspaceId, history)
  }

  // Show summary dialog
  if (workspaceId) {
    await showImportSummary(app, t, successCount, errorCount, errors)
  }

  // Return first successful chat for IPC calls
  return null
}

async function importSingleFile(app: App, file: string, workspaceId?: string): Promise<Chat | null> {
  const t = useI18n(app)

  try {
    // Read file contents
    let contents = fs.readFileSync(file, 'utf-8')

    // Check if it's base64 encoded (matching export format)
    try {
      const decoded = Buffer.from(contents, 'base64').toString('utf-8')
      // If decoding succeeds and looks like markdown, use it
      if (decoded.includes('# ') || decoded.includes('## ')) {
        contents = decoded
      }
    } catch {
      // Not base64, use as-is
    }

    if (!contents.trim()) {
      throw new Error('Empty file')
    }

    // Parse the markdown
    const chat = parseMarkdownChat(app, contents)

    // If workspaceId is provided, save to history (single file mode)
    if (workspaceId) {
      const history = await loadHistory(app, workspaceId)
      history.chats.push(chat)
      saveHistory(app, workspaceId, history)

      // Show success message
      await dialog.showMessageBox({
        type: 'info',
        message: t('chat.import.success') || 'Chat imported successfully',
        detail: t('chat.import.successDetail') || 'The conversation has been imported and added to your chat history.',
        buttons: [t('common.ok')],
        defaultId: 0,
      })
    }

    return chat

  } catch (error) {
    console.error('Error importing markdown file:', error)

    if (workspaceId) {
      await dialog.showMessageBox({
        type: 'error',
        message: t('chat.import.error'),
        detail: error instanceof Error ? error.message : t('chat.import.invalidFormat'),
        buttons: [t('common.ok')],
        defaultId: 0,
      })
    }

    throw error
  }
}

async function showImportSummary(app: App, t: any, successCount: number, errorCount: number, errors: string[]): Promise<void> {
  const totalCount = successCount + errorCount

  if (totalCount === 0) {
    return
  }

  if (errorCount === 0) {
    // All successful
    let message: string
    let detail: string

    if (successCount === 1) {
      message = t('chat.import.success') as string
      detail = t('chat.import.successDetail') as string
    } else {
      message = t('chat.import.successMultiple', { count: successCount }) as string
      detail = t('chat.import.successMultipleDetail', { count: successCount }) as string
    }

    await dialog.showMessageBox({
      type: 'info',
      message,
      detail,
      buttons: [t('common.ok') as string],
      defaultId: 0,
    })
  } else if (successCount === 0) {
    // All failed
    let detail: string

    if (errorCount === 1) {
      detail = errors[0]
    } else {
      const errorMsg = t('chat.import.errorMultiple', { count: errorCount }) as string
      detail = `${errorMsg}\n\n${errors.slice(0, 5).join('\n')}${errors.length > 5 ? '\n...' : ''}`
    }

    await dialog.showMessageBox({
      type: 'error',
      message: t('chat.import.error') as string,
      detail,
      buttons: [t('common.ok') as string],
      defaultId: 0,
    })
  } else {
    // Mixed results
    const partialMsg = t('chat.import.partialSuccess', { success: successCount, error: errorCount }) as string
    const errorsLabel = t('chat.import.errors') as string
    const detail = `${partialMsg}\n\n${errorsLabel}:\n${errors.slice(0, 5).join('\n')}${errors.length > 5 ? '\n...' : ''}`

    await dialog.showMessageBox({
      type: 'warning',
      message: t('chat.import.partialSuccessTitle') as string,
      detail,
      buttons: [t('common.ok') as string],
      defaultId: 0,
    })
  }
}
