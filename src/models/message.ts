
import { Message, Attachment, LlmRole, LlmChunk } from '../index.d'
import { v4 as uuidv4 } from 'uuid'

export default class implements Message {

  uuid: string
  createdAt: number
  role: LlmRole
  type: string
  content: string
  attachment: Attachment
  transient: boolean

  constructor(role: LlmRole, obj?: any) {

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

  appendText(chunk: LlmChunk) {
    if (this.type === 'text' && chunk?.text) {
      if (!this.content) this.content = ''
      this.content = this.content + chunk.text
    }
    if (chunk?.done) {
      this.transient = false
    }
  }

  attachFile(file: Attachment) {
    this.attachment = file
  }

}
