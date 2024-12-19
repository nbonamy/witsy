
import { anyDict, LlmChunkTool, Message as IMessageBase, Attachment as IAttachmentBase } from 'multi-llm-ts'
import { Configuration } from './config.d'
import { ToolCallInfo } from '../models/message'

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
  lastMessage(): Message
  subtitle(): string
  delete(): void
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
  chats: Chat[]
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

export type OnlineFileMetadata = {
  id: string
  size: number
  createdTime: Date
  modifiedTime: Date
}

export interface OnlineStorageProvider {
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

export type FileSaveParams = {
  contents: string
  url?: string
  properties: anyDict
}

export type FileDownloadParams = {
  url: string
  properties: anyDict
}

declare global {
  interface Window {
    api: {
      licensed: boolean
      platform: string
      isMasBuild: boolean
      userDataPath: string
      on: (signal: string, callback: (value: any) => void) => void
      off: (signal: string, callback: (value: any) => void) => void
      setAppearanceTheme(theme: string): void
      showDialog(opts: any): Promise<Electron.MessageBoxReturnValue>
      listFonts(): string[]
      fullscreen(state: boolean): void
      runAtLogin: {
        get(): boolean
        set(state: boolean): void
      }
      store: {
        get(key: string, fallback: any): any
        set(key: string, value: any): void
      }
      base64: {
        encode(data: string): string
        decode(data: string): string
      }
      file: {
        read(filepath: string): FileContents
        readIcon(filepath: string): FileContents
        save(opts: FileSaveParams): string
        download(opts: FileDownloadParams): string
        pick(opts: anyDict): string|string[]|FileContents
        pickDir(): string
        delete(filepath: string): void
        find(name: string): string
        extractText(contents: string, format: string): string
        getAppInfo(filepath: string): ExternalApp
      }
      shortcuts: {
        register(): void
        unregister(): void
      }
      update: {
        isAvailable(): boolean
        apply(): void
      }
      config: {
        load(): Configuration
        save(config: Configuration): void
      }
      history: {
        load(): Chat[]
        save(chats: Chat[]): void
      }
      automation: {
        getText(id: string): string
        insert(text: string): void
        replace(text: string): void
      }
      chat: {
        open(chatId: string): void
      }
      commands: {
        load(): Command[]
        save(commands: Command[]): void
        cancel(): void
        closePicker(): void
        closeResult(): void
        resizeResult(deltaX: number, deltaY: number): void
        run(params: RunCommandParams): void
        isPromptEditable(id: string): boolean
        import(): boolean
        export(): boolean
      }
      anywhere: {
        prompt(): void
        insert(prompt: string): void
        close(): void
        resize(deltaX: number, deltaY: number): void
      }
      experts: {
        load(): Expert[]
        save(experts: Expert[]): void
        import(): boolean
        export(): boolean
      }
      docrepo: {
        list(): DocumentBase[]
        connect(baseId: string): void
        disconnect(): void
        isEmbeddingAvailable(engine: string, model: string): boolean
        create(title: string, embeddingEngine: string, embeddingModel: string): string
        rename(id: string, title: string): void
        delete(id: string): void
        addDocument(id: string, type: string, url: string): void
        removeDocument(id: string, docId: string): void
        query(id: string, text: string): Promise<DocRepoQueryResponseItem[]>
      },
      readaloud: {
        closePalette(): void
      },
      whisper: {
        initialize(): void
        transcribe(audioBlob: Blob): Promise<{ text: string }>
      },
      transcribe: {
        insert(text: string): void
        cancel(): void
      },
      clipboard: {
        writeText(text: string): void
        writeImage(path: string): void
      },
      markdown: {
        render(markdown: string): string
      }
      interpreter: {
        python(code: string): any
      }
      nestor: {
        isAvailable(): boolean
        getStatus(): any
        getTools(): any
        callTool(name: string, parameters: anyDict): any
      }
      scratchpad: {
        open(textId?: string): void
      }
      computer: {
        isAvailable(): boolean
        getScaledScreenSize(): Size
        getScreenNumber(): number
        takeScreenshot(): string
        executeAction(action: ComputerAction): any
      }
    }
  }
}
