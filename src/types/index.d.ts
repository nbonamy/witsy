

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

declare global {
  interface Window {
    api: {
      platform?: string
      userDataPath?: string
      fullscreen?(state: boolean): void
      runAtLogin?: {
        get(): boolean
        set(state: boolean): void
      }
      base64?: {
        encode(data: string): string
        decode(data: string): string
      }
      file?: {
        read?(filepath: string): boolean
        save?(opts: {
          contents: string,
          properties: anyDict
        }): string
        download?(opts: {
          url: string,
          properties: anyDict
        }): string
        pick?(opts: anyDict): anyDict
        delete?(filepath: string): void
        find?(name: string): string
      }
      shortcuts?: {
        register(): void
        unregister(): void
      }
      ipcRenderer?: {
        send?(event: string, payload: any): void
        sendSync?(event: string, payload: any): any
      }
      config?: {
        load(): Configuration
        save(config: Configuration): void
      }
      history?: {
        size(): number
        load(): Chat[]
        save(chats: Chat[]): void
      }
      commands?: {
        load(): Command[]
        save(commands: Command[]): void
        closePalette(): void
        run(command: Command): void
      }
      clipboard?: {
        writeText(text: string): void
        writeImage(path: string): void
      },
      markdown?: {
        render(markdown: string): string
      }
      interpreter?: {
        python(code: string): any
      }
    }
  }
}
