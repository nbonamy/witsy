
import Message from './message'

export default class Chat {

  constructor(obj) {

    // json
    if (typeof obj === 'object') {
      this.fromJson(obj)
      return
    }

    // default
    this.title = obj || 'New Chat'
    this.createdAt = new Date()
    this.messages = []
  
  }

  fromJson(obj) {
    this.title = obj.title
    this.createdAt = obj.createdAt
    this.messages = []
    for (let msg of obj.messages) {
      let message = new Message(msg.role, msg)
      message.createdAt = new Date(msg.createdAt)
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
  }

  lastMessage() {
    return this.messages[this.messages.length - 1]
  }

}
