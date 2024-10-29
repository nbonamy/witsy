import { Chat } from 'types/index.d'
import { App } from 'electron'
import { notifyBrowserWindows } from './windows'
import Monitor from './monitor'
import path from 'path'
import fs from 'fs'

const monitor: Monitor = new Monitor(() => notifyBrowserWindows('file-modified', 'history'))

export const historyFilePath = (app: App): string => {
  const userDataPath = app.getPath('userData')
  const historyFilePath = path.join(userDataPath, 'history.json')
  return historyFilePath
}

export const loadHistory = async (app: App): Promise<Chat[]> => {

  // needed
  const filepath = historyFilePath(app) 

  // // dropbox
  // if (!dropbox) {
  //   dropbox = new Dropbox(app, filepath, DROPBOX_PATH)
  // }
  // await dropbox.downloadIfNeeded()

  // check existence
  if (!fs.existsSync(filepath)) {
    return []
  }

  // local
  try {
    
    // load it
    const history = JSON.parse(fs.readFileSync(filepath, 'utf-8'))

    // clean-up in case deletions were missed
    cleanAttachmentsFolder(app, history)
    
    // start monitors
    monitor.start(filepath)
    //dropbox.monitor()

    // done
    return history
  
  } catch (error) {
    if (error.code !== 'ENOENT') {
      console.log('Error retrieving history data', error)
    }
    return null
  }

}

export const saveHistory = (app: App, content: Chat[]) => {
  try {

    // local
    const filepath = historyFilePath(app) 
    fs.writeFileSync(filepath, JSON.stringify(content, null, 2))

  } catch (error) {
    console.log('Error saving history data', error)
  }
}

const cleanAttachmentsFolder = (app: App, history: Chat[]) => {

  const unusedAttachments = listUnusedAttachments(app, history)
  for (const attachment of unusedAttachments) {
    try {
      console.log(`Deleting unused file: ${attachment}`)
      fs.unlinkSync(attachment)
    } catch (error) {
      console.error(`Error deleting file ${attachment}:`, error)
    }
  }
}

export const listUnusedAttachments = (app: App, history: Chat[]): string[] => {

  // get the user data path
  const userDataPath = app.getPath('userData')
  const imagesPath = path.join(userDataPath, 'images')

  // read all files in the images folder
  const files = listExistingAttachments(imagesPath)

  // now extract all the attachments in the chat
  const attachments = extractAttachmentsFromHistory(history, imagesPath)

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
  try {
    return fs.readdirSync(imagesPath)
  } catch (error) {
    console.error('Error reading images folder:', error)
    return []
  }

}  

export const extractAttachmentsFromHistory = (history: Chat[], imagesPath: string): string[] => {

  // regexes[0] matches content that is exactly a file:// url
  // regexes[1] matches content that is a file:// embedded in markdown ("(file://....)"
  const imagesPathUrl = encodeURI(`file://${imagesPath}`)
  const regexes = [
    new RegExp(`^file://${imagesPath}/([^()\\/]+)$`, 'g'),
    new RegExp(`\\(${imagesPathUrl}/([^()\\/]+)\\)`, 'g')
  ]

  // now extract all the attachments in the chat
  const attachments = []
  for (const chat of history) {
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
