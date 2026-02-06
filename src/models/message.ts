
import { LlmChunkContent, LlmChunkTool, LlmRole, LlmUsage, Message as MessageBase } from 'multi-llm-ts'
import { Message as IMessage, MessageExecutionMode, MessageType, ToolCall } from 'types'
import { A2APromptOpts } from 'types/agents'
import Attachment from './attachment'
import Expert from './expert'

export default class Message extends MessageBase implements IMessage {

  uuid: string
  type: MessageType
  uiOnly: boolean
  execMode: MessageExecutionMode
  createdAt: number
  engine: string
  model: string
  expert?: Expert
  agentId?: string
  agentRunId?: string
  a2aContext?: A2APromptOpts
  transient: boolean
  status?: string
  usage?: LlmUsage
  edited: boolean

  declare toolCalls: ToolCall[]
  declare attachments: Attachment[]

  constructor(role: LlmRole, content?: string) {
    super(role, content)
    this.uuid = crypto.randomUUID()
    this.engine = null
    this.model = null
    this.createdAt = Date.now()
    this.type = 'text'
    this.uiOnly = false
    this.execMode = 'prompt'
    this.toolCalls = []
    this.attachments = []
    this.transient = (content == null)
    this.edited = false
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
    message.uiOnly = obj.uiOnly || false
    message.engine = obj.engine || null
    message.model = obj.model || null
    message.execMode = obj.execMode || (obj.deepResearch ? 'deepresearch' : (obj.agentId ? 'agent' : 'prompt'))
    message.createdAt = obj.createdAt
    message.attachments =
      obj.attachment ? [ Attachment.fromJson(obj.attachment) ] :
      (obj.attachments ? obj.attachments.map(Attachment.fromJson) : [])
    message.reasoning = obj.reasoning || null
    message.thoughtSignature = obj.thoughtSignature || undefined
    message.reasoningDetails = obj.reasoningDetails || undefined
    message.transient = false
    message.expert = obj.expert ? Expert.fromJson(obj.expert) : undefined
    message.agentId = obj.agentId || undefined
    message.agentRunId = obj.agentRunId || undefined
    message.a2aContext = obj.a2aContext || undefined
    message.usage = obj.usage || undefined
    message.edited = obj.edited || false

    // tool calls had different formats

    if (obj.toolCalls && Array.isArray(obj.toolCalls)) {
      
      message.toolCalls = obj.toolCalls?.map((tc: any): ToolCall => {
        const toolCall: ToolCall = {
          ...tc,
          id: tc.id || tc.tool_call_id,
          function: tc.function || tc.name,
          args: tc.args || tc.params,
        }
        delete (toolCall as any).name
        delete (toolCall as any).params
        delete (toolCall as any).tool_call_id
        return toolCall
      })
    
    } else if (obj.toolCall && Array.isArray(obj.toolCall.calls)) {
      
      message.toolCalls = obj.toolCall?.calls?.map((tc: any, idx: number): ToolCall => {
        const toolCall: ToolCall = {
          ...tc,
          id: (idx + 1).toString(),
          function: tc.function || tc.name,
          args: tc.args || tc.params,
          done: true,
          status: undefined,
        }
        delete (toolCall as any).name
        delete (toolCall as any).params
        delete (toolCall as any).tool_call_id
        return toolCall
      })
    
    } else {
      message.toolCalls = []
    }
    
    // done
    return message
  
  }

  get contentForModel(): string {
    if (this.uiOnly) {
      return null
    } else {
      const content = this.content.replaceAll(/<tool id="([^"]+)"><\/tool>/g, '')
      if (this.expert?.prompt) {
        if (this.expert.prompt.includes('$ARGUMENTS')) {
          return this.expert.prompt.replaceAll('$ARGUMENTS', content)
        }
        return `${this.expert.prompt}\n${content}`
      }
      return content
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

  setStatus(status: string|null): void {
    this.status = status
  }

  setExpert(expert: Expert): void {
    if (!expert) {
      this.expert = undefined
      return
    }
    this.expert = JSON.parse(JSON.stringify(expert))
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
    if (chunk.thoughtSignature) {
      this.thoughtSignature = chunk.thoughtSignature
    }
    if (chunk?.done) {
      this.transient = false
    }
  }

  addToolCall(toolCall: LlmChunkTool, addToContent: boolean = true): void {
    
    // find previous
    let call = this.toolCalls.find(c => c.id === toolCall.id)
    if (call && (call.done || call.function !== toolCall.name)) {
      // google does not have a unique id
      // so we use done to move to the next one
      call = null
    }

    // if found update else add
    if (call) {
      call.state = toolCall.state
      call.done = toolCall.done
      call.status = toolCall.status
      call.args = toolCall.call?.params || null
      call.result = toolCall.call?.result || null
    } else {
      this.toolCalls.push({
        id: toolCall.id,
        function: toolCall.name,
        state: toolCall.state,
        status: toolCall.status,
        done: toolCall.done,
        args: toolCall.call?.params || null,
        result: toolCall.call?.result || null,
        thoughtSignature: toolCall.thoughtSignature || null,
      })
      if (addToContent) {
        this.appendText({
          type: 'content',
          text: `<tool id="${toolCall.id}"></tool>`,
          done: false,
        })
      }
    }

    // reasoning details
    if (toolCall.reasoningDetails) {
      const reasoningDetails = Array.isArray(toolCall.reasoningDetails) ? toolCall.reasoningDetails : [toolCall.reasoningDetails]
      if (Array.isArray(this.reasoningDetails)) {
        this.reasoningDetails = this.reasoningDetails.concat(reasoningDetails)
      } else {
        this.reasoningDetails = reasoningDetails
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

  updateContent(newContent: string): void {
    this.content = newContent
    this.edited = true
  }

}
