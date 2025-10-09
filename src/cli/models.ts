// Lightweight CLI-specific models
// These avoid importing the full Chat/Message classes which pull in multi-llm-ts

export class MessageCli {
  uuid: string
  role: 'user' | 'assistant' | 'system'
  content: string
  reasoning?: string
  engine: string
  model: string
  createdAt: number

  constructor(role: 'user' | 'assistant' | 'system', content: string = '') {
    this.uuid = crypto.randomUUID()
    this.role = role
    this.content = content
    this.reasoning = undefined
    this.engine = ''
    this.model = ''
    this.createdAt = Date.now()
  }
}

export class ChatCli {
  uuid: string
  title?: string
  engine?: string
  model?: string
  messages: MessageCli[]
  createdAt: number
  lastModified: number

  constructor(title?: string) {
    this.uuid = ''
    this.title = title
    this.messages = []
    this.createdAt = Date.now()
    this.lastModified = Date.now()
  }

  addMessage(message: MessageCli): void {
    this.messages.push(message)
    this.lastModified = Date.now()
  }

  setEngineModel(engine: string, model: string): void {
    this.engine = engine
    this.model = model
  }
}
