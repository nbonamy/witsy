
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
    this.engine = null
    this.model = null
    this.messages = []
  
  }

  fromJson(obj) {
    this.uuid = obj.uuid || uuidv4()
    this.title = obj.title
    this.createdAt = obj.createdAt
    this.lastModified = obj.lastModified || obj.createdAt
    this.engine = obj.engine || 'openai'
    this.model = obj.model
    this.messages = []
    for (let msg of obj.messages) {
      let message = new Message(msg)
      this.messages.push(message)
    }
  }

  patchFromJson(obj) {

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
      let messages = obj.messages.slice(this.messages.length)
      for (let msg of messages) {
        let message = new Message(msg)
        this.messages.push(message)
        patched = true
      }
    }

    // done
    return patched
  }

  setEngineModel(engine, model) {
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
      if (message.attachment?.downloaded) {
        ipcRenderer.send('delete', { path: message.attachment.url })
      }
    }
  }

}
