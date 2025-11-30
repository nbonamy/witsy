
import { App } from 'electron'
import fs from 'fs'
import { LlmModelOpts } from 'multi-llm-ts'
import path from 'path'
import { Chat, History } from 'types/index'
import { kHistoryVersion } from '../consts'
import { loadAllChats } from './chat'
import { migrateHistoryToIndividualChats } from './migration'
import Monitor from './monitor'
import { notifyBrowserWindows } from './windows'
import { workspaceFolderPath } from './workspace'

export const kUnusedDelay = 3600000

const monitor: Monitor = new Monitor(() => {
  //console.log('History file modified')
  notifyBrowserWindows('file-modified', 'history')
})

export const historyFilePath = (app: App, workspaceId: string): string => {
  const workspacePath = workspaceFolderPath(app, workspaceId)
  return path.join(workspacePath, 'history.json')
}

export const attachmentsFilePath = (app: App, workspaceId: string): string => {
  const workspacePath = workspaceFolderPath(app, workspaceId)
  return path.join(workspacePath, 'images')
}

export const loadHistory = async (app: App, workspaceId: string): Promise<History> => {

  // needed
  const filepath = historyFilePath(app, workspaceId)

  // check existence
  if (!fs.existsSync(filepath)) {
    return { version: kHistoryVersion, folders: [], chats: [], quickPrompts: [] }
  }

  // Try to migrate to individual chat files if not already done
  // This is a one-time automatic migration
  try {
    migrateHistoryToIndividualChats(app, workspaceId)
  } catch (error) {
    console.error('Migration failed, continuing with old format:', error)
  }

  // local
  try {

    // load it
    let history: History = JSON.parse(fs.readFileSync(filepath, 'utf-8'))

    // check version
    if (history.version && history.version !== kHistoryVersion) {
      return {
        version: history.version,
        folders: [],
        chats: [],
        quickPrompts: []
      }
    } 

    // backwards compatibility
    if (Array.isArray(history)) {
      console.log('Upgrading history data')
      history = { version: kHistoryVersion, folders: [], chats: history, quickPrompts: []}
    }

    // backwards compatibility for folder defaults
    for (const folder of history.folders) {
      // @ts-expect-error backwards compatibility
      if (folder.defaults?.prompt) {
      // @ts-expect-error backwards compatibility
        folder.defaults.instructions = folder.defaults.prompt
      // @ts-expect-error backwards compatibility
        delete folder.defaults.prompt
      }
    }

    // backwards compatibility for model opts
    for (const folder of history.folders) {
      const modelOpts: LlmModelOpts = {}
      for (const attr of [
        /* LlmModelOpts */          'contextWindowSize', 'maxTokens', 'temperature', 'top_k', 'top_p',
        /* LlmOpenAIModelOpts */    'reasoningEffort', 'verbosity',
        /* LlmAnthropicModelOpts */ 'reasoning', 'reasoningBudget',
        /* LlmGoogleModelOpts */    'thinkingBudget',
                                    'customOpts'
      ]) {
        // @ts-expect-error backwards compatibility
        if (folder.defaults && typeof folder.defaults[attr] !== 'undefined') {
          // @ts-expect-error backwards compatibility
          modelOpts[attr] = folder.defaults[attr]
          // @ts-expect-error backwards compatibility
          delete folder.defaults[attr]
        }
      }
      if (Object.keys(modelOpts).length > 0) {
        folder.defaults.modelOpts = modelOpts
      }
    }


    // clean-up in case deletions were missed
    cleanAttachmentsFolder(app, workspaceId)
    
    // start monitors
    monitor.start(filepath)

    // done
    history.version = kHistoryVersion
    return history
  
  } catch (error) {
    if (error.code !== 'ENOENT') {
      console.log('Error retrieving history data', error)
    }
    return null
  }

}

export const saveHistory = (app: App, workspaceId: string, history: History) => {
  try {

    // check version
    if (history.version !== kHistoryVersion) {
      return
    }

    // local
    const filepath = historyFilePath(app, workspaceId) 
    fs.writeFileSync(filepath, JSON.stringify(history, null, 2))

  } catch (error) {
    console.log('Error saving history data', error)
  }
}

const cleanAttachmentsFolder = (app: App, workspaceId: string) => {

  // disabled to allow migration in future releases
  return

  const unusedAttachments = listUnusedAttachments(app, workspaceId)
  for (const attachment of unusedAttachments) {
    try {
      console.log(`Deleting unused file: ${attachment}`)
      fs.unlinkSync(attachment)
    } catch (error) {
      console.error(`Error deleting file ${attachment}:`, error)
    }
  }
}

export const listUnusedAttachments = (app: App, workspaceId: string): string[] => {

  // get the images path (workspace-relative)
  const imagesPath = path.join(workspaceFolderPath(app, workspaceId), 'images')

  // read all files in the images folder
  const files = listExistingAttachments(imagesPath)

  // Load all chats from individual files (not from memory)
  // This ensures we scan ALL chats, including those not currently loaded
  const chats = loadAllChats(app, workspaceId)

  // now extract all the attachments in the chat
  const attachments = extractAttachmentsFromHistory(chats, imagesPath)

  // Compare files in the images folder with attachments in the chat
  const unusedAttachments = []
  for (const file of files) {
    if (!attachments.includes(file)) {
      unusedAttachments.push(path.join(imagesPath, file))
    }
  }

  // done
  return unusedAttachments

}

const listExistingAttachments = (imagesPath: string): string[] => {

  // check if the images folder exists
  if (!fs.existsSync(imagesPath)) {
    return []
  }

  // read all files in the images folder
  // return only ones created more than 1 hour ago
  try {
    const now = new Date()
    return fs.readdirSync(imagesPath).filter(file => {
      const filepath = path.join(imagesPath, file)
      const stats = fs.statSync(filepath)
      const diff = now.getTime() - stats.mtime.getTime()
      return diff > kUnusedDelay
    })
  } catch (error) {
    console.error('Error reading images folder:', error)
    return []
  }

}  

export const extractAttachmentsFromHistory = (chats: Chat[], imagesPath: string): string[] => {

  // regexes[0] matches content that is exactly a file:// url
  // regexes[1] matches content that is a file:// embedded in markdown ("(file://....)"
  // regexes[2] matches content that is a file:// url in an img or video tag
  let imagesPathUrl = encodeURI(`file://${imagesPath}`)
  imagesPathUrl = imagesPathUrl.replace(/%20/g, '(?:%20|\\s)')
  const imagesPathUri = imagesPath.replace(/ /g, '(?:%20|\\s)')
  const regexes = [
    new RegExp(`^file://${imagesPathUri}/([^()\\/]+)$`, 'g'),
    new RegExp(`\\(${imagesPathUrl}/([^()\\/]+)\\)`, 'g'),
    new RegExp(`<(?:img|video)[^>]*?src="${imagesPathUrl}/([^"]+)"`, 'g')
  ]

  // now extract all the attachments in the chat
  const attachments = []
  for (const chat of chats) {
    for (const message of chat.messages) {
      
      // extract all attachments from message.content
      for (const regex of regexes) {
        const matches = message.content?.matchAll(regex)
        for (const match of matches || []) {
          const filename = match[1]
          attachments.push(filename)
        }
      }

      // now check if the message has an attachment
      for (const attachment of message.attachments ?? []) {
        const url = attachment.url
        if (url.startsWith(`file://${imagesPath}`)) {
          let filename = path.basename(url)
          // Remove possible ending parenthesis
          filename = filename.replace(/\)$/, '')
          attachments.push(filename)
        }
      }
    }
  }
  
  // done
  return attachments

}
