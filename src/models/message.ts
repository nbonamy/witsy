
import { Message } from 'types/index.d'
import { LlmRole, LlmChunk } from 'types/llm.d'
import { v4 as uuidv4 } from 'uuid'
import Attachment from './attachment'

export default class implements Message {

  uuid: string
  createdAt: number
  role: LlmRole
  type: string // backwards compatibility: everything is text now
  content: string
  attachment: Attachment
  transient: boolean
  toolCall?: string

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
    this.toolCall = null
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
    this.attachment = obj.attachment ? new Attachment(obj.attachment) : null
    this.transient = false
    this.toolCall = null
  }

  setText(text: string|null) {
    this.type = 'text'
    this.content = text
    this.transient = (text == null)
  }

  setImage(url: string) {
    this.type = 'image'
    this.content = url
    this.transient = false
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

  setToolCall(toolCall: string|null) {
    this.toolCall = toolCall
  }

}
