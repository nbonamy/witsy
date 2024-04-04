
import { v4 as uuidv4 } from 'uuid'

export default class Message {

  constructor(role, obj) {

    // json
    if (typeof role === 'object') {
      this.fromJson(role)
      return
    }

    // default
    this.uuid = uuidv4()
    this.createdAt = new Date()
    this.role = role
    this.attachment = null
    this.type = 'unknown'
    if (typeof obj === 'string') {
      this.setText(obj)
    }
  }

  fromJson(obj) {
    this.uuid = obj.uuid || uuidv4()
    this.createdAt = obj.createdAt
    this.role = obj.role
    this.type = obj.type
    this.content = obj.content
    this.attachment = obj.attachment
  }

  setText(text) {
    this.type = 'text'
    this.content = text
  }

  setImage(url) {
    this.type = 'image'
    this.content = url
  }

  appendText(chunk) {
    if (this.type === 'text') {
      if (!this.content) this.content = ''
      this.content = this.content + chunk
    }
  }

  attachFile(file) {
    this.attachment = file
  }

}
