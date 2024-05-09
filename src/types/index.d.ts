

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
  commands: Command[]
  prompts: Prompt[]
  config: Configuration
  chats: Chat[]
  chatFilter: string|null
  pendingAttachment: Attachment|null
  saveHistory?(): void
  saveSettings?(): void
  load?(): Promise<void>
  loadCommands?(): Promise<void>
  dump?(): void
}

interface Prompt {
  actor: string
  prompt: string
}

interface File {
  url: string
  contents: string
}

declare global {
  interface Window {
    api: {
      licensed?: boolean
      platform?: string
      userDataPath?: string
      on?: (signal: string, callback: (value: any) => void) => void
      fullscreen?(state: boolean): void
      runAtLogin?: {
        get?(): boolean
        set?(state: boolean): void
      }
      store?: {
        get?(key: string, fallback: any): any
        set?(key: string, value: any): void
      }
      base64?: {
        encode?(data: string): string
        decode?(data: string): string
      }
      file?: {
        read?(filepath: string): File
        save?(opts: {
          contents: string,
          properties: anyDict
        }): string
        download?(opts: {
          url: string,
          properties: anyDict
        }): string
        pick?(opts: anyDict): File
        delete?(filepath: string): void
        find?(name: string): string
      }
      shortcuts?: {
        register?(): void
        unregister?(): void
      }
      ipcRenderer?: {
        send?(event: string, payload: any): void
        sendSync?(event: string, payload: any): any
      }
      config?: {
        load?(): Configuration
        save?(config: Configuration): void
      }
      history?: {
        load?(): Chat[]
        save?(chats: Chat[]): void
      }
      commands?: {
        load?(): Command[]
        save?(commands: Command[]): void
        closePalette?(): void
        run?(command: Command): void
        getPrompt?(id: string): string
      }
      prompts?: {
        load?(): Prompt[]
        save?(prompts: Prompt[]): void
      }
      clipboard?: {
        writeText?(text: string): void
        writeImage?(path: string): void
      },
      pdf?: {
        getText?(contents: string): string
      }
      markdown?: {
        render?(markdown: string): string
      }
      interpreter?: {
        python?(code: string): any
      }
    }
  }
}
