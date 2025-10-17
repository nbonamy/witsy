// See the Electron documentation for details on how to use preload scripts:
// https://www.electronjs.org/docs/latest/tutorial/process-model#preload-scripts

import { contextBridge, ipcRenderer } from 'electron';
import { LlmChunk, LlmTool } from 'multi-llm-ts';
import * as IPC from './ipc_consts';
import { Size } from './main/computer';
import Agent from './models/agent';
import { Command, ComputerAction, Expert, ExternalApp, LocalSearchResponse, MainWindowMode, NetworkRequest, OpenSettingsPayload, anyDict, strDict } from './types';
import { AgentRun } from './types/agents';
import { Application, RunCommandParams } from './types/automation';
import { Configuration } from './types/config';
import { FileContents, FileDownloadParams, FilePickParams, FileSaveParams } from './types/file';
import { ListDirectoryResponse } from './types/filesystem';
import { McpServer, McpStatus, McpTool } from './types/mcp';
import { DocRepoQueryResponseItem, DocumentQueueItem, SourceType } from './types/rag';
import { Workspace, WorkspaceHeader } from './types/workspace';

contextBridge.exposeInMainWorld(
  'api', {
    licensed: true,
    platform: process.platform,
    userDataPath: ipcRenderer.sendSync(IPC.APP.GET_APP_PATH),
    on: (signal: string, callback: (value: any) => void): void => {
      ipcRenderer.on(signal, (_event, value) => callback(value))
    },
    off: (signal: string, callback?: (value: any) => void): void => {
      if (callback) {
        ipcRenderer.removeListener(signal, (_event, value) => callback(value))
      } else {
        ipcRenderer.removeAllListeners(signal)
      }
    },
    app: {
      getVersion: (): string => { return ipcRenderer.sendSync(IPC.APP.GET_VERSION) },
      setAppearanceTheme: (theme: string): void => { return ipcRenderer.sendSync(IPC.APP.SET_APPEARANCE_THEME, theme) },
      // showDialog: (opts: any): Promise<Electron.MessageBoxReturnValue> => { return ipcRenderer.invoke(IPC.APP.SHOW_DIALOG, opts) },
      listFonts: (): string[] => { return ipcRenderer.sendSync(IPC.APP.FONTS_LIST) },
      showAbout: (): void => { return ipcRenderer.send(IPC.APP.SHOW_ABOUT) },
      getAssetPath: (assetPath: string): string => { return ipcRenderer.sendSync(IPC.APP.GET_ASSET_PATH, assetPath) },
      fullscreen: (window: string, state: boolean): void => { return ipcRenderer.send(IPC.APP.FULLSCREEN, { window, state }) },
      getHttpPort: (): number => ipcRenderer.sendSync(IPC.APP.GET_HTTP_PORT),
    },
    main: {
      updateMode: (mode: MainWindowMode): void => { return ipcRenderer.send(IPC.MAIN_WINDOW.UPDATE_MODE, mode) },
      setContextMenuContext: (id: string): void => { return ipcRenderer.send(IPC.MAIN_WINDOW.SET_CONTEXT_MENU_CONTEXT, id) },
      close: (): void => { return ipcRenderer.send(IPC.MAIN_WINDOW.CLOSE) },
      hideWindowButtons: (): void => { return ipcRenderer.send(IPC.MAIN_WINDOW.HIDE_WINDOW_BUTTONS) },
      showWindowButtons: (): void => { return ipcRenderer.send(IPC.MAIN_WINDOW.SHOW_WINDOW_BUTTONS) },
      moveWindow: (deltaX: number, deltaY: number): void => { return ipcRenderer.send(IPC.MAIN_WINDOW.MOVE_WINDOW, { deltaX, deltaY }) },
    },
    debug: {
      showConsole: (): void => { return ipcRenderer.send(IPC.DEBUG.SHOW_CONSOLE) },
      getNetworkHistory: (): NetworkRequest[] => { return ipcRenderer.sendSync(IPC.DEBUG.GET_NETWORK_HISTORY) },
      clearNetworkHistory: (): void => { return ipcRenderer.send(IPC.DEBUG.CLEAR_NETWORK_HISTORY) },
      openFolder: (name: string): void => { return ipcRenderer.send(IPC.DEBUG.OPEN_APP_FOLDER, name) },
    },
    update: {
      check: (): void => { return ipcRenderer.send(IPC.UPDATE.CHECK) },
      isAvailable: (): boolean => { return ipcRenderer.sendSync(IPC.UPDATE.IS_AVAILABLE) },
      apply: (): void => { return ipcRenderer.send(IPC.UPDATE.APPLY) },
    },
    store: {
      get(key: string, fallback: any): any { return ipcRenderer.sendSync(IPC.STORE.GET_VALUE, { key, fallback }) },
      set(key: string, value: any): void { return ipcRenderer.send(IPC.STORE.SET_VALUE, { key, value }) },
    },
    runAtLogin: {
      get: (): boolean => { return ipcRenderer.sendSync(IPC.APP.RUN_AT_LOGIN_GET).openAtLogin },
      set: (state: boolean): void => { return ipcRenderer.send(IPC.APP.RUN_AT_LOGIN_SET, state) }
    },
    base64: {
      encode: (data: string): string => { return Buffer.from(data).toString('base64') },
      decode: (data: string): string => { return Buffer.from(data, 'base64').toString() },
    },
    file: {
      normalize: (filePath: string): string => { return ipcRenderer.sendSync(IPC.FILE.NORMALIZE_PATH, filePath) },
      exists: (filePath: string): boolean => { return ipcRenderer.sendSync(IPC.FILE.FILE_EXISTS, filePath) },
      read: (filepath: string): FileContents => { return ipcRenderer.sendSync(IPC.FILE.READ_FILE, filepath) },
      readIcon: (filepath: string): FileContents => { return ipcRenderer.sendSync(IPC.FILE.READ_ICON, filepath) },
      extractText: (contents: string, format: string): string => { return ipcRenderer.sendSync(IPC.FILE.GET_TEXT_CONTENT, contents, format) },
      getAppInfo: (filepath: string): ExternalApp => { return ipcRenderer.sendSync(IPC.FILE.GET_APP_INFO, filepath) },
      save: (opts: FileSaveParams): string => { return ipcRenderer.sendSync(IPC.FILE.SAVE_FILE, JSON.stringify(opts)) },
      download: (opts: FileDownloadParams): string => { return ipcRenderer.sendSync(IPC.FILE.DOWNLOAD, JSON.stringify(opts)) },
      write: (filePath: string, content: string): any => { return ipcRenderer.sendSync(IPC.FILE.WRITE_FILE, filePath, content) },
      delete: (filepath: string): void => { return ipcRenderer.sendSync(IPC.FILE.DELETE_FILE, filepath) },
      find: (name: string): string => { return ipcRenderer.sendSync(IPC.FILE.FIND_PROGRAM, name) },
      listDirectory: (dirPath: string, includeHidden?: boolean): ListDirectoryResponse => { return ipcRenderer.sendSync(IPC.FILE.LIST_DIRECTORY, dirPath, includeHidden) },
      pickFile: (opts: FilePickParams): string|strDict|string[] => { return ipcRenderer.sendSync(IPC.FILE.PICK_FILE, JSON.stringify(opts)) },
      pickDirectory: (): string => { return ipcRenderer.sendSync(IPC.FILE.PICK_DIRECTORY) },
      openInExplorer: (filePath: string): { success: boolean; error?: string } => { return ipcRenderer.sendSync(IPC.FILE.OPEN_IN_EXPLORER, filePath) },
    },
    settings: {
      open: (payload?: OpenSettingsPayload): void => { return ipcRenderer.send(IPC.SETTINGS.OPEN, payload) },
    },
    clipboard: {
      readText: (): string => { return ipcRenderer.sendSync(IPC.CLIPBOARD.READ_TEXT) },
      writeText: (text: string): boolean => { return ipcRenderer.sendSync(IPC.CLIPBOARD.WRITE_TEXT, text) },
      writeImage: (path: string): boolean => { return ipcRenderer.sendSync(IPC.CLIPBOARD.WRITE_IMAGE, path) },
    },
    shortcuts: {
      register: (): void => { return ipcRenderer.send(IPC.SHORTCUTS.REGISTER) },
      unregister: (): void => { return ipcRenderer.send(IPC.SHORTCUTS.UNREGISTER) },
    },
    config: {
      localeUI(): string { return ipcRenderer.sendSync(IPC.CONFIG.GET_LOCALE_UI) },
      localeLLM(): string { return ipcRenderer.sendSync(IPC.CONFIG.GET_LOCALE_LLM) },
      getI18nMessages(): anyDict { return ipcRenderer.sendSync(IPC.CONFIG.GET_I18N_MESSAGES) },
      load: (): Configuration => { return JSON.parse(ipcRenderer.sendSync(IPC.CONFIG.LOAD)) },
      save: (data: Configuration) => { return ipcRenderer.send(IPC.CONFIG.SAVE, JSON.stringify(data)) },
    },
    history: {
      load: (workspaceId: string): History => { return JSON.parse(ipcRenderer.sendSync(IPC.HISTORY.LOAD, workspaceId)) },
      save: (workspaceId: string, data: History) => { return ipcRenderer.send(IPC.HISTORY.SAVE, JSON.stringify({ workspaceId, history: data })) },
    },
    automation: {
      getText: (id: string): string => { return ipcRenderer.sendSync(IPC.AUTOMATION.GET_TEXT, id) },
      replace: (text: string, sourceApp: Application): boolean => { return ipcRenderer.sendSync(IPC.AUTOMATION.REPLACE, { text, sourceApp }) },
      insert: (text: string, sourceApp: Application): boolean => { return ipcRenderer.sendSync(IPC.AUTOMATION.INSERT, { text, sourceApp }) },
    },
    permissions: {
      checkAccessibility: (): Promise<boolean> => { return ipcRenderer.invoke(IPC.PERMISSIONS.CHECK_ACCESSIBILITY) },
      checkAutomation: (): Promise<boolean> => { return ipcRenderer.invoke(IPC.PERMISSIONS.CHECK_AUTOMATION) },
      openAccessibilitySettings: (): Promise<void> => { return ipcRenderer.invoke(IPC.PERMISSIONS.OPEN_ACCESSIBILITY_SETTINGS) },
      openAutomationSettings: (): Promise<void> => { return ipcRenderer.invoke(IPC.PERMISSIONS.OPEN_AUTOMATION_SETTINGS) },
    },
    chat: {
      open: (chatid: string): void => { return ipcRenderer.send(IPC.CHAT.OPEN, chatid) },
    },
    commands: {
      load: (): Command[] => { return JSON.parse(ipcRenderer.sendSync(IPC.COMMANDS.LOAD)) },
      save: (data: Command[]) => { return ipcRenderer.send(IPC.COMMANDS.SAVE, JSON.stringify(data)) },
      export: (): boolean => { return ipcRenderer.sendSync(IPC.COMMANDS.EXPORT) },
      import: (): boolean => { return ipcRenderer.sendSync(IPC.COMMANDS.IMPORT) },
      askMeAnythingId: (): string => { return ipcRenderer.sendSync(IPC.COMMANDS.ASK_ME_ANYTHING_ID) },
      isPromptEditable: (id: string): boolean => { return ipcRenderer.sendSync(IPC.COMMANDS.IS_PROMPT_EDITABLE, id) },
      run: (params: RunCommandParams): void => { return ipcRenderer.send(IPC.COMMANDS.RUN, JSON.stringify(params)) },
      closePicker: (sourceApp: Application): void => { return ipcRenderer.send(IPC.COMMANDS.PICKER_CLOSE, sourceApp) },
    },
    anywhere: {
      prompt: () => { return ipcRenderer.send(IPC.ANYWHERE.PROMPT) },
      close: (sourceApp: Application): void => { return ipcRenderer.send(IPC.ANYWHERE.CLOSE, sourceApp) },
      resize: (deltaX : number, deltaY: number): void => { return ipcRenderer.send(IPC.ANYWHERE.RESIZE, { deltaX, deltaY }) },
    },
    experts: {
      load: (workspaceId: string): Expert[] => { return JSON.parse(ipcRenderer.sendSync(IPC.EXPERTS.LOAD, workspaceId)) },
      save: (workspaceId: string, data: Expert[]): void => { return ipcRenderer.send(IPC.EXPERTS.SAVE, JSON.stringify({ workspaceId, experts: data })) },
      export: (workspaceId: string): void => { return ipcRenderer.sendSync(IPC.EXPERTS.EXPORT, workspaceId) },
      import: (workspaceId: string): void => { return ipcRenderer.sendSync(IPC.EXPERTS.IMPORT, workspaceId) },
    },
    agents: {
      forge(): void { return ipcRenderer.send(IPC.AGENTS.OPEN_FORGE) },
      load: (workspaceId: string): any[] => { return JSON.parse(ipcRenderer.sendSync(IPC.AGENTS.LOAD, workspaceId)).map((a: any) => Agent.fromJson(a)) },
      save(workspaceId: string, agent: Agent): boolean { return ipcRenderer.sendSync(IPC.AGENTS.SAVE, JSON.stringify({ workspaceId, agent })) },
      delete(workspaceId: string, agentId: string): boolean { return ipcRenderer.sendSync(IPC.AGENTS.DELETE, JSON.stringify({ workspaceId, agentId })) },
      getRuns(workspaceId: string, agentId: string): AgentRun[] { return JSON.parse(ipcRenderer.sendSync(IPC.AGENTS.GET_RUNS, JSON.stringify({ workspaceId, agentId }))) },
      getRun(workspaceId: string, agentId: string, runId: string): AgentRun|null { return JSON.parse(ipcRenderer.sendSync(IPC.AGENTS.GET_RUN, JSON.stringify({ workspaceId, agentId, runId }))) },
      saveRun(workspaceId: string, run: AgentRun): boolean { return ipcRenderer.sendSync(IPC.AGENTS.SAVE_RUN, JSON.stringify({ workspaceId, run })) },
      deleteRun(workspaceId: string, agentId: string, runId: string): boolean { return ipcRenderer.sendSync(IPC.AGENTS.DELETE_RUN, JSON.stringify({ workspaceId, agentId, runId })) },
      deleteRuns(workspaceId: string, agentId: string): boolean { return ipcRenderer.sendSync(IPC.AGENTS.DELETE_RUNS, JSON.stringify({ workspaceId, agentId })); },
      generateWebhookToken: (workspaceId: string, agentId: string): Promise<string> => ipcRenderer.invoke(IPC.AGENTS.GENERATE_WEBHOOK_TOKEN, workspaceId, agentId),
      getApiBasePath: (): string => ipcRenderer.sendSync(IPC.AGENTS.GET_API_BASE_PATH),
    },
    docrepo: {
      open(): void { return ipcRenderer.send(IPC.DOCREPO.OPEN) },
      list(workspaceId: string): strDict[] { return JSON.parse(ipcRenderer.sendSync(IPC.DOCREPO.LIST, workspaceId)) },
      connect(baseId: string): void { return ipcRenderer.send(IPC.DOCREPO.CONNECT, baseId) },
      disconnect(): void { return ipcRenderer.send(IPC.DOCREPO.DISCONNECT) },
      create(workspaceId: string, title: string, embeddingEngine: string, embeddingModel: string): string { return ipcRenderer.sendSync(IPC.DOCREPO.CREATE, { workspaceId, title, embeddingEngine, embeddingModel }) },
      rename(baseId: string, title: string): void { return ipcRenderer.sendSync(IPC.DOCREPO.RENAME, { baseId, title }) },
      delete(baseId: string): void { return ipcRenderer.sendSync(IPC.DOCREPO.DELETE, baseId) },
      addDocument(baseId: string, type: SourceType, origin: string, title?: string): Promise<void> { return ipcRenderer.invoke(IPC.DOCREPO.ADD_DOCUMENT, { baseId, type, origin, title }) },
      removeDocument(baseId: string, docId: string): Promise<boolean> { return ipcRenderer.invoke(IPC.DOCREPO.REMOVE_DOCUMENT, { baseId, docId }) },
      query(baseId: string, text: string): Promise<DocRepoQueryResponseItem[]> { return ipcRenderer.invoke(IPC.DOCREPO.QUERY, { baseId, text }) },
      isEmbeddingAvailable(engine: string, model: string): boolean { return ipcRenderer.sendSync(IPC.DOCREPO.IS_EMBEDDING_AVAILABLE, { engine, model }) },
      getCurrentQueueItem(): Promise<DocumentQueueItem|null> { return ipcRenderer.invoke(IPC.DOCREPO.GET_CURRENT_QUEUE_ITEM) },
      isSourceSupported(type: SourceType, origin: string): boolean { return ipcRenderer.sendSync(IPC.DOCREPO.IS_SOURCE_SUPPORTED, { type, origin }) },
    },
    readaloud: {
      closePalette: (sourceApp: Application): void => { return ipcRenderer.send(IPC.READALOUD.CLOSE_PALETTE, sourceApp) },
    },
    transcribe: {
      insert(text: string): void { return ipcRenderer.send(IPC.TRANSCRIBE.INSERT, text) },
    },
    markdown: {
      render: (markdown: string): string => { return ipcRenderer.sendSync(IPC.MARKDOWN.RENDER, markdown) },
    },
    interpreter: {
      python: (code: string): Promise<any> => { return ipcRenderer.invoke(IPC.INTERPRETER.PYTHON_RUN, code) },
    },
    mcp: {
      isAvailable: (): boolean => { return ipcRenderer.sendSync(IPC.MCP.IS_AVAILABLE) },
      getServers: (): McpServer[] => { return ipcRenderer.sendSync(IPC.MCP.GET_SERVERS) },
      editServer: (server: McpServer): Promise<boolean> => { return ipcRenderer.invoke(IPC.MCP.EDIT_SERVER, JSON.stringify(server)) },
      deleteServer: (uuid: string): Promise<boolean> => { return ipcRenderer.invoke(IPC.MCP.DELETE_SERVER, uuid)},
      getInstallCommand: (registry: string, server: string): string => { return ipcRenderer.sendSync(IPC.MCP.GET_INSTALL_COMMAND, { registry, server }) },
      installServer: (registry: string, server: string, apiKey: string): Promise<boolean> => { return ipcRenderer.invoke(IPC.MCP.INSTALL_SERVER, { registry, server, apiKey }) }, 
      reload: (): Promise<void> => { return ipcRenderer.invoke(IPC.MCP.RELOAD) },
      restartServer: (uuid: string): Promise<boolean> => { return ipcRenderer.invoke(IPC.MCP.RESTART_SERVER, uuid) },
      getStatus: (): McpStatus|null => { return ipcRenderer.sendSync(IPC.MCP.GET_STATUS) },
      getAllServersWithTools: (): Promise<Array<{ server: McpServer; tools: McpTool[] }>> => { return ipcRenderer.invoke(IPC.MCP.GET_ALL_SERVERS_WITH_TOOLS) },
      getServerTools: (uuid: string): Promise<McpTool[]> => { return ipcRenderer.invoke(IPC.MCP.GET_SERVER_TOOLS, uuid) },
      getLlmTools: (): Promise<LlmTool[]> => { return ipcRenderer.invoke(IPC.MCP.GET_LLM_TOOLS) },
      callTool: (name: string, parameters: anyDict, signalId?: string): Promise<any> => { return ipcRenderer.invoke(IPC.MCP.CALL_TOOL, { name, parameters, signalId }) },
      cancelTool: (signalId: string): void => { ipcRenderer.send(IPC.MCP.CANCEL_TOOL, signalId) },
      originalToolName(name: string): string { return ipcRenderer.sendSync(IPC.MCP.ORIGINAL_TOOL_NAME, name) },
      detectOAuth: (type: 'http' | 'sse', url: string, headers: Record<string, string>): Promise<any> => { return ipcRenderer.invoke(IPC.MCP.DETECT_OAUTH, { type, url, headers }) },
      startOAuthFlow: (type: 'http' | 'sse', url: string, clientMetadata: any, clientCredentials?: { client_id: string; client_secret: string }): Promise<string> => { return ipcRenderer.invoke(IPC.MCP.START_OAUTH_FLOW, JSON.stringify({ type, url, clientMetadata, clientCredentials })) },
      completeOAuthFlow: (serverUuid: string, authCode: string): Promise<boolean> => { return ipcRenderer.invoke(IPC.MCP.COMPLETE_OAUTH_FLOW, JSON.stringify({ serverUuid, authCode })) },
    },
    scratchpad: {
      open: (textId?: string): void => { return ipcRenderer.send(IPC.SCRATCHPAD.OPEN, textId) },
      list: (workspaceId: string): any[] => { return ipcRenderer.sendSync(IPC.SCRATCHPAD.LIST, workspaceId) },
      load: (workspaceId: string, uuid: string): any => { return ipcRenderer.sendSync(IPC.SCRATCHPAD.LOAD, { workspaceId, uuid }) },
      save: (workspaceId: string, data: any): boolean => { return ipcRenderer.sendSync(IPC.SCRATCHPAD.SAVE, { workspaceId, data }) },
      rename: (workspaceId: string, uuid: string, newTitle: string): boolean => { return ipcRenderer.sendSync(IPC.SCRATCHPAD.RENAME, { workspaceId, uuid, newTitle }) },
      delete: (workspaceId: string, uuid: string): boolean => { return ipcRenderer.sendSync(IPC.SCRATCHPAD.DELETE, { workspaceId, uuid }) },
      import: (workspaceId: string, filePath: string, title: string): string | null => { return ipcRenderer.sendSync(IPC.SCRATCHPAD.IMPORT, { workspaceId, filePath, title }) },
    },
    computer: {
      isAvailable: (): boolean => { return ipcRenderer.sendSync(IPC.COMPUTER.IS_AVAILABLE) },
      getScaledScreenSize: (): Size => { return ipcRenderer.sendSync(IPC.COMPUTER.GET_SCALED_SCREEN_SIZE) },
      getScreenNumber: (): number => { return ipcRenderer.sendSync(IPC.COMPUTER.GET_SCREEN_NUMBER) },
      takeScreenshot: (): string => { return ipcRenderer.sendSync(IPC.COMPUTER.GET_SCREENSHOT) },
      executeAction: (action: ComputerAction): anyDict => { return ipcRenderer.sendSync(IPC.COMPUTER.EXECUTE_ACTION, action) },
      updateStatus(chunk: LlmChunk): void { ipcRenderer.send(IPC.COMPUTER.STATUS, chunk) },
      start: (): void => { return ipcRenderer.send(IPC.COMPUTER.START) },
      close: (): void => { return ipcRenderer.send(IPC.COMPUTER.CLOSE) },
      stop: (): void => { return ipcRenderer.send(IPC.COMPUTER.STOP) },
    },
    computerBrowser: {
      isAvailable: (): boolean => { return ipcRenderer.sendSync(IPC.COMPUTER_BROWSER.IS_AVAILABLE) },
      executeAction: (action: ComputerAction): Promise<{ url: string, screenshot: string }> => { return ipcRenderer.invoke(IPC.COMPUTER_BROWSER.EXECUTE_ACTION, action) },
      hide: (): void => { ipcRenderer.send(IPC.COMPUTER_BROWSER.HIDE) },
    },
    memory: {
      reset: (): void => { ipcRenderer.send(IPC.MEMORY.RESET) },
      isNotEmpty: (): boolean => { return ipcRenderer.sendSync(IPC.MEMORY.HAS_FACTS) },
      facts: (): string[] => { return ipcRenderer.sendSync(IPC.MEMORY.FACTS) },
      store: (content: string): boolean => { return ipcRenderer.sendSync(IPC.MEMORY.STORE, content) },
      retrieve: (query: string): string[] => { return ipcRenderer.sendSync(IPC.MEMORY.RETRIEVE, query) },
      delete: (uuid: string): void => { return ipcRenderer.sendSync(IPC.MEMORY.DELETE, uuid) },
    },
    search: {
      query: (query: string, num: number = 5, signalId?: string): Promise<LocalSearchResponse> => { return ipcRenderer.invoke(IPC.SEARCH.QUERY, { query, num, signalId }) },
      cancel: (signalId: string): void => { ipcRenderer.send(IPC.SEARCH.CANCEL, signalId) },
      test: (): Promise<boolean> => { return ipcRenderer.invoke(IPC.SEARCH.TEST) },
    },
    studio: {
      start: (): void => { return ipcRenderer.send(IPC.STUDIO.START) },
    },
    voiceMode: {
      start: (): void => { return ipcRenderer.send(IPC.VOICE_MODE.START) },
    },
    backup: {
      export: (): boolean => { return ipcRenderer.sendSync(IPC.BACKUP.EXPORT) },
      import: (): boolean => { return ipcRenderer.sendSync(IPC.BACKUP.IMPORT) },
    },
    import: {
      openai: (workspaceId: string): boolean => { return ipcRenderer.sendSync(IPC.IMPORT.OPENAI, workspaceId) },
    },
    ollama: {
      downloadStart: (targetDirectory: string): Promise<{ success: boolean; downloadId?: string; error?: string }> => { 
        return ipcRenderer.invoke(IPC.OLLAMA.DOWNLOAD_START, targetDirectory) 
      },
      downloadCancel: (): Promise<{ success: boolean }> => { 
        return ipcRenderer.invoke(IPC.OLLAMA.DOWNLOAD_CANCEL) 
      },
    },
    google: {
      downloadMedia: (url: string, mimeType: string): Promise<string> => { 
        return ipcRenderer.invoke(IPC.GOOGLE.DOWNLOAD_MEDIA, { url, mimeType }) 
      },
    },
    workspace: {
      list: (): WorkspaceHeader[] => { return JSON.parse(ipcRenderer.sendSync(IPC.WORKSPACE.LIST)) },
      load: (workspaceId: string): Workspace|null => { return JSON.parse(ipcRenderer.sendSync(IPC.WORKSPACE.LOAD, workspaceId)) },
      save: (workspace: Workspace): boolean => { return ipcRenderer.sendSync(IPC.WORKSPACE.SAVE, JSON.stringify(workspace)) },
      delete: (workspaceId: string): boolean => { return ipcRenderer.sendSync(IPC.WORKSPACE.DELETE, workspaceId) },
    },
    cli: {
      install: (): Promise<{ success: boolean, message: string }> => { return ipcRenderer.invoke(IPC.CLI.INSTALL) },
    },
    webview: {
      setLinkBehavior: (webviewId: number, isExternal: boolean): Promise<void> => {
        return ipcRenderer.invoke('webview-set-link-behavior', webviewId, isExternal)
      },
      setSpellCheckEnabled: (webviewId: number, enabled: boolean): Promise<void> => {
        return ipcRenderer.invoke('webview-set-spell-check', webviewId, enabled)
      },
    }
  },
);
