
import { Attachment } from '../index.d'
import { v4 as uuidv4 } from 'uuid'

export default class Message {

  uuid: string
  createdAt: number
  role: string
  type: string
  content: string
  attachment: Attachment
  transient: boolean

  constructor(role: string, obj?: any) {

    // json
    if (typeof obj === 'object') {
      this.fromJson(obj)
      return
    }

    // default
    this.uuid = uuidv4()
    this.createdAt = Date.now()
    this.role = role
    this.attachment = null
    this.type = 'unknown'
    this.transient = false
    if (typeof obj === 'string') {
      this.setText(obj)
    }
  }

  fromJson(obj: any) {
    this.uuid = obj.uuid || uuidv4()
    this.createdAt = obj.createdAt
    this.role = obj.role
    this.type = obj.type
    this.content = obj.content
    this.attachment = obj.attachment
    this.transient = false
  }

  setText(text: string|null) {
    this.type = 'text'
    this.content = text
    this.transient = (text == null)
  }

  setImage(url: string) {
    this.type = 'image'
    this.content = url
  }

  appendText(chunk: string, done = false) {
    if (this.type === 'text' && chunk) {
      if (!this.content) this.content = ''
      this.content = this.content + chunk
    }
    if (done) {
      this.transient = false
    }
  }

  attachFile(file: Attachment) {
    this.attachment = file
  }

}
