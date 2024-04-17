
import { Chat } from '../types/index.d'
import { ipcRenderer } from 'electron'
import { v4 as uuidv4 } from 'uuid'
import Message from './message'

export default class implements Chat {

  uuid: string
  title: string
  createdAt: number
  lastModified: number
  engine: string
  model: string
  messages: Message[]

  constructor(obj?: any) {

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
    this.engine = null
    this.model = null
    this.messages = []
  
  }

  fromJson(obj: any) {
    this.uuid = obj.uuid || uuidv4()
    this.title = obj.title
    this.createdAt = obj.createdAt
    this.lastModified = obj.lastModified || obj.createdAt
    this.engine = obj.engine || 'openai'
    this.model = obj.model
    this.messages = []
    for (const msg of obj.messages) {
      const message = new Message(msg.role, msg)
      this.messages.push(message)
    }
  }

  patchFromJson(obj: any) {

    // any diff spotted
    let patched = false
    if (this.title !== obj.title || this.lastModified !== obj.lastModified) {
      patched = true
    }

    // header
    this.title = obj.title
    this.lastModified = obj.lastModified

    // messages
    if (this.messages.length < obj.messages.length) {
      //console.log(`patching ${obj.messages.length - this.messages.length} messages`)
      const messages = obj.messages.slice(this.messages.length)
      for (const msg of messages) {
        const message = new Message(msg.role, msg)
        this.messages.push(message)
        patched = true
      }
    }

    // done
    return patched
  }

  setEngineModel(engine: string, model: string) {
    this.engine = engine
    this.model = model
  }

  subtitle() {
    if (this.messages.length > 2 && this.messages[2].type == 'text') {
      return this.messages[2].content
    } else {
      return ''
    }
  }

  addMessage(message: Message) {
    this.messages.push(message)
    this.lastModified = Date.now()
  }

  lastMessage() {
    return this.messages[this.messages.length - 1]
  }

  delete() {
    for (const message of this.messages) {
      if (message.type === 'image' && typeof message.content === 'string') {
        ipcRenderer.send('delete', { path: message.content })
      }
      if (message.attachment?.downloaded) {
        ipcRenderer.send('delete', { path: message.attachment.url })
      }
    }
  }

}
