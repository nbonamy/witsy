
import { ToolCall, MessageType, Message as IMessage } from '../types'
import { LlmRole, LlmChunkTool, LlmUsage, Message as MessageBase, LlmChunkContent } from 'multi-llm-ts'
import Attachment from './attachment'
import Expert from './expert'

export default class Message extends MessageBase implements IMessage {

  uuid: string
  engine: string
  model: string
  createdAt: number
  type: MessageType
  expert?: Expert
  agentId?: string
  deepResearch?: boolean
  toolCalls?: ToolCall[]
  usage?: LlmUsage
  transient: boolean
  uiOnly: boolean
  declare attachments: Attachment[]

  constructor(role: LlmRole, content?: string) {
    super(role, content)
    this.uuid = crypto.randomUUID()
    this.engine = null
    this.model = null
    this.createdAt = Date.now()
    this.type = 'text'
    this.expert = null
    this.agentId = null
    this.deepResearch = false
    this.toolCalls = []
    this.attachments = []
    this.usage = null
    this.uiOnly = false
    this.transient = (content == null)
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
    message.attachments = 
      obj.attachment ? [ Attachment.fromJson(obj.attachment) ] :
      (obj.attachments ? obj.attachments.map(Attachment.fromJson) : [])
    message.reasoning = obj.reasoning || null
    message.transient = false
    message.expert = obj.expert ? Expert.fromJson(obj.expert) : null
    message.agentId = obj.agentId || null
    message.deepResearch = obj.deepResearch || false
    message.toolCalls = obj.toolCalls || obj.toolCall?.calls?.map((tc: any, idx: number) => ({
      ...tc,
      id: (idx + 1).toString(),
      done: true,
      status: undefined
    })) || []
    message.usage = obj.usage || null
    message.uiOnly = obj.uiOnly || false
    return message
  }

  get contentForModel(): string {
    if (this.uiOnly) {
      return null
    } else {
      const content = this.content.replaceAll(/<tool id="([^"]+)"><\/tool>/g, '')
      return this.expert?.prompt ? `${this.expert.prompt}\n${content}` : content
    }
  }

  isVideo(): boolean {
    for (const attachment of this.attachments) {
      if (Message.isVideoUrl(attachment.url)) {
        return true
      }
    }
    return false
  }

  static isVideoUrl(url: string): boolean {
    return url && (url.endsWith('.mp4') || url.endsWith('.webm') || url.endsWith('.ogg'));
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

  appendText(chunk: LlmChunkContent) {
    super.appendText(chunk)
    if (chunk?.done) {
      this.transient = false
    }
  }

  addToolCall(toolCall: LlmChunkTool, addToContent: boolean = true): void {
    
    // find previous
    let call = this.toolCalls.find(c => c.id === toolCall.id)
    if (call && (call.done || call.name !== toolCall.name)) {
      // google does not have a unique id
      // so we use done to move to the next one
      call = null
    }

    // if found update else add
    if (call) {
      call.done = toolCall.done
      call.status = toolCall.status
      call.params = toolCall.call?.params || null
      call.result = toolCall.call?.result || null
    } else {
      this.toolCalls.push({
        id: toolCall.id,
        name: toolCall.name,
        status: toolCall.status,
        done: toolCall.done,
        params: toolCall.call?.params || null,
        result: toolCall.call?.result || null,
      })
      if (addToContent) {
        this.appendText({
          type: 'content',
          text: `<tool id="${toolCall.id}"></tool>`,
          done: false,
        })
      }
    }

  }

  clearToolCalls(): void {
    this.toolCalls = []
  }

  delete(): void {
    if (this.type === 'image' && typeof this.content === 'string') {
      window.api.file.delete(this.content)
    }
    for (const attachment of this.attachments) {
      if (attachment.saved) {
        window.api.file.delete(attachment.url)
      }
    }
  }

}
