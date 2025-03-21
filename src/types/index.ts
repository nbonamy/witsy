
import { LlmModelOpts, LlmChunkTool, Message as IMessageBase, Attachment as IAttachmentBase, LlmTool, Model, LlmChunk } from 'multi-llm-ts'
import { Configuration } from './config'
import { Size } from 'electron'
import { Application, RunCommandParams } from './automation'
import { DocRepoQueryResponseItem, DocumentBase } from './rag'
import { LocalSearchResult } from '../main/search'
import { McpServer, McpStatus } from './mcp'

export type strDict = Record<string, string>
export type anyDict = Record<string, any>

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
  engine: string
  model: string
  type: MessageType
  createdAt: number
  expert?: Expert
  toolCall?: ToolCallInfo
  attachment: Attachment
  transient: boolean
  uiOnly: boolean
  setExpert(expert: Expert, fallbackPrompt: string): void
  setText(text: string): void
  setImage(url: string): void
  setToolCall(toolCall: LlmChunkTool): void
  isVideo(): boolean
}

export interface Chat {
  uuid: string
  title: string|null
  createdAt: number
  lastModified: number
  engine: string|null
  model: string|null
  prompt: string|null
  messages: Message[]
  temporary: boolean
  disableTools: boolean
  disableStreaming: boolean
  locale: string|null
  docrepo: string|null
  modelOpts: LlmModelOpts|null
  patchFromJson(jsonChat: any): boolean
  setEngineModel(engine: string, model: string): void
  initTitle(): void
  hasTitle(): boolean
  hasMessages(): boolean
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
  quickPrompts: string[]
  //padPrompts: string[]
}

export type Command = {
  id: string,
  type: 'system' | 'user',
  icon: string,
  label?: string,
  action: 'chat_window' | 'paste_below' | 'paste_in_place' | 'clipboard_copy',
  template?: string,
  shortcut: string,
  state: 'enabled' | 'disabled' | 'deleted',
  engine: string,
  model: string,
}

export const disabledShortcutKey: string = 'none'

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
  load?(): void
  loadSettings?(): void
  loadCommands?(): void
  loadExperts?(): void
  loadHistory?(): void
  initChatWithDefaults(chat: Chat): void
  addChat?(chat: Chat, folderId?: string): void
  removeChat?(chat: Chat): void
  addQuickPrompt?(prompt: string): void
  //addPadPrompt?(prompt: string): void
  mergeHistory?(chats: any[]): void
  dump?(): void
}

export type ExternalApp = {
  name: string
  identifier: string
  icon: FileContents
}

export type Expert = {
  id: string,
  type: 'system' | 'user',
  name?: string
  prompt?: string
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

export type MediaCreationEngine = {
  id: string
  name: string
}

export type MediaReference = {
  mimeType: string
  contents: string
}

export interface MediaCreator {
  getEngines(checkApiKey: boolean): MediaCreationEngine[]
  getModels(engine: string): Model[]
  execute(engine: string, model: string, parameters: anyDict, reference?: MediaReference): Promise<any>
}

export type DesignStudioMediaType = 'image' | 'video'

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
      fullscreen(window: string, state: boolean): void
      debug: {
        showConsole(): void
        getNetworkHistory(): NetworkRequest[]
        clearNetworkHistory(): void
      }
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
        localeUI(): string
        localeLLM(): string
        getI18nMessages(): anyDict
        load(): Configuration
        save(config: Configuration): void
      }
      history: {
        load(): History
        save(history: History): void
      }
      automation: {
        getText(id: string): string
        insert(text: string, sourceApp: Application): void
        replace(text: string, sourceApp: Application): void
      }
      chat: {
        open(chatId: string): void
      }
      commands: {
        load(): Command[]
        save(commands: Command[]): void
        cancel(): void
        closePicker(sourceApp: Application): void
        run(params: RunCommandParams): void
        isPromptEditable(id: string): boolean
        import(): boolean
        export(): boolean
      }
      anywhere: {
        prompt(): void
        insert(prompt: string): void
        close(sourceApp: Application): void
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
        closePalette(sourceApp: Application): void
      },
      whisper: {
        initialize(): void
        transcribe(audioBlob: Blob): Promise<{ text: string }>
      },
      transcribe: {
        start(): void
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
      mcp: {
        isAvailable(): boolean
        getServers(): McpServer[]
        editServer(server: McpServer): Promise<boolean>
        deleteServer(uuid: string): Promise<boolean>
        getInstallCommand(registry: string, server: string): string
        installServer(registry: string, server: string): Promise<boolean>
        reload(): Promise<void>
        getStatus(): McpStatus
        getTools(): Promise<LlmTool[]>
        callTool(name: string, parameters: anyDict): any
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
        start(): void
        stop(): void
        close(): void
        updateStatus(chunk: LlmChunk): void
      }
      memory: {
        reset(): void
        isNotEmpty(): boolean
        facts(): MemoryFact[]
        store(contents: string[]): boolean
        retrieve(query: string): string[]
        delete(uuid: string): void
      }
      search: {
        query(query: string, num: number): Promise<LocalSearchResult[]>
      }
      studio: {
        start(): void
      }
      voiceMode: {
        start(): void
      }
    }
  }
}

export type NetworkRequest = {
  id: string
  url: string
  method: string
  headers: Record<string, string>
  postData: string
  statusCode?: number
  statusText?: string
  responseHeaders?: Record<string, string>
  mimeType?: string
  responseBody?: string
}
