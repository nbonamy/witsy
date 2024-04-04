
import { ipcRenderer } from 'electron'
import { v4 as uuidv4 } from 'uuid'
import Message from './message'

export default class Chat {

  constructor(obj) {

    // json
    if (typeof obj === 'object') {
      this.fromJson(obj)
      return
    }

    // default
    this.uuid = uuidv4()
    this.title = obj || 'New Chat'
    this.createdAt = Date.now()
    this.lastModified = Date.now()
    this.messages = []
  
  }

  fromJson(obj) {
    this.uuid = obj.uuid || uuidv4()
    this.title = obj.title
    this.createdAt = obj.createdAt
    this.lastModified = obj.lastModified || obj.createdAt
    this.messages = []
    for (let msg of obj.messages) {
      let message = new Message(msg)
      this.messages.push(message)
    }
  }

  subtitle() {
    if (this.messages.length > 2 && this.messages[2].type == 'text') {
      return this.messages[2].content
    } else {
      return ''
    }
  }

  setTitle(title) {
    this.title = title
  }

  addMessage(message) {
    this.messages.push(message)
    this.lastModified = Date.now()
  }

  lastMessage() {
    return this.messages[this.messages.length - 1]
  }

  delete() {
    for (let message of this.messages) {
      if (message.type === 'image' && typeof message.content === 'string') {
        ipcRenderer.send('delete', { path: message.content })
      }
      if (typeof message.attachment == 'string') {
        ipcRenderer.send('delete', { path: message.attachment })
      }
    }
  }

}
