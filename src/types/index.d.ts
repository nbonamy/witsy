

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

export interface StoreListener {
  onStoreUpdated: (domain: string) => void
}

interface Store {
  commands: Command[]
  experts: Expert[]
  config: Configuration
  chats: Chat[]
  chatFilter: string|null
  pendingAttachment: Attachment|null
  pendingDocRepo: string|null
  listeners: StoreListener[]
  addListener?(listener: StoreListener): void
  notifyListeners?(domain: string): void
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

interface OnlineFileMetadata {
  id: string
  size: number
  createdTime: Date
  modifiedTime: Date
}

interface OnlineStorageProvider {
  initialize: () => Promise<void>
  metadata: (filepath: string) => Promise<OnlineFileMetadata>
  download: (filepath: string) => Promise<string>
  upload: (filepath: string, modifiedTime: Date) => Promise<boolean>
}

export type ComputerAction = {
  action: 'key' | 'type' | 'mouse_move' | 'left_click' | 'left_click_drag' | 'right_click' | 'middle_click' | 'double_click' | 'screenshot' | 'cursor_position'
  coordinate?: number[]
  text?: string
}

declare global {
  interface Window {
    api: {
      licensed?: boolean
      platform?: string
      userDataPath?: string
      on?: (signal: string, callback: (value: any) => void) => void
      setAppearanceTheme?(theme: string): void
      showDialog?(opts: any): Promise<Electron.MessageBoxReturnValue>
      listFonts?(): string[]
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
      update?: {
        isAvailable?(): boolean
        apply?(): void
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
        isPromptEditable?(id: string): boolean
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
      readaloud?: {
        getText?(id: string): string
        closePalette?(): void
      },
      whisper?: {
        initialize?(): void
        transcribe?(audioBlob: Blob): Promise<{ text: string }>
      },
      transcribe?: {
        insert?(text: string): void
        cancel?(): void
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
        isAvailable?(): boolean
        getStatus?(): any
        getTools?(): any
        callTool?(name: string, parameters: anyDict): any
      }
      scratchpad?: {
        open?(): void
      }
      computer?: {
        isAvailable?(): boolean
        getScaledScreenSize?(): Size
        getScreenNumber?(): number
        takeScreenshot?(): string
        executeAction?(action: ComputerAction): any
      }
    }
  }
}
