
import { Folder, History } from '../types/index'
import { extensionToMimeType } from 'multi-llm-ts'
import { App, dialog } from 'electron'
import { pickFile } from './file'
import { useI18n } from '../main/i18n'
import { loadHistory, saveHistory } from './history'
import Chat, { DEFAULT_TITLE } from '../models/chat'
import Message from '../models/message'
import Attachment from '../models/attachment'
import path from 'path'
import fs from 'fs'

const DEFAULT_FOLDER_NAME = 'ChatGPT'

export const importOpenAI = async (app: App): Promise<boolean> => {

  // first pick file
  const file = pickFile(app, {
    location: true,
    filters: [{
      name: 'OpenAI Files',
      extensions: ['conversations.json']
    }]
  })

  if (!file) {
    return false
  }

  const t = useI18n(app)

  const rc = await processOpenAI(app, file as string)
  if (rc) {
    await dialog.showMessageBox({
      type: 'info',
      message: t('import.openai.success.title'),
      detail: t('import.openai.success.message'),
      buttons: [t('common.ok')],
      defaultId: 0,
    })    
  } else {
    await dialog.showMessageBox({
      type: 'error',
      message: t('import.openai.error.title'),
      detail: t('import.openai.error.unknown'),
      buttons: [t('common.ok')],
      defaultId: 0,
    })    
  }

}

const processOpenAI = async (app: App, file: string): Promise<boolean> => {

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
    const sourcePath = path.dirname(file as string)
    const userFile = path.join(sourcePath, 'user.json')
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
    const history = await loadHistory(app)
    const attachmentPath = path.join(app.getPath('userData'), 'images')
    const rc = await importOpenAIConversations(userData.id, data, history, sourcePath, attachmentPath)

    // save
    if (rc) {
      saveHistory(app, history)
    }

    // done
    return rc

  } catch (error) {
    console.error('Error importing OpenAI file:', error)
    return false
  }
}

export const importOpenAIConversations = async (userId: string, data: any, history: History, sourcePath: string, attachmentPath: string): Promise<boolean> => {

  // do some checks on the data
  if (!Array.isArray(data)) {
    console.error('Invalid OpenAI conversations data format')
    return false
  }

  // it is empty then it is a success
  if (data.length === 0) {
    console.warn('No conversations to import')
    return false
  }

  // check some basic stuff
  const conversation = data[0]
  if (typeof conversation !== 'object' || !conversation.title || !conversation.mapping) {
    console.error('Invalid OpenAI conversation format', conversation)
    return false
  }

  // we may need to look for files inside of the sourcePath
  const rootFiles = fs.readdirSync(sourcePath)

  // same for dalle generations
  let dalleFiles: string[] = []
  const dalleGenerationsPath = path.join(sourcePath, 'dalle-generations')
  if (fs.existsSync(dalleGenerationsPath)) {
    dalleFiles = fs.readdirSync(path.join(sourcePath, 'dalle-generations'))
  }

  // and for user files
  let userFiles: string[] = []
  const userFilesPath = path.join(sourcePath, userId)
  if (fs.existsSync(userFilesPath)) {
    userFiles = fs.readdirSync(userFilesPath)
  }

  // let's create a folder
  let folder: Folder = history.folders.find(f => f.name === DEFAULT_FOLDER_NAME)
  if (!folder) {
    folder = {
      id: `chatgpt-${crypto.randomUUID()}`,
      name: DEFAULT_FOLDER_NAME,
      chats: []
    }
  }

  // if we have a folder with the same name, remove it  // now iterate
  for (const index in data) {

    try {

      // check basic stuff
      const conversation = data[index]
      if (typeof conversation !== 'object') {
        console.error(`Invalid conversation at index ${index}`, conversation)
        continue
      }

      // check if it an ephemeral conversation
      if (conversation.is_do_not_remember) {
        console.warn(`Skipping ephemeral conversation at index ${index}`, conversation)
        continue
      }

      // check if it has an ID
      if (!conversation.id && !conversation.conversation_id) {
        console.error(`Conversation ID is missing at index ${index}`, conversation)
        continue
      }

      // we need that
      const createTime = conversation.create_time ? Math.round(conversation.create_time * 1000) : Date.now()
      const updateTime = conversation.update_time ? Math.round(conversation.update_time * 1000) : createTime

      // build the id
      const uuid = `openai-${conversation.id || conversation.conversation_id}`
      const existingChat = history.chats.find(chat => chat.uuid === uuid)
      if (existingChat) {
        if (existingChat.lastModified >= updateTime) {
          continue
        } else {
          console.log(`Chat with ID ${uuid} already exists but ChatGPT version is newer, updating it`)
          history.chats = history.chats.filter(chat => chat.uuid !== uuid)
          folder.chats = folder.chats.filter(chatId => chatId !== uuid)
        }
      }

      // we need to find the first message
      let childId = null

      // check that we have a mapping
      const children = conversation.mapping?.['client-created-root']?.children
      if (children && Array.isArray(children) && children.length > 0) {
        childId = children[0]
      }

      // find a message with no parent
      if (!childId) {
        const orphanMessages: any[] = Object.values(conversation.mapping || {}).filter((msg: any) => !msg.parent)
        if (orphanMessages.length === 1) {
          childId = orphanMessages[0].id
        }
      }

      // try to find a system message
      if (!childId) {
        const systemMessage: any[] = Object.values(conversation.mapping || {}).filter((msg: any) => msg.message?.author?.role === 'system')
        if (systemMessage.length === 1) {
          childId = systemMessage[0].id
        }
      }

      // still not found?
      if (!childId) {
        console.error(`No messages found in conversation at index ${index}`, conversation)
        continue
      }

      // create a new chat
      const chat = Chat.fromJson({
        uuid,
        title: conversation.title || DEFAULT_TITLE,
        createdAt: createTime,
        lastModified: updateTime,
        engine: 'openai',
        model: conversation.model || 'gpt-4o',
        messages: [],
      })

      // iterate over messages
      let continuePreviousMessage = false
      while (childId) {

        // get the message
        const openaiEnvelope: any = conversation.mapping[childId]

        // update childId for next iteration
        childId = openaiEnvelope?.children?.[0] || null

        // if this thing as no message, skip it
        if (!openaiEnvelope?.message) {
          continue
        }

        // get some info
        const openaiMessage = openaiEnvelope.message
        const uuid = openaiEnvelope.id || crypto.randomUUID()
        const role = openaiMessage.author?.role
        const createdAt = openaiMessage.create_time ? openaiMessage.create_time * 1000 : Date.now()
        const endsTurn = openaiMessage.end_turn ?? false
        const model = openaiMessage.metadata?.model_slug
        
        // propagate model to chat and other message
        if (model) {
          chat.model = model
          for (let idx = chat.messages.length - 1; idx >= 0; idx--) {
            const message = chat.messages[idx]
            if (!message.model) {
              message.model = model
            }
          }
        }

        // if we already added the system message skip further one
        if (role === 'system' && chat.messages.some(m => m.role === 'system')) {
          continue
        }

        // message can be continuation of previous message
        let message = (continuePreviousMessage || role === 'tool') ? chat.lastMessage() : null
        continuePreviousMessage = !endsTurn

        // for tool we are only interested in multimodal_text (generated images)
        if (role === 'tool' && openaiMessage.content?.content_type !== 'multimodal_text') {
          continue
        }

        // build the message
        if (!message || (message.role !== role && role !== 'tool')) {

          // we need a role
          if (!role) {
            console.error(`Message at index ${index} has no role`, openaiEnvelope)
            continue
          }

          // make sure we have a valid role
          if (!['user', 'assistant', 'system'].includes(role)) {
            console.error(`Invalid role "${role}" for message at index ${index}`, openaiEnvelope)
            continue
          }

          // now we can build
          message = Message.fromJson({
            uuid,
            role,
            content: '',
            createdAt,
            engine: 'openai',
            model,
          })
          chat.messages.push(message)
        
        }

        // add attachments if any
        const openaiAttachments = openaiMessage.metadata?.attachments || []
        for (const openaiAttachment of openaiAttachments) {

          try {

            const filename = `${openaiAttachment.id}-${openaiAttachment.name}`
            const filepath = path.join(sourcePath, filename)
            const mimeType = openaiAttachment.mime_type || openaiAttachment.mimeType || extensionToMimeType(path.extname(filename))
            const attachment = createAttachment(openaiAttachment.name, filepath, mimeType, attachmentPath)
            if (attachment) {
              message.attach(attachment)
            } 

          } catch (error) {
            console.error(`Error processing attachment ${openaiAttachment.id} at index ${index}`, error)
          }

        }

        // now build the content
        const openaiContent = openaiMessage.content
        if (!openaiContent) {
          continue
        }

        // now iterate over the parts
        for (let part of openaiContent.parts || []) {

          // if object
          if (typeof part === 'object' && part.content_type === 'image_asset_pointer') {

            // check if is an attachment
            const id = part.asset_pointer.replace(/^.*:\/\//, '')
            const isAttachment = openaiMessage.metadata?.attachments?.some((attachment: any) => attachment.id === id)
            if (isAttachment) {
              continue
            }

            // if role is 'user' then this is a new attachment
            // but we do not know the full filename so we need to find it
            if (role === 'user') {
              const candidates = rootFiles.filter((file) => file.includes(id))
              if (candidates.length === 1) {
                const filepath = path.join(sourcePath, candidates[0])
                const mimeType = extensionToMimeType(path.extname(filepath))
                const attachment = createAttachment(id, filepath, mimeType, attachmentPath)
                if (attachment) {
                  message.attach(attachment)
                }
              }
              continue
            }

            // this should be an assistant message
            if (message.role !== 'assistant') {
              console.error(`Image asset pointer found in message with role "${message.role}" at index ${index}`, openaiEnvelope)
              continue
            }

            // two possibilities
            let filepath = null
            let filename = dalleFiles.find(file => file.startsWith(id))
            if (filename) {
              filepath = path.join(sourcePath, 'dalle-generations', filename)
            } else {
              filename = userFiles.find(file => file.startsWith(id))
              if (filename) {
                filepath = path.join(sourcePath, userId, filename)
              } 
            }
            if (!filename) {
              console.error(`Image asset pointer "${id}" not found in dalle or user files at index ${index}`, openaiEnvelope)
              continue
            }

            // copy the file
            const targetPath = path.join(attachmentPath, filename)
            copyFile(filepath, targetPath)

            // try to find a prompt
            const prompt = part.metadata?.dalle?.prompt

            // if prompt add a fake tool call
            if (prompt) {
              message.addToolCall({
                type: 'tool',
                id: id,
                name: 'dalle',
                call: {
                  params: { prompt, },
                  result: { url: `file://${targetPath}`, }
                },
                done: true,
              })
            }

            // now add text to the message
            message.appendText({
              type: 'content',
              text: `![${prompt || 'OpenAI image'}](file://${targetPath})`,
              done: true
            })

          } else if (typeof part === 'string' && role !== 'tool' && (!openaiMessage.recipient || openaiMessage.recipient === 'all')) {

            // process content references
            for (const ref of openaiMessage.metadata?.content_references || []) {

              // skip empty matched_text
              if (!ref.matched_text?.trim()?.length) {
                continue
              }

              // depends on type
              if (ref.type === 'attribution' || ref.type === 'hidden') {
              
                // nop

              } else if (['image_v2', 'grouped_webpages', 'products', 'product_entity', 'nav_list'].includes(ref.type)) {

                if (ref.alt) {
                  part = part.replace(ref.matched_text, ref.alt)
                } else {
                  part = part.replace(ref.matched_text, '')
                }
              
              } else if (ref.type === 'grouped_webpages_model_predicted_fallback') {

                if (ref.prompt_text) {
                  part = part.replace(ref.matched_text, ref.prompt_text)
                } else {
                  part = part.replace(ref.matched_text, '')
                }

              } else if (ref.type === 'video') {

                if (ref.alt) {
                  if (ref.title && ref.thumbnail_url && ref.url) {
                    part = part.replace(ref.matched_text, `[![${ref.title}](${ref.thumbnail_url})](${ref.url})`)
                  } else {
                    part = part.replace(ref.matched_text, ref.alt)
                  }
                } else {
                  part = part.replace(ref.matched_text, '')
                }

              } else if (['webpage_extended', 'file', 'optimistic_image_citation', 'sports_schedule'].includes(ref.type)) {

                part = part.replace(ref.matched_text, '')

              } else {
                console.log('Unknown content reference type:', ref.type)
              }
            }

            // now remove all private use area characters
            part = part.split('').filter((c: string) => c.charCodeAt(0) < 57344).join('')

            // now add it
            message.appendText({
              type: 'content',
              text: part,
              done: true
            })

          }
        
        }

      }

      // only add if we have enough messages
      if (chat.messages.length >= 3) {
        history.chats.push(chat)
        folder.chats.push(chat.uuid)
      }

    } catch (error) {
      console.error(`Error processing conversation at index ${index}`, error)
      continue
    }

  }

  // add the folder only if it has chats
  if (folder.chats.length > 0 && !history.folders.find(f => f.name === folder.name)) {
    history.folders.push(folder)
  }

  // done
  return true

}

const createAttachment = (name: string, filepath: string, mimeType: string, attachmentPath: string): Attachment|null => {

  if (!fs.existsSync(filepath)) {
    return null
  }

  // we need to copy this file to the attachments folder
  const targetPath = path.join(attachmentPath, path.basename(filepath))
  copyFile(filepath, targetPath)

  // now create the attachment
  const attachment = new Attachment('', mimeType, `file://${targetPath}`, true, false)
  attachment.title = name
  return attachment

}

const copyFile = (source: string, destination: string): void => {
  const contents = fs.readFileSync(source, 'binary')
  fs.writeFileSync(destination, contents, 'binary')
}
