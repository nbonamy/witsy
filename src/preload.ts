// See the Electron documentation for details on how to use preload scripts:
// https://www.electronjs.org/docs/latest/tutorial/process-model#preload-scripts

import { contextBridge, ipcRenderer } from 'electron'
import * as IPC from './ipc_consts'
import { FileDownloadParams, FileSaveParams, Command, ComputerAction, Expert, ExternalApp, FileContents, anyDict, strDict, NetworkRequest, OpenSettingsPayload, MainWindowMode, Agent, AgentRun } from './types';
import { Configuration } from './types/config';
import { DocRepoQueryResponseItem } from './types/rag';
import { Application, RunCommandParams } from './types/automation';
import { McpServer, McpStatus, McpTool } from './types/mcp';
import { ListDirectoryResponse } from './types/filesystem';
import { LocalSearchResult } from './main/search';
import { Size } from './main/computer';
import { LlmChunk, LlmTool } from 'multi-llm-ts';

contextBridge.exposeInMainWorld(
  'api', {
    licensed: true,
    platform: process.platform,
    isMasBuild: process.mas === true,
    userDataPath: ipcRenderer.sendSync(IPC.GET_APP_PATH),
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
    setAppearanceTheme: (theme: string): void => { return ipcRenderer.sendSync(IPC.SET_APPEARANCE_THEME, theme) },
    showDialog: (opts: any): Promise<Electron.MessageBoxReturnValue> => { return ipcRenderer.invoke(IPC.SHOW_DIALOG, opts) },
    listFonts: (): string[] => { return ipcRenderer.sendSync(IPC.FONTS_LIST) },
    showAbout: (): void => { return ipcRenderer.send(IPC.SHOW_ABOUT) },
    main: {
      setMode: (mode: MainWindowMode): void => { return ipcRenderer.send(IPC.MAIN_WINDOW_SET_MODE, mode) },
      close: (): void => { return ipcRenderer.send(IPC.MAIN_WINDOW_CLOSE) },
    },
    debug: {
      showConsole: (): void => { return ipcRenderer.send(IPC.SHOW_DEBUG_CONSOLE) },
      getNetworkHistory: (): NetworkRequest[] => { return ipcRenderer.sendSync(IPC.GET_NETWORK_HISTORY) },
      clearNetworkHistory: (): void => { return ipcRenderer.send(IPC.CLEAR_NETWORK_HISTORY) },
      openFolder: (name: string): void => { return ipcRenderer.send(IPC.OPEN_APP_FOLDER, name) },
    },
    update: {
      check: (): void => { return ipcRenderer.send(IPC.UPDATE_CHECK) },
      isAvailable: (): boolean => { return ipcRenderer.sendSync(IPC.UPDATE_IS_AVAILABLE) },
      apply: (): void => { return ipcRenderer.send(IPC.UPDATE_APPLY) },
    },
    store: {
      get(key: string, fallback: any): any { return ipcRenderer.sendSync(IPC.STORE_GET_VALUE, { key, fallback }) },
      set(key: string, value: any): void { return ipcRenderer.send(IPC.STORE_SET_VALUE, { key, value }) },
    },
    runAtLogin: {
      get: (): boolean => { return ipcRenderer.sendSync(IPC.RUN_AT_LOGIN_GET).openAtLogin },
      set: (state: boolean): void => { return ipcRenderer.send(IPC.RUN_AT_LOGIN_SET, state) }
    },
    fullscreen: (window: string, state: boolean): void => { return ipcRenderer.send(IPC.FULLSCREEN, { window, state }) },
    base64: {
      encode: (data: string): string => { return Buffer.from(data).toString('base64') },
      decode: (data: string): string => { return Buffer.from(data, 'base64').toString() },
    },
    file: {
      read: (filepath: string): FileContents => { return ipcRenderer.sendSync(IPC.READ_FILE, filepath) },
      readIcon: (filepath: string): FileContents => { return ipcRenderer.sendSync(IPC.READ_ICON, filepath) },
      save: (opts: FileSaveParams): string => { return ipcRenderer.sendSync(IPC.SAVE_FILE, JSON.stringify(opts)) },
      pick: (opts: any): string|strDict|string[] => { return ipcRenderer.sendSync(IPC.PICK_FILE, JSON.stringify(opts)) },
      pickDir: (): string => { return ipcRenderer.sendSync(IPC.PICK_DIRECTORY) },
      download: (opts: FileDownloadParams): string => { return ipcRenderer.sendSync(IPC.DOWNLOAD, JSON.stringify(opts)) },
      delete: (filepath: string): void => { return ipcRenderer.sendSync(IPC.DELETE_FILE, filepath) },
      find: (name: string): string => { return ipcRenderer.sendSync(IPC.FIND_PROGRAM, name) },
      extractText: (contents: string, format: string): string => { return ipcRenderer.sendSync(IPC.GET_TEXT_CONTENT, contents, format) },
      getAppInfo: (filepath: string): ExternalApp => { return ipcRenderer.sendSync(IPC.GET_APP_INFO, filepath) },
      listDirectory: (dirPath: string, includeHidden?: boolean): ListDirectoryResponse => { return ipcRenderer.sendSync(IPC.LIST_DIRECTORY, dirPath, includeHidden) },
      exists: (filePath: string): boolean => { return ipcRenderer.sendSync(IPC.FILE_EXISTS, filePath) },
      write: (filePath: string, content: string): any => { return ipcRenderer.sendSync(IPC.WRITE_FILE, filePath, content) },
      normalize: (filePath: string): string => { return ipcRenderer.sendSync(IPC.NORMALIZE_PATH, filePath) },
    },
    settings: {
      open: (payload?: OpenSettingsPayload): void => { return ipcRenderer.send(IPC.SETTINGS_OPEN, payload) },
    },
    clipboard: {
      readText: (): string => { return ipcRenderer.sendSync(IPC.CLIPBOARD_READ_TEXT) },
      writeText: (text: string): boolean => { return ipcRenderer.sendSync(IPC.CLIPBOARD_WRITE_TEXT, text) },
      writeImage: (path: string): boolean => { return ipcRenderer.sendSync(IPC.CLIPBOARD_WRITE_IMAGE, path) },
    },
    shortcuts: {
      register: (): void => { return ipcRenderer.send(IPC.SHORTCUTS_REGISTER) },
      unregister: (): void => { return ipcRenderer.send(IPC.SHORTCUTS_UNREGISTER) },
    },
    config: {
      localeUI(): string { return ipcRenderer.sendSync(IPC.CONFIG_GET_LOCALE_UI) },
      localeLLM(): string { return ipcRenderer.sendSync(IPC.CONFIG_GET_LOCALE_LLM) },
      getI18nMessages(): anyDict { return ipcRenderer.sendSync(IPC.CONFIG_GET_I18N_MESSAGES) },
      load: (): Configuration => { return JSON.parse(ipcRenderer.sendSync(IPC.CONFIG_LOAD)) },
      save: (data: Configuration) => { return ipcRenderer.send(IPC.CONFIG_SAVE, JSON.stringify(data)) },
    },
    history: {
      load: (): History => { return JSON.parse(ipcRenderer.sendSync(IPC.HISTORY_LOAD)) },
      save: (data: History) => { return ipcRenderer.send(IPC.HISTORY_SAVE, JSON.stringify(data)) },
    },
    automation: {
      getText: (id: string): string => { return ipcRenderer.sendSync(IPC.AUTOMATION_GET_TEXT, id) },
      replace: (text: string, sourceApp: Application): boolean => { return ipcRenderer.sendSync(IPC.AUTOMATION_REPLACE, { text, sourceApp }) },
      insert: (text: string, sourceApp: Application): boolean => { return ipcRenderer.sendSync(IPC.AUTOMATION_INSERT, { text, sourceApp }) },
    },
    chat: {
      open: (chatid: string): void => { return ipcRenderer.send(IPC.CHAT_OPEN, chatid) },
    },
    commands: {
      load: (): Command[] => { return JSON.parse(ipcRenderer.sendSync(IPC.COMMANDS_LOAD)) },
      save: (data: Command[]) => { return ipcRenderer.send(IPC.COMMANDS_SAVE, JSON.stringify(data)) },
      export: (): void => { return ipcRenderer.sendSync(IPC.COMMANDS_EXPORT) },
      import: (): void => { return ipcRenderer.sendSync(IPC.COMMANDS_IMPORT) },
      askMeAnythingId: (): string => { return ipcRenderer.sendSync(IPC.COMMANDS_ASK_ME_ANYTHING_ID) },
      isPromptEditable: (id: string): boolean => { return ipcRenderer.sendSync(IPC.COMMANDS_IS_PROMPT_EDITABLE, id) },
      run: (params: RunCommandParams): void => { return ipcRenderer.send(IPC.COMMAND_RUN, JSON.stringify(params)) },
      closePicker: (sourceApp: Application): void => { return ipcRenderer.send(IPC.COMMAND_PICKER_CLOSE, sourceApp) },
    },
    anywhere: {
      prompt: () => { return ipcRenderer.send(IPC.ANYWHERE_PROMPT) },
      close: (sourceApp: Application): void => { return ipcRenderer.send(IPC.ANYWHERE_CLOSE, sourceApp) },
      resize: (deltaX : number, deltaY: number): void => { return ipcRenderer.send(IPC.ANYWHERE_RESIZE, { deltaX, deltaY }) },
    },
    experts: {
      load: (): Expert[] => { return JSON.parse(ipcRenderer.sendSync(IPC.EXPERTS_LOAD)) },
      save: (data: Expert[]): void => { return ipcRenderer.send(IPC.EXPERTS_SAVE, JSON.stringify(data)) },
      export: (): void => { return ipcRenderer.sendSync(IPC.EXPERTS_EXPORT) },
      import: (): void => { return ipcRenderer.sendSync(IPC.EXPERTS_IMPORT) },
    },
    agents: {
      forge(): void { return ipcRenderer.send(IPC.AGENTS_OPEN_FORGE) },
      load: (): Agent[] => { return JSON.parse(ipcRenderer.sendSync(IPC.AGENTS_LOAD)) },
      save(agent: Agent): boolean { return ipcRenderer.sendSync(IPC.AGENTS_SAVE, JSON.stringify(agent)) },
      delete(agentId: string): boolean { return ipcRenderer.sendSync(IPC.AGENTS_DELETE, agentId) },
      getRuns(agentId: string): AgentRun[] { return JSON.parse(ipcRenderer.sendSync(IPC.AGENTS_GET_RUNS, agentId)) },
      saveRun(run: AgentRun): boolean { return ipcRenderer.sendSync(IPC.AGENTS_SAVE_RUN, JSON.stringify(run)) },
      deleteRun(agentId: string, runId: string): boolean { return ipcRenderer.sendSync(IPC.AGENTS_DELETE_RUN, { agentId, runId }) },
      deleteRuns(agentId: string): boolean { return ipcRenderer.sendSync(IPC.AGENTS_DELETE_RUNS, agentId); },
    },
    docrepo: {
      open(): void { return ipcRenderer.send(IPC.DOCREPO_OPEN) },
      list(): strDict[] { return JSON.parse(ipcRenderer.sendSync(IPC.DOCREPO_LIST)) },
      connect(baseId: string): void { return ipcRenderer.send(IPC.DOCREPO_CONNECT, baseId) },
      disconnect(): void { return ipcRenderer.send(IPC.DOCREPO_DISCONNECT) },
      create(title: string, embeddingEngine: string, embeddingModel: string): string { return ipcRenderer.sendSync(IPC.DOCREPO_CREATE, { title, embeddingEngine, embeddingModel }) },
      rename(baseId: string, title: string): void { return ipcRenderer.sendSync(IPC.DOCREPO_RENAME, { baseId, title }) },
      delete(baseId: string): void { return ipcRenderer.sendSync(IPC.DOCREPO_DELETE, baseId) },
      addDocument(baseId: string, type: string, url: string): void { return ipcRenderer.send(IPC.DOCREPO_ADD_DOCUMENT, { baseId, type, url }) },
      removeDocument(baseId: string, docId: string): void { return ipcRenderer.send(IPC.DOCREPO_REMOVE_DOCUMENT, { baseId, docId }) },
      query(baseId: string, text: string): Promise<DocRepoQueryResponseItem[]> { return ipcRenderer.invoke(IPC.DOCREPO_QUERY, { baseId, text }) },
      isEmbeddingAvailable(engine: string, model: string): boolean { return ipcRenderer.sendSync(IPC.DOCREPO_IS_EMBEDDING_AVAILABLE, { engine, model }) },
    },
    readaloud: {
      closePalette: (sourceApp: Application): void => { return ipcRenderer.send(IPC.READALOUD_CLOSE_PALETTE, sourceApp) },
    },
    transcribe: {
      insert(text: string): void { return ipcRenderer.send(IPC.TRANSCRIBE_INSERT, text) },
    },
    markdown: {
      render: (markdown: string): string => { return ipcRenderer.sendSync(IPC.MARKDOWN_RENDER, markdown) },
    },
    interpreter: {
      python: (code: string): string => { return ipcRenderer.sendSync(IPC.CODE_PYTHON_RUN, code) },
    },
    mcp: {
      isAvailable: (): boolean => { return ipcRenderer.sendSync(IPC.MCP_IS_AVAILABLE) },
      getServers: (): McpServer[] => { return ipcRenderer.sendSync(IPC.MCP_GET_SERVERS) },
      editServer: (server: McpServer): Promise<boolean> => { return ipcRenderer.invoke(IPC.MCP_EDIT_SERVER, JSON.stringify(server)) },
      deleteServer: (uuid: string): Promise<boolean> => { return ipcRenderer.invoke(IPC.MCP_DELETE_SERVER, uuid)},
      getInstallCommand: (registry: string, server: string): string => { return ipcRenderer.sendSync(IPC.MCP_GET_INSTALL_COMMAND, { registry, server }) },
      installServer: (registry: string, server: string, apiKey: string): Promise<boolean> => { return ipcRenderer.invoke(IPC.MCP_INSTALL_SERVER, { registry, server, apiKey }) }, 
      reload: (): Promise<void> => { return ipcRenderer.invoke(IPC.MCP_RELOAD) },
      getStatus: (): McpStatus|null => { return ipcRenderer.sendSync(IPC.MCP_GET_STATUS) },
      getServerTools: (uuid: string): Promise<McpTool[]> => { return ipcRenderer.invoke(IPC.MCP_GET_SERVER_TOOLS, uuid) },
      getTools: (): Promise<LlmTool[]> => { return ipcRenderer.invoke(IPC.MCP_GET_TOOLS) },
      callTool: (name: string, parameters: anyDict): Promise<any> => { return ipcRenderer.invoke(IPC.MCP_CALL_TOOL, { name, parameters }) },
      originalToolName(name: string): string { return ipcRenderer.sendSync(IPC.MCP_ORIGINAL_TOOL_NAME, name) },
    },
    scratchpad: {
      open: (textId?: string): void => { return ipcRenderer.send(IPC.SCRATCHPAD_OPEN, textId) },
    },
    computer: {
      isAvailable: (): boolean => { return ipcRenderer.sendSync(IPC.COMPUTER_IS_AVAILABLE) },
      getScaledScreenSize: (): Size => { return ipcRenderer.sendSync(IPC.COMPUTER_GET_SCALED_SCREEN_SIZE) },
      getScreenNumber: (): number => { return ipcRenderer.sendSync(IPC.COMPUTER_GET_SCREEN_NUMBER) },
      takeScreenshot: (): string => { return ipcRenderer.sendSync(IPC.COMPUTER_GET_SCREENSHOT) },
      executeAction: (action: ComputerAction): anyDict => { return ipcRenderer.sendSync(IPC.COMPUTER_EXECUTE_ACTION, action) },
      updateStatus(chunk: LlmChunk): void { ipcRenderer.send(IPC.COMPUTER_STATUS, chunk) },
      start: (): void => { return ipcRenderer.send(IPC.COMPUTER_START) },
      close: (): void => { return ipcRenderer.send(IPC.COMPUTER_CLOSE) },
      stop: (): void => { return ipcRenderer.send(IPC.COMPUTER_STOP) },
    },
    memory: {
      reset: (): void => { ipcRenderer.send(IPC.MEMORY_RESET) },
      isNotEmpty: (): boolean => { return ipcRenderer.sendSync(IPC.MEMORY_HAS_FACTS) },
      facts: (): string[] => { return ipcRenderer.sendSync(IPC.MEMORY_FACTS) },
      store: (content: string): boolean => { return ipcRenderer.sendSync(IPC.MEMORY_STORE, content) },
      retrieve: (query: string): string[] => { return ipcRenderer.sendSync(IPC.MEMORY_RETRIEVE, query) },
      delete: (uuid: string): void => { return ipcRenderer.sendSync(IPC.MEMORY_DELETE, uuid) },
    },
    search: {
      query: (query: string, num: number = 5): Promise<LocalSearchResult[]> => { return ipcRenderer.invoke(IPC.SEARCH_QUERY, { query, num }) },
    },
    studio: {
      start: (): void => { return ipcRenderer.send(IPC.STUDIO_START) },
    },
    voiceMode: {
      start: (): void => { return ipcRenderer.send(IPC.VOICE_MODE_START) },
    }
  },
);
