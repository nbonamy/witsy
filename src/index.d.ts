

import Chat from './models/chat'

declare module 'applescript'

type anyDict = {[key: string]: any}
type strDict = {[key: string]: string}

import { BrowserWindowConstructorOptions } from 'electron'

interface Configuration {
  general: GeneralConfig
  llm: LLMConfig
  instructions: InstructionsConfig
  appearance: AppearanceConfig
  shortcuts: ShortcutsConfig
  engines: {[key:string]: EngineConfig}
  getActiveModel: () => string
}

interface GeneralConfig {
  keepRunning: boolean
  language: string
}

interface LLMConfig {
  engine: string
  autoVisionSwitch: boolean
  conversationLength: number
}

interface InstructionsConfig {
  default: string
  routing: string
  titling: string
}

interface AppearanceConfig {
  chat: ChatAppearance
}

interface ChatAppearance {
  theme: string
  fontSize: number
}

interface ShortcutsConfig {
  chat: Shortcut
  command: Shortcut
}

interface EngineConfig {
  apiKey?: string
  models: ModelsConfig
  model: ModelConfig
  tts?: TTSConfig
}

interface Model {
  id: string
  name: string
  meta: any
}

interface ModelsConfig {
  chat: Model[]
  image?: Model[]
}

interface ModelConfig {
  chat: string
  image: string
}

interface TTSConfig {
  model: string
  voice: string
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

interface Automator {
  moveCaretBelow(): Promise<void>
  copySelectedText(): Promise<void>
  pasteText(): Promise<void>
}

interface CreateWindowOpts extends  BrowserWindowConstructorOptions {
  queryParams?: strDict,
  hash? : string,
}

interface Shortcut {
  alt?: boolean
  ctrl?: boolean
  shift?: boolean
  meta?: boolean
  key: string
}

interface ShortcutCallbacks {
  chat: () => void
  command: () => void
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

interface LlmResponse {
  type: string
  content?: string
  original_prompt?: string
  revised_prompt?: string
  url?: string
}

type LlmStream = AsyncGenerator|Stream

interface Attachment {
  type: string
  url: string
  contents: string
  downloaded: boolean
}

interface LlmCompletionOpts {
  engine?: string
  model?: string
  save?: boolean
  attachment?: Attachment
  route?: boolean
}

interface LLmCompletionPayload {
  content: any
  images?: string[]
}
