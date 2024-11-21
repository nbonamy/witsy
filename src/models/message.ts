
import { ToolCallInfo } from 'types'
import { LlmRole, LlmChunkTool, Message as MessageBase, LlmUsage } from 'multi-llm-ts'
import Attachment from './attachment'
import Expert from './expert'

export default class Message extends MessageBase {

  uuid: string
  createdAt: number
  type: string
  expert: Expert|null
  toolCall?: ToolCallInfo
  usage?: LlmUsage
  declare attachment: Attachment

  constructor(role: LlmRole, content?: string) {
    super(role, content)
    this.uuid = crypto.randomUUID()
    this.createdAt = Date.now()
    this.type = 'text'
    this.expert = null
    this.toolCall = null
    this.attachment = null
    this.usage = null
    if (content === undefined) {
      this.setText(null)
    } else if (typeof content === 'string') {
      this.setText(content)
    }
  }

  static fromJson(obj: any): Message {
    const message = new Message(obj.role, obj.content)
    message.uuid = obj.uuid || crypto.randomUUID()
    message.createdAt = obj.createdAt
    message.attachment = obj.attachment ? Attachment.fromJson(obj.attachment) : null
    message.transient = false
    message.expert = obj.expert ? Expert.fromJson(obj.expert) : null
    message.toolCall = obj.toolCall || null
    message.usage = obj.usage || null
    return message
  }

  get contentForModel(): string {
    if (this.expert == null) {
      return this.content
    } else {
      return `${this.expert.prompt}\n${this.content}`
    }
  }

  setText(text: string) {
    this.content = text || ''
    this.transient = (text == null)
  }

  setImage(url: string) {
    this.type = 'image'
    this.content = url
    this.transient = false
  }

  setToolCall(toolCall: LlmChunkTool) {
    if (this.toolCall == null) {
      this.toolCall = {
        status: null,
        calls: []
      }
    }
    if (toolCall.done) {
      this.toolCall.status = null
      if (toolCall.call) {
        this.toolCall.calls.push({
          name: toolCall.name,
          params: toolCall.call.params,
          result: toolCall.call.result
        })
      }
    } else {
      this.toolCall.status = toolCall.status
    }
  }

}
