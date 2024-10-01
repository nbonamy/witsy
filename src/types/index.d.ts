

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
  deleted: boolean
  fromJson(json: any): void
  patchFromJson(jsonChat: any): boolean
  setEngineModel(engine: string, model: string): void
  addMessage(message: Message): void
  lastMessage(): Message
  subtitle(): string
  delete(): void
}

interface Message {
  uuid: string
  createdAt: number
  role: llmRole
  type: string
  content: string
  attachment: Attachment
  transient: boolean
  fromJson(json: any): void
  setText(text: string|null): void
  setImage(url: string): void
  appendText(chunk: LlmChunk): void
  attachFile(file: Attachment): void
  setToolCall(toolCall: string|null): void
}

interface Attachment {
  url: string
  mimeType: string
  contents: string
  downloaded: boolean
  fromJson(json: any): void
  format(): string
  isText(): boolean
  isImage(): boolean
  extractText(): void
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
  experts: Expert[]
  config: Configuration
  chats: Chat[]
  chatFilter: string|null
  pendingAttachment: Attachment|null
  pendingDocRepo: string|null
  saveHistory?(): void
  saveSettings?(): void
  load?(): Promise<void>
  loadSettings?(): Promise<void>
  loadCommands?(): Promise<void>
  loadExperts?(): Promise<void>
  mergeHistory?(chats: any[]): void
  dump?(): void
}

interface ExternalApp {
  name: string
  identifier: string
  icon: string
}

interface Expert {
  id: string,
  type: 'system' | 'user',
  name: string
  prompt: string
  state: 'enabled' | 'disabled' | 'deleted',
  triggerApps: ExternalApp[]
}

interface FileContents {
  url: string
  mimeType: string
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
        read?(filepath: string): FileContents
        readIcon?(filepath: string): FileContents
        save?(opts: {
          contents: string,
          properties: anyDict
        }): string
        download?(opts: {
          url: string,
          properties: anyDict
        }): string
        pick?(opts: anyDict): string|strDict|string[]
        pickDir?(): string
        delete?(filepath: string): void
        find?(name: string): string
        extractText?(contents: string, format: string): string
        getAppInfo?(filepath: string): ExternalApp
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
        cancel?(): void
        closePalette?(): void
        run?(command: Command): void
        getPrompt?(id: string): string
      }
      anywhere?: {
        prompt?(text: string): void
        resize?(width: number, height: number): void
        showExperts?(): void
        closeExperts?(): void
        toggleExperts?(): void
        isExpertsOpen?(): boolean
        onExpert?(prompt: string): void
        cancel?(): void
      }
      experts?: {
        load?(): Expert[]
        save?(experts: Expert[]): void
      }
      docrepo?: {
        list?(): DocumentBase[]
        connect?(baseId: string): void
        disconnect?(): void
        create?(title: string, embeddingEngine: string, embeddingModel: string): string
        rename?(id: string, title: string): void
        delete?(id: string): void
        addDocument?(id: string, type: string, url: string): void
        removeDocument?(id: string, docId: string): void
        query?(id: string, text: string): Promise<DocRepoQueryResponseItem[]>
        isEmbeddingAvailable?(engine: string, model: string): boolean
      },
        clipboard?: {
        writeText?(text: string): void
        writeImage?(path: string): void
      },
      markdown?: {
        render?(markdown: string): string
      }
      interpreter?: {
        python?(code: string): any
      }
      nestor?: {
        getStatus?(): any
        getTools?(): any
        callTool?(name: string, parameters: anyDict): any
      }
    }
  }
}
