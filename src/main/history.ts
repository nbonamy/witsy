
import { History, Chat } from 'types/index'
import { App } from 'electron'
import { notifyBrowserWindows } from './windows'
import Monitor from './monitor'
import path from 'path'
import fs from 'fs'

export const kUnusedDelay = 3600000

const monitor: Monitor = new Monitor(() => {
  //console.log('History file modified')
  notifyBrowserWindows('file-modified', 'history')
})

export const historyFilePath = (app: App): string => {
  const userDataPath = app.getPath('userData')
  const historyFilePath = path.join(userDataPath, 'history.json')
  return historyFilePath
}

export const loadHistory = async (app: App): Promise<History> => {

  // needed
  const filepath = historyFilePath(app) 

  // check existence
  if (!fs.existsSync(filepath)) {
    return { folders: [], chats: [], quickPrompts: [] }
  }

  // local
  try {
    
    // load it
    let history = JSON.parse(fs.readFileSync(filepath, 'utf-8'))

    // backwards compatibility
    if (Array.isArray(history)) {
      console.log('Upgrading history data')
      history = { folders: [], chats: history }
    }

    // clean-up in case deletions were missed
    cleanAttachmentsFolder(app, history)
    
    // start monitors
    monitor.start(filepath)

    // done
    return history
  
  } catch (error) {
    if (error.code !== 'ENOENT') {
      console.log('Error retrieving history data', error)
    }
    return null
  }

}

export const saveHistory = (app: App, history: History) => {
  try {

    // local
    const filepath = historyFilePath(app) 
    fs.writeFileSync(filepath, JSON.stringify(history, null, 2))

  } catch (error) {
    console.log('Error saving history data', error)
  }
}

const cleanAttachmentsFolder = (app: App, history: History) => {

  const unusedAttachments = listUnusedAttachments(app, history.chats)
  for (const attachment of unusedAttachments) {
    try {
      console.log(`Deleting unused file: ${attachment}`)
      fs.unlinkSync(attachment)
    } catch (error) {
      console.error(`Error deleting file ${attachment}:`, error)
    }
  }
}

export const listUnusedAttachments = (app: App, chats: Chat[]): string[] => {

  // get the user data path
  const userDataPath = app.getPath('userData')
  const imagesPath = path.join(userDataPath, 'images')

  // read all files in the images folder
  const files = listExistingAttachments(imagesPath)

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
      if (message.attachment) {
        const url = message.attachment.url
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
