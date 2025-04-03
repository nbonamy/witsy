
import { LlmModelOpts } from 'multi-llm-ts'
import { type Chat as ChatBase } from '../types/index'
import Message from './message'

const DEFAULT_TITLE = 'New Chat'

export default class Chat implements ChatBase {

  uuid: string
  title: string|null
  createdAt: number
  lastModified: number
  engine: string|null
  model: string|null
  prompt: string|null
  disableStreaming: boolean = false
  disableTools: boolean = false
  modelOpts: LlmModelOpts|null = null
  locale: string|null
  docrepo: string|null
  messages: Message[]
  temporary: boolean

  constructor(title?: string) {

    // default
    this.uuid = crypto.randomUUID()
    this.title = title || null
    this.createdAt = Date.now()
    this.lastModified = Date.now()
    this.engine = null
    this.model = null
    this.prompt = null
    this.disableStreaming = false
    this.disableTools = false
    this.modelOpts = null
    this.locale = null
    this.docrepo = null
    this.messages = []
    this.temporary = false
  
  }

  static fromJson(obj: any): Chat {
    const chat = new Chat()
    chat.uuid = obj.uuid || crypto.randomUUID()
    chat.title = obj.title
    chat.createdAt = obj.createdAt
    chat.lastModified = obj.lastModified || obj.createdAt
    chat.engine = obj.engine || 'openai'
    chat.model = obj.model
    chat.prompt = obj.prompt
    chat.disableStreaming = obj.disableStreaming
    chat.disableTools = obj.disableTools
    chat.modelOpts = obj.modelOpts
    chat.locale = obj.locale
    chat.docrepo = obj.docrepo
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
    this.prompt = obj.prompt
    this.disableStreaming = obj.disableStreaming
    this.disableTools = obj.disableTools
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

  setEngineModel(engine: string, model: string): void {
    this.engine = engine
    this.model = model
  }

  subtitle(): string {
    if (this.messages.length > 2 && this.messages[2].type == 'text') {
      return this.messages[2].content
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
