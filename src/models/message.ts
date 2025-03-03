
import { ToolCallInfo, MessageType, Message as IMessage } from 'types'
import { LlmRole, LlmChunkTool, LlmUsage, Message as MessageBase } from 'multi-llm-ts'
import Attachment from './attachment'
import Expert from './expert'

export default class Message extends MessageBase implements IMessage {

  uuid: string
  engine: string
  model: string
  createdAt: number
  type: MessageType
  expert?: Expert
  toolCall?: ToolCallInfo
  usage?: LlmUsage
  declare attachment: Attachment

  constructor(role: LlmRole, content?: string) {
    super(role, content)
    this.uuid = crypto.randomUUID()
    this.engine = null
    this.model = null
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
    message.type = obj.type || 'text'
    message.engine = obj.engine || null
    message.model = obj.model || null
    message.createdAt = obj.createdAt
    message.attachment = obj.attachment ? Attachment.fromJson(obj.attachment) : null
    message.reasoning = obj.reasoning || null
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

  setExpert(expert: Expert, fallbackPrompt: string): void {
    if (!expert) return
    this.expert = JSON.parse(JSON.stringify(expert))
    this.expert.prompt = this.expert.prompt || fallbackPrompt
  }

  setText(text: string): void {
    this.content = text || ''
    this.transient = (text == null)
  }

  setImage(url: string): void {
    this.type = 'image'
    this.content = url
    this.transient = false
  }

  setToolCall(toolCall: LlmChunkTool): void {
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
