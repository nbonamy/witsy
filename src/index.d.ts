

declare module 'applescript'

type anyDict = {[key: string]: any}
type strDict = {[key: string]: string}

type LlmRole = 'system'|'user'|'assistant'

//
// model stuff
//
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
  pendingAttachment: string
  saveHistory?(): void
  saveSettings?(): void
  load?(): Promise<void>
  dump?(): void
}

//
// automation stuff
//

interface ShortcutCallbacks {
  chat: () => void
  command: () => void
}

interface Automator {
  moveCaretBelow(): Promise<void>
  copySelectedText(): Promise<void>
  pasteText(): Promise<void>
}

//
// llm stuff
//

interface LlmResponse {
  type: string
  content?: string
  original_prompt?: string
  revised_prompt?: string
  url?: string
}

type LlmStream = AsyncGenerator|Stream

interface LlmCompletionOpts {
  engine?: string
  model?: string
  save?: boolean
  attachment?: Attachment
  route?: boolean
  size?: '256x256' | '512x512' | '1024x1024' | '1792x1024' | '1024x1792' | null
  style?: 'vivid' | 'natural' | null
  maxTokens?: number
  n?: number
}

interface LLmCompletionPayload {
  role: llmRole
  content: sring|LlmContentPayload[]
  images?: string[]
}

interface LlmContentPayload {
  type: string
  text?: string
  // openai
  image_url?: {
    url: string
  }
  // anthropic
  source?: {
    type: string
    media_type: 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp'
    data: string
  }
}

interface LlmChunk {
  text: string
  done: boolean
}

//
// window stuff
//

import { BrowserWindowConstructorOptions } from 'electron'
interface CreateWindowOpts extends  BrowserWindowConstructorOptions {
  queryParams?: strDict,
  hash? : string,
}
