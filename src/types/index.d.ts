

export type anyDict = {[key: string]: any}
export type strDict = {[key: string]: string}

interface Chat {
  uuid: string
  title: string
  createdAt: number
  lastModified: number
  engine: string
  model: string
  messages: Message[]
  patchFromJson(jsonChat: any): boolean
}

interface Message {
  uuid: string
  createdAt: number
  role: llmRole
  type: string
  content: string
  attachment: Attachment
  transient: boolean
}

interface Attachment {
  type: string
  url: string
  format: string
  contents: string
  downloaded: boolean
}

interface Command {
  id: string,
  type: 'system' | 'user',
  icon: string,
  label: string,
  action: 'chat_window' | 'paste_below' | 'paste_in_place' | 'clipboard_copy',
  template: string,
  shortcut: string,
  state: 'enabled' | 'disabled' | 'deleted',
  engine: string,
  model: string,
}

interface Shortcut {
  alt?: boolean
  ctrl?: boolean
  shift?: boolean
  meta?: boolean
  key: string
}

interface Store {
  userDataPath: string
  commands: Command[]
  config: Configuration
  chats: Chat[]
  pendingAttachment: any
  saveHistory?(): void
  saveSettings?(): void
  load?(): Promise<void>
  dump?(): void
}
