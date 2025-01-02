
import { LlmChunkTool, Message as IMessageBase, Attachment as IAttachmentBase } from 'multi-llm-ts'
import { Configuration } from './config'

export type strDict = { [key: string]: string }
export type anyDict = { [key: string]: any }

export interface Attachment extends IAttachmentBase {
  url: string
  extracted: boolean
  saved: boolean
  extractText(): void
  loadContents(): void
  b64Contents(): string
}

export type ToolCallInfo = {
  status: string
  calls: {
    name: string
    params: any
    result: any
  }[]
}

export type MessageType = 'text' | 'image'

export interface Message extends IMessageBase {
  uuid: string
  type: MessageType
  createdAt: number
  expert?: Expert
  toolCall?: ToolCallInfo
  attachment: Attachment
  setText(text: string): void
  setImage(url: string): void
  setToolCall(toolCall: LlmChunkTool): void
}

export interface Chat {
  uuid: string
  title: string
  createdAt: number
  lastModified: number
  engine: string|null
  model: string|null
  messages: Message[]
  deleted: boolean
  disableTools: boolean
  docrepo: string|null
  fromJson(json: any): void
  patchFromJson(jsonChat: any): boolean
  setEngineModel(engine: string, model: string): void
  addMessage(message: Message): void
  fork(message: Message): Chat
  lastMessage(): Message
  subtitle(): string
  delete(): void
}

export type Folder = {
  id: string
  name: string
  chats: string[]
}

export type History = {
  folders: Folder[]
  chats: Chat[]
}

export type Command = {
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

export type Shortcut = {
  alt?: boolean
  ctrl?: boolean
  shift?: boolean
  meta?: boolean
  key: string
  [key: string]: boolean | string
}

export interface Store {
  commands: Command[]
  experts: Expert[]
  config: Configuration
  history: History
  rootFolder: Folder
  chatFilter: string|null
  saveHistory?(): void
  saveSettings?(): void
  load?(): Promise<void>
  loadSettings?(): Promise<void>
  loadCommands?(): Promise<void>
  loadExperts?(): Promise<void>
  loadHistory?(): Promise<void>
  mergeHistory?(chats: any[]): void
  dump?(): void
}

export type ExternalApp = {
  name: string
  identifier: string
  icon: string
}

export type Expert = {
  id: string,
  type: 'system' | 'user',
  name: string
  prompt: string
  state: 'enabled' | 'disabled' | 'deleted',
  triggerApps: ExternalApp[]
}

export type FileContents = {
  url: string
  mimeType: string
  contents: string
}

export type ComputerAction = {
  action: 'key' | 'type' | 'mouse_move' | 'left_click' | 'left_click_drag' | 'right_click' | 'middle_click' | 'double_click' | 'screenshot' | 'cursor_position'
  coordinate?: number[]
  text?: string
}

export type FileSaveParams = {
  contents: string
  url?: string
  properties: anyDict
}

export type FileDownloadParams = {
  url: string
  properties: anyDict
}

export type MemoryFact = {
  uuid: string
  content: string
}
