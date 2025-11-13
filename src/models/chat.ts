
import { LlmModelOpts } from 'multi-llm-ts'
import { Chat as ChatBase } from 'types/index'
import { ToolSelection } from 'types/llm'
import Message from './message'

export const DEFAULT_TITLE = 'New Chat'

export default class Chat implements ChatBase {

  uuid: string
  title?: string
  createdAt: number
  lastModified: number
  engine?: string
  model?: string
  instructions?: string
  disableStreaming: boolean
  tools: ToolSelection
  modelOpts?: LlmModelOpts
  locale?: string
  docrepo?: string
  messages: Message[]
  temporary: boolean

  constructor(title?: string) {

    // default
    this.uuid = crypto.randomUUID()
    this.title = title
    this.createdAt = Date.now()
    this.lastModified = Date.now()
    this.disableStreaming = false
    this.tools = null
    this.messages = []
    this.temporary = false  
  }

  static fromJson(obj: any): Chat {
    const chat = new Chat()
    chat.uuid = obj.uuid || crypto.randomUUID()
    chat.title = obj.title
    chat.createdAt = obj.createdAt
    chat.lastModified = obj.lastModified || obj.createdAt
    chat.engine = obj.engine || undefined
    chat.model = obj.model || undefined
    chat.instructions = obj.instructions || obj.prompt || undefined
    chat.disableStreaming = obj.disableStreaming
    chat.tools = obj.disableTools === true ? [] : (obj.tools || null)
    chat.modelOpts = obj.modelOpts || undefined
    chat.locale = obj.locale || undefined
    chat.docrepo = obj.docrepo || undefined
    chat.messages = []
    for (const msg of obj.messages) {
      const message = Message.fromJson(msg)
      chat.messages.push(message)
    }
    return chat
  }

  patchFromJson(obj: any): boolean {

    // any diff spotted
    let patched = false
    if (this.title !== obj.title || this.lastModified !== obj.lastModified) {
      patched = true
    }

    // header
    this.title = obj.title
    this.lastModified = obj.lastModified
    this.instructions = obj.instructions
    this.disableStreaming = obj.disableStreaming
    this.tools = obj.disableTools === true ? [] : (obj.tools || null)
    this.modelOpts = obj.modelOpts
    this.locale = obj.locale
    this.docrepo = obj.docrepo

    // messages
    if (this.messages.length < obj.messages.length) {
      //console.log(`patching ${obj.messages.length - this.messages.length} messages`)
      const messages = obj.messages.slice(this.messages.length)
      for (const msg of messages) {
        const message = Message.fromJson(msg)
        this.messages.push(message)
        patched = true
      }
    }

    // done
    return patched
  }

  disableTools(): void {
    this.tools = []
  }

  enableAllTools(): void {
    this.tools = null
  }

  setEngineModel(engine: string, model: string): void {
    this.engine = engine
    this.model = model
  }

  subtitle(): string {
    if (this.messages.length > 2 && this.messages[2].type == 'text') {
      return this.messages[2].content.replace(/<[^>]*>/g, '')
    } else {
      return ''
    }
  }

  initTitle(): void {
    this.title = this.title || DEFAULT_TITLE
  }

  hasTitle(): boolean {
    return this.title && this.title !== DEFAULT_TITLE
  }

  hasMessages(): boolean {
    return this.messages.length > 1
  }

  addMessage(message: Message): void {
    this.messages.push(message)
    this.lastModified = Date.now()
  }

  lastMessage(): Message {
    if (this.messages.length === 0) {
      return null
    }
    return this.messages[this.messages.length - 1]
  }

  delete(): void {
    for (const message of this.messages) {
      message.delete()
    }
  }
  
  deleteMessagesStarting(message: Message): void {
    const index = this.messages.findIndex((msg) => msg.uuid === message.uuid)
    if (index !== -1) {
      for (let i = index; i < this.messages.length; i++) {
        this.messages[i].delete()
      }
      this.messages = this.messages.slice(0, index)
      this.lastModified = Date.now()
    }
  }

  fork(message: Message): Chat {
    const fork = Chat.fromJson(this)
    fork.uuid = crypto.randomUUID()
    fork.lastModified = Date.now()
    fork.messages = []
    for (const msg of this.messages) {
      fork.messages.push(Message.fromJson(msg))
      fork.lastMessage().uuid = crypto.randomUUID()
      if (msg.uuid === message.uuid) {
        break
      }
    }
    return fork
  }

}
