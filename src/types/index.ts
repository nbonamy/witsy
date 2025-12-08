
import { Size } from 'electron'
import { Attachment as IAttachmentBase, Message as IMessageBase, LlmChunk, LlmChunkTool, LlmModelOpts, LlmTool, LlmToolCall, LlmUsage } from 'multi-llm-ts'
import { Application, RunCommandParams } from './automation'
import { Configuration } from './config'
import { FileContents, FileDownloadParams, FilePickParams, FileSaveParams } from './file'
import { ListDirectoryResponse } from './filesystem'
import { ToolSelection } from './llm'
import { McpInstallStatus, McpServer, McpServerWithTools, McpStatus, McpTool } from './mcp'
import { DocRepoQueryResponseItem, DocumentBase, DocumentQueueItem, SourceType } from './rag'
import { Workspace, WorkspaceHeader } from './workspace'
import { A2APromptOpts, Agent, AgentRun } from './agents'

export type strDict = Record<string, string>
export type anyDict = Record<string, any>

export type MainWindowMode = 'none' | 'chat' | 'studio' | 'scratchpad' | 'dictation' | 'agents' | 'voice-mode' | 'docrepos' | 'mcp' | 'settings' | `webapp-${string}`

export type ScratchpadHeader = {
  uuid: string
  title: string
  lastModified: number
}

export type ScratchpadData = {
  uuid: string
  title: string
  contents: any
  chat: any
  createdAt: number
  lastModified: number
}

export interface Attachment extends IAttachmentBase {
  url: string
  extracted: boolean
  saved: boolean
  filepath: string
  get filename(): string
  get filenameShort(): string
  extractText(): void
  loadContents(): void
  b64Contents(): string
}

export type ToolCall = LlmToolCall & {
  state?: 'preparing' | 'running' | 'completed' | 'canceled' | 'error'
  status?: string
  done: boolean
  result: any
}

export type ToolCallInfo = {
  calls: ToolCall[]
}

export type MessageType = 'text' | 'image'

export type MessageExecutionMode = 'prompt' | 'deepresearch' | 'agent'

export interface Message extends IMessageBase {
  uuid: string
  type: MessageType
  uiOnly: boolean
  execMode: MessageExecutionMode
  createdAt: number
  engine: string
  model: string
  expert?: Expert
  agentId?: string
  agentRunId?: string
  a2aContext?: A2APromptOpts
  transient: boolean
  status?: string
  toolCalls: ToolCall[]
  usage?: LlmUsage
  edited: boolean
  attachments: Attachment[]
  setStatus(status: string|null): void
  setExpert(expert: Expert): void
  setText(text: string): void
  setImage(url: string): void
  addToolCall(toolCall: LlmChunkTool): void
  clearToolCalls(): void
  isVideo(): boolean
  delete(): void
  updateContent(newContent: string): void
}

export type CustomInstruction = {
  id: string
  label: string
  instructions: string
}

export interface Chat {
  uuid: string
  title?: string
  createdAt: number
  lastModified: number
  engine?: string
  model?: string
  instructions?: string
  disableStreaming: boolean
  tools: ToolSelection
  locale?: string
  docrepo?: string
  modelOpts?: LlmModelOpts
  messages: Message[]
  temporary: boolean
  patchFromJson(jsonChat: any): boolean
  disableTools(): void
  enableAllTools(): void
  setEngineModel(engine: string, model: string): void
  initTitle(): void
  hasTitle(): boolean
  hasMessages(): boolean
  addMessage(message: Message): void
  deleteMessagesStarting(message: Message): void
  fork(message: Message): Chat
  lastMessage(): Message
  subtitle(): string
  delete(): void
}

export type Folder = {
  id: string
  name: string
  chats: string[]
  defaults?: {
    engine: string
    model: string
    disableStreaming: boolean
    tools: ToolSelection
    instructions?: string
    locale?: string
    docrepo?: string
    expert?: string
    modelOpts?: LlmModelOpts
  }
}

export type History = {
  version: number
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

export type ChatState = {
  filter: string|null
}

export type TranscribeState = {
  transcription: string
}

export type StoreEvent = 'workspaceSwitched'

export interface Store {

  workspace: Workspace

  commands: Command[]
  experts: Expert[]
  expertCategories: ExpertCategory[]
  agents: Agent[]
  config: Configuration
  history: History
  rootFolder: Folder

  chatState: ChatState
  transcribeState: TranscribeState

  listeners: Record<string, CallableFunction[]>
  addListener: (event: StoreEvent, listener: CallableFunction) => void
  removeListener: (event: StoreEvent, listener: CallableFunction) => void

  isFeatureEnabled(feature: string): boolean

  saveHistory(): void
  saveSettings(): void
  load(): void
  loadWorkspace(): void
  loadSettings(): void
  loadCommands(): void
  loadExperts(): void
  loadAgents(): void
  loadHistory(): void
  initChatWithDefaults(chat: Chat): void
  addChat(chat: Chat, folderId?: string): void
  removeChat(chat: Chat): void
  addQuickPrompt(prompt: string): void
  // addPadPrompt(prompt: string): void
  // mergeHistory(chats: any[]): void
  activateWorkspace(workspaceId: string): void
  dump?(): void
}

export type ExternalApp = {
  name: string
  identifier: string
  icon: FileContents
}

export type ExpertCategory = {
  id: string
  type: 'system' | 'user'
  state: 'enabled' | 'disabled'
  name?: string
  icon?: string
}

export type Expert = {
  id: string,
  type: 'system' | 'user',
  name?: string
  prompt?: string
  description?: string
  categoryId?: string
  engine?: string
  model?: string
  state: 'enabled' | 'disabled' | 'deleted',
  triggerApps: ExternalApp[]
  stats?: {
    timesUsed: number
    lastUsed?: number
  }
}

export type ExpertData = {
  categories: ExpertCategory[]
  experts: Expert[]
}

export type ComputerAction = {
  action: 'key' | 'type' | 'mouse_move' | 'left_click' | 'left_click_drag' | 'right_click' | 'middle_click' | 'double_click' | 'screenshot' | 'cursor_position'
  coordinate?: number[]
  text?: string
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
  execute(engine: string, model: string, parameters: anyDict, reference?: MediaReference[]): Promise<any>
}

export type DesignStudioMediaType = 'image' | 'video' | 'imageEdit' | 'videoEdit'

export type OpenSettingsPayload = {
  initialTab?: string
  engine?: string
}

export type LocalSearchResponse = {
  error?: 'captcha' | 'unknown'
  results?: LocalSearchResult[]
}

export type LocalSearchResult = {
  url: string
  title: string
  content?: string  // For PDFs/files (extracted text)
  html?: string     // For HTML pages (raw HTML)
}

declare global {
  interface Window {
    api: {
      licensed: boolean
      platform: string
      userDataPath: string
      on: (signal: string, callback: (value: any) => void) => void
      off: (signal: string, callback: (value: any) => void) => void
      app: {
        getVersion(): string
        setAppearanceTheme(theme: string): void
        showAbout(): void
        getAssetPath(assetPath: string): string
        // showDialog(opts: any): Promise<Electron.MessageBoxReturnValue>
        listFonts(): string[]
        fullscreen(window: string, state: boolean): void
        getHttpPort(): number
      }
      main: {
        updateMode(mode: MainWindowMode): void
        setContextMenuContext(id: string): void
        close(): void
        hideWindowButtons(): void
        showWindowButtons(): void
        moveWindow(deltaX: number, deltaY: number): void
      }
      debug: {
        showConsole(): void
        getNetworkHistory(): NetworkRequest[]
        clearNetworkHistory(): void
        openFolder(name: string): void
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
        normalize(filePath: string): string
        exists(filePath: string): boolean
        read(filepath: string): FileContents
        readIcon(filepath: string): FileContents
        extractText(contents: string, format: string): string
        getAppInfo(filepath: string): ExternalApp
        save(opts: FileSaveParams): string
        download(opts: FileDownloadParams): string
        write(filePath: string, content: string): boolean
        delete(filepath: string): boolean
        find(name: string): string
        findFiles(basePath: string, pattern: string, maxResults?: number): Promise<string[]>
        listDirectory(dirPath: string, includeHidden?: boolean): ListDirectoryResponse
        pickFile(opts: FilePickParams): null|string|string[]|FileContents
        pickDirectory(): string
        openInExplorer(filePath: string): void
      }
      settings: {
        open(payload?: OpenSettingsPayload): void
      }
      shortcuts: {
        register(): void
        unregister(): void
      }
      update: {
        check(): void
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
        load(workspaceId: string): History
        save(workspaceId: string, history: History): void
      }
      automation: {
        getText(id: string): string
        insert(text: string, sourceApp: Application): boolean
        replace(text: string, sourceApp: Application): boolean
      }
      permissions: {
        checkAccessibility(): Promise<boolean>
        checkAutomation(): Promise<boolean>
        openAccessibilitySettings(): Promise<void>
        openAutomationSettings(): Promise<void>
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
        askMeAnythingId(): string
        isPromptEditable(id: string): boolean
        import(): boolean
        export(): boolean
      }
      anywhere: {
        prompt(): void
        insert(prompt: string): void
        close(sourceApp?: Application): void
        resize(deltaX: number, deltaY: number): void
      }
      experts: {
        load(workspaceId: string): Expert[]
        save(workspaceId: string, experts: Expert[]): void
        loadCategories(workspaceId: string): ExpertCategory[]
        saveCategories(workspaceId: string, categories: ExpertCategory[]): void
        import(workspaceId: string): boolean
        export(workspaceId: string): boolean
      }
      agents: {
        forge(): void
        list(workspaceId: string): any[]
        load(workspaceId: string, agentId: string): Agent|null
        save(workspaceId: string, agent: Agent): boolean
        delete(workspaceId: string, agentId: string): boolean
        getRuns(workspaceId: string, agentId: string): AgentRun[]
        getRun(workspaceId: string, agentId: string, runId: string): AgentRun|null
        saveRun(workspaceId: string, run: AgentRun): boolean
        deleteRun(workspaceId: string, agentId: string, runId: string): boolean
        deleteRuns(workspaceId: string, agentId: string): boolean
        generateWebhookToken(workspaceId: string, agentId: string): Promise<string>
        getApiBasePath(): string
      }
      docrepo: {
        open(): void
        list(workspaceId: string): DocumentBase[]
        connect(baseId: string): void
        disconnect(): void
        isEmbeddingAvailable(engine: string, model: string): boolean
        create(workspaceId: string, title: string, embeddingEngine: string, embeddingModel: string): string
        update(baseId: string, title: string, description?: string): void
        delete(baseId: string): void
        isSourceSupported(type: SourceType, origin: string): boolean
        addDocument(id: string, type: SourceType, origin: string, title?: string): Promise<string>
        cancelTask(taskId: string): Promise<void>
        removeDocument(id: string, docId: string): Promise<boolean>
        query(id: string, text: string): Promise<DocRepoQueryResponseItem[]>
        getCurrentQueueItem(): Promise<DocumentQueueItem|null>
      },
      readaloud: {
        closePalette(sourceApp: Application): void
      },
      whisper: {
        initialize(): void
        transcribe(audioBlob: Blob): Promise<{ text: string }>
      },
      transcribe: {
        insert(text: string): void
      },
      clipboard: {
        readText(): string
        writeText(text: string): boolean
        writeImage(path: string): boolean
      },
      markdown: {
        render(markdown: string): string
      }
      interpreter: {
        python(code: string): Promise<any>
        pyodide(code: string): Promise<any>
        downloadPyodide(): Promise<any>
        isPyodideCached(): Promise<boolean>
        clearPyodideCache(): Promise<void>
      }
      mcp: {
        isAvailable(): boolean
        getServers(): McpServer[]
        editServer(server: McpServer): Promise<boolean>
        deleteServer(uuid: string): Promise<boolean>
        getInstallCommand(registry: string, server: string): string
        installServer(registry: string, server: string, apiKey: string): Promise<McpInstallStatus>
        reload(): Promise<void>
        restartServer(uuid: string): Promise<boolean>
        getStatus(): McpStatus
        getAllServersWithTools(): Promise<McpServerWithTools[]>
        getServerTools(uuid: string): Promise<McpTool[]>
        getLlmTools(): Promise<LlmTool[]>
        callTool(name: string, parameters: anyDict, signalId?: string): any
        cancelTool(signalId: string): void
        isMcpToolName(name: string): boolean
        originalToolName(name: string): string
        detectOAuth(type: 'http' | 'sse', url: string, headers: Record<string, string>): Promise<any>
        startOAuthFlow(type: 'http' | 'sse', url: string, clientMetadata: any, clientCredentials?: { client_id: string; client_secret: string }): Promise<string>
        completeOAuthFlow(serverUuid: string, authCode: string): Promise<boolean>
      }
      scratchpad: {
        create(workspaceId: string, text: string): string
        open(workspaceId: string, uuid: string): void
        list(workspaceId: string): ScratchpadHeader[]
        load(workspaceId: string, uuid: string): ScratchpadData | null
        save(workspaceId: string, data: ScratchpadData): boolean
        rename(workspaceId: string, uuid: string, newTitle: string): boolean
        delete(workspaceId: string, uuid: string): boolean
        import(workspaceId: string, filePath: string, title: string): string | null
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
      codeExecution: {
        load(): { schemas: Record<string, any> }
        save(data: { schemas: Record<string, any> }): void
      }
      search: {
        query(query: string, num: number, signalId?: string): Promise<LocalSearchResponse>
        cancel(signalId: string): void
        test(): Promise<boolean>
      }
      studio: {
        start(): void
      }
      voiceMode: {
        start(): void
      }
      backup: {
        export(): boolean
        import(): boolean
      }
      import: {
        markdown(): any
        openai(workspaceId: string): boolean
      }
      ollama: {
        downloadStart(targetDirectory: string): Promise<{ success: boolean; downloadId?: string; error?: string }>
        downloadCancel(): Promise<{ success: boolean }>
      }
      google: {
        downloadMedia(url: string, mimeType: string): Promise<string>
      }
      workspace: {
        list(): WorkspaceHeader[]
        load(workspaceId: string): Workspace|null
        save(workspace: Workspace): boolean
        delete(workspaceId: string): boolean
      }
      cli: {
        install(): Promise<{ success: boolean, message: string }>
      }
      webview: {
        setLinkBehavior(webviewId: number, isExternal: boolean): Promise<void>
        setSpellCheckEnabled(webviewId: number, enabled: boolean): Promise<void>
      }
    }
  }
}

export interface NetworkRequest {
  id: string
  type?: 'http' | 'websocket'
  url: string
  method: string
  headers: Record<string, string>
  postData?: string
  statusCode?: number
  statusText?: string
  responseHeaders?: Record<string, string>
  mimeType?: string
  responseBody?: string
  errorMessage?: string
  frames?: WebSocketFrame[]
  startTime: number
  endTime?: number
}

export interface WebSocketFrame {
  type: 'sent' | 'received'
  timestamp: number
  opcode: number
  mask: boolean
  payloadData: string
  payloadLength: number
}

export type TTSVoice = {
  id: string
  label: string
}
