
import { History } from '../types/index'
import { extensionToMimeType } from 'multi-llm-ts'
import { App } from 'electron'
import { pickFile } from './file'
import { loadHistory, saveHistory } from './history'
import Chat, { DEFAULT_TITLE } from '../models/chat'
import Message from '../models/message'
import Attachment from 'models/attachment'
import path from 'path'
import fs from 'fs'

export const importOpenAI = async (app: App): Promise<boolean> => {

  try {

    // first pick file
    const file = '/Users/nbonamy/Downloads/ded657c5c9cdd6870ff1dc5a4995ecb84f6851189a377c00b7d6eb5ddce7b32a-2025-08-05-12-22-42-bf52732b23d0434d9f9866cbd7648772/conversations.json'
    // const file = pickFile(app, {
    //   location: true,
    //   filters: [{
    //     name: 'OpenAI Files',
    //     extensions: ['json']
    //   }]
    // })

    if (!file) {
      return false
    }

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

  // we may need to look for files instead of the sourcePath
  const rootFiles = fs.readdirSync(sourcePath)
  const dalleFiles = fs.readdirSync(path.join(sourcePath, 'dalle-generations'))
  const userFiles = fs.readdirSync(path.join(sourcePath, userId))

  // now iterate
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

      // build the id
      const uuid = `openai-${conversation.id || conversation.conversation_id}`
      const existingChat = history.chats.find(chat => chat.uuid === uuid)
      if (existingChat) {
        console.warn(`Chat with ID ${uuid} already exists, skipping import for this conversation`)
        history.chats = history.chats.filter(chat => chat.uuid !== uuid)
        // continue
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
        createdAt: conversation.create_time ? conversation.create_time * 1000 : Date.now(),
        lastModified: conversation.update_time ? conversation.update_time * 1000 : conversation.create_time,
        engine: 'openai',
        model: conversation.model || 'gpt-3.5-turbo',
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
            const attachment = createAttachment(openaiAttachment.name, filepath, openaiAttachment.mime_type, attachmentPath)
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
        for (const part of openaiContent.parts || []) {

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

            message.appendText({
              type: 'content',
              text: part,
              done: true
            })

          }
        
        }

      }

      // add messages
      history.chats.push(chat)


    } catch (error) {
      console.error(`Error processing conversation at index ${index}`, error)
      continue
    }

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
