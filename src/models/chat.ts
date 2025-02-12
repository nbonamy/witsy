
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
  disableStreaming: boolean = false
  disableTools: boolean = false
  modelOpts: LlmModelOpts|null = null
  docrepo: string|null
  messages: Message[]
  temporary: boolean

  constructor(obj?: any) {

    // json
    if (typeof obj === 'object') {
      this.fromJson(obj)
      return
    }

    // default
    this.uuid = crypto.randomUUID()
    this.title = obj || null
    this.createdAt = Date.now()
    this.lastModified = Date.now()
    this.engine = null
    this.model = null
    this.disableTools = false
    this.modelOpts = null
    this.docrepo = null
    this.messages = []
    this.temporary = false
  
  }

  fromJson(obj: any) {
    this.uuid = obj.uuid || crypto.randomUUID()
    this.title = obj.title
    this.createdAt = obj.createdAt
    this.lastModified = obj.lastModified || obj.createdAt
    this.engine = obj.engine || 'openai'
    this.model = obj.model
    this.disableTools = obj.disableTools
    this.modelOpts = obj.modelOpts
    this.docrepo = obj.docrepo
    this.messages = []
    for (const msg of obj.messages) {
      const message = Message.fromJson(msg)
      this.messages.push(message)
    }
  }

  patchFromJson(obj: any) {

    // any diff spotted
    let patched = false
    if (this.title !== obj.title || this.lastModified !== obj.lastModified) {
      patched = true
    }

    // header
    this.title = obj.title
    this.lastModified = obj.lastModified
    this.disableTools = obj.disableTools
    this.modelOpts = obj.modelOpts
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

  setEngineModel(engine: string, model: string) {
    this.engine = engine
    this.model = model
  }

  subtitle() {
    if (this.messages.length > 2 && this.messages[2].type == 'text') {
      return this.messages[2].content
    } else {
      return ''
    }
  }

  initTitle() {
    this.title = this.title || DEFAULT_TITLE
  }

  hasTitle() {
    return this.title && this.title !== DEFAULT_TITLE
  }

  hasMessages() {
    return this.messages.length > 1
  }

  addMessage(message: Message) {
    this.messages.push(message)
    this.lastModified = Date.now()
  }

  lastMessage(): Message {
    return this.messages[this.messages.length - 1]
  }

  delete(): void {
    for (const message of this.messages) {
      if (message.type === 'image' && typeof message.content === 'string') {
        window.api.file.delete(message.content)
      }
      if (message.attachment?.saved) {
        window.api.file.delete(message.attachment.url)
      }
    }
  }

  fork(message: Message): Chat {
    const fork = new Chat(this)
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
