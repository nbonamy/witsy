// See the Electron documentation for details on how to use preload scripts:
// https://www.electronjs.org/docs/latest/tutorial/process-model#preload-scripts

import { contextBridge, ipcRenderer } from 'electron'
import { FileDownloadParams, FileSaveParams, Command, ComputerAction, Expert, ExternalApp, FileContents, anyDict, strDict, NetworkRequest, OpenSettingsPayload } from './types';
import { Configuration } from './types/config';
import { DocRepoQueryResponseItem } from './types/rag';
import { Application, RunCommandParams } from './types/automation';
import { McpServer, McpStatus, McpTool } from './types/mcp';
import { LocalSearchResult } from './main/search';
import { Size } from './main/computer';
import { LlmChunk, LlmTool } from 'multi-llm-ts';

contextBridge.exposeInMainWorld(
  'api', {
    licensed: true,
    platform: process.platform,
    isMasBuild: process.mas === true,
    userDataPath: ipcRenderer.sendSync('get-app-path'),
    on: (signal: string, callback: (value: any) => void): void => { ipcRenderer.on(signal, (_event, value) => callback(value)) },
    off: (signal: string, callback: (value: any) => void): void => { ipcRenderer.off(signal, (_event, value) => callback(value)) },
    setAppearanceTheme: (theme: string): void => { return ipcRenderer.sendSync('set-appearance-theme', theme) },
    showDialog: (opts: any): Promise<Electron.MessageBoxReturnValue> => { return ipcRenderer.invoke('show-dialog', opts) },
    listFonts: (): string[] => { return ipcRenderer.sendSync('fonts-list') },
    debug: {
      showConsole: (): void => { return ipcRenderer.send('show-debug-console') },
      getNetworkHistory: (): NetworkRequest[] => { return ipcRenderer.sendSync('get-network-history') },
      clearNetworkHistory: (): void => { return ipcRenderer.send('clear-network-history') },
    },
    update: {
      isAvailable: (): boolean => { return ipcRenderer.sendSync('update-is-available') },
      apply: (): void => { return ipcRenderer.send('update-apply') },
    },
    store: {
      get(key: string, fallback: any): any { return ipcRenderer.sendSync('store-get-value', { key, fallback }) },
      set(key: string, value: any): void { return ipcRenderer.send('store-set-value', { key, value }) },
    },
    runAtLogin: {
      get: (): boolean => { return ipcRenderer.sendSync('run-at-login-get').openAtLogin },
      set: (state: boolean): void => { return ipcRenderer.send('run-at-login-set', state) }
    },
    fullscreen: (window: string, state: boolean): void => { return ipcRenderer.send('fullscreen', { window, state }) },
    base64: {
      encode: (data: string): string => { return Buffer.from(data).toString('base64') },
      decode: (data: string): string => { return Buffer.from(data, 'base64').toString() },
    },
    file: {
      read: (filepath: string): FileContents => { return ipcRenderer.sendSync('read-file', filepath) },
      readIcon: (filepath: string): FileContents => { return ipcRenderer.sendSync('read-icon', filepath) },
      save: (opts: FileSaveParams): string => { return ipcRenderer.sendSync('save-file', JSON.stringify(opts)) },
      pick: (opts: any): string|strDict|string[] => { return ipcRenderer.sendSync('pick-file', JSON.stringify(opts)) },
      pickDir: (): string => { return ipcRenderer.sendSync('pick-directory') },
      download: (opts: FileDownloadParams): string => { return ipcRenderer.sendSync('download', JSON.stringify(opts)) },
      delete: (filepath: string): void => { return ipcRenderer.send('delete-file', filepath) },
      find: (name: string): string => { return ipcRenderer.sendSync('find-program', name) },
      extractText: (contents: string, format: string): string => { return ipcRenderer.sendSync('get-text-content', contents, format) },
      getAppInfo: (filepath: string): ExternalApp => { return ipcRenderer.sendSync('get-app-info', filepath) },
    },
    settings: {
      open: (payload?: OpenSettingsPayload): void => { return ipcRenderer.send('settings-open', payload) },
      close: (): void => { return ipcRenderer.send('settings-close') },
    },
    clipboard: {
      readText: (): string => { return ipcRenderer.sendSync('clipboard-read-text') },
      writeText: (text: string): void => { return ipcRenderer.send('clipboard-write-text', text) },
      writeImage: (path: string): void => { return ipcRenderer.send('clipboard-write-image', path) },
    },
    shortcuts: {
      register: (): void => { return ipcRenderer.send('shortcuts-register') },
      unregister: (): void => { return ipcRenderer.send('shortcuts-unregister') },
    },
    config: {
      localeUI(): string { return ipcRenderer.sendSync('config-get-locale-ui') },
      localeLLM(): string { return ipcRenderer.sendSync('config-get-locale-llm') },
      getI18nMessages(): anyDict { return ipcRenderer.sendSync('config-get-i18n-messages') },
      load: (): Configuration => { return JSON.parse(ipcRenderer.sendSync('config-load')) },
      save: (data: Configuration) => { return ipcRenderer.send('config-save', JSON.stringify(data)) },
    },
    history: {
      load: (): History => { return JSON.parse(ipcRenderer.sendSync('history-load')) },
      save: (data: History) => { return ipcRenderer.send('history-save', JSON.stringify(data)) },
    },
    automation: {
      getText: (id: string): string => { return ipcRenderer.sendSync('automation-get-text', id) },
      replace: (text: string, sourceApp: Application): void => { return ipcRenderer.send('automation-replace', { text, sourceApp }) },
      insert: (text: string, sourceApp: Application): void => { return ipcRenderer.send('automation-insert', { text, sourceApp }) },
    },
    chat: {
      open: (chatid: string): void => { return ipcRenderer.send('chat-open', chatid) },
    },
    commands: {
      load: (): Command[] => { return JSON.parse(ipcRenderer.sendSync('commands-load')) },
      save: (data: Command[]) => { return ipcRenderer.send('commands-save', JSON.stringify(data)) },
      export: (): void => { return ipcRenderer.sendSync('commands-export') },
      import: (): void => { return ipcRenderer.sendSync('commands-import') },
      isPromptEditable: (id: string): boolean => { return ipcRenderer.sendSync('command-is-prompt-editable', id) },
      run: (params: RunCommandParams): void => { return ipcRenderer.send('command-run', JSON.stringify(params)) },
      closePicker: (sourceApp: Application): void => { return ipcRenderer.send('command-picker-close', sourceApp) },
    },
    anywhere: {
      prompt: () => { return ipcRenderer.send('anywhere-prompt') },
      close: (sourceApp: Application): void => { return ipcRenderer.send('anywhere-close', sourceApp) },
      resize: (deltaX : number, deltaY: number): void => { return ipcRenderer.send('anywhere-resize', { deltaX, deltaY }) },
    },
    experts: {
      load: (): Expert[] => { return JSON.parse(ipcRenderer.sendSync('experts-load')) },
      save: (data: Expert[]): void => { return ipcRenderer.send('experts-save', JSON.stringify(data)) },
      export: (): void => { return ipcRenderer.sendSync('experts-export') },
      import: (): void => { return ipcRenderer.sendSync('experts-import') },
    },
    docrepo: {
      list(): strDict[] { return JSON.parse(ipcRenderer.sendSync('docrepo-list')) },
      connect(baseId: string): void { return ipcRenderer.send('docrepo-connect', baseId) },
      disconnect(): void { return ipcRenderer.send('docrepo-disconnect') },
      create(title: string, embeddingEngine: string, embeddingModel: string): string { return ipcRenderer.sendSync('docrepo-create', { title, embeddingEngine, embeddingModel }) },
      rename(baseId: string, title: string): void { return ipcRenderer.sendSync('docrepo-rename', { baseId, title }) },
      delete(baseId: string): void { return ipcRenderer.sendSync('docrepo-delete', baseId) },
      addDocument(baseId: string, type: string, url: string): void { return ipcRenderer.send('docrepo-add-document', { baseId, type, url }) },
      removeDocument(baseId: string, docId: string): void { return ipcRenderer.send('docrepo-remove-document', { baseId, docId }) },
      query(baseId: string, text: string): Promise<DocRepoQueryResponseItem[]> { return ipcRenderer.invoke('docrepo-query', { baseId, text }) },
      isEmbeddingAvailable(engine: string, model: string): boolean { return ipcRenderer.sendSync('docrepo-is-embedding-available', { engine, model }) },
    },
    readaloud: {
      closePalette: (sourceApp: Application): void => { return ipcRenderer.send('readaloud-close-palette', sourceApp) },
    },
    transcribe: {
      start: (): void => { return ipcRenderer.send('transcribe-start') },
      insert(text: string): void { return ipcRenderer.send('transcribe-insert', text) },
      cancel: (): void => { return ipcRenderer.send('transcribe-cancel') },
    },
    markdown: {
      render: (markdown: string): string => { return ipcRenderer.sendSync('markdown-render', markdown) },
    },
    interpreter: {
      python: (code: string): string => { return ipcRenderer.sendSync('code-python-run', code) },
    },
    nestor: {
      isAvailable: (): boolean => { return ipcRenderer.sendSync('nestor-is-available') },
      getStatus: (): Promise<any> => { return ipcRenderer.invoke('nestor-get-status') },
      getTools: (): Promise<any[]> => { return ipcRenderer.invoke('nestor-get-tools') },
      callTool: (name: string, parameters: anyDict): Promise<any> => { return ipcRenderer.invoke('nestor-call-tool', { name, parameters }) },
    },
    mcp: {
      isAvailable: (): boolean => { return ipcRenderer.sendSync('mcp-is-available') },
      getServers: (): McpServer[] => { return ipcRenderer.sendSync('mcp-get-servers') },
      editServer: (server: McpServer): Promise<boolean> => { return ipcRenderer.invoke('mcp-edit-server', JSON.stringify(server)) },
      deleteServer: (uuid: string): Promise<boolean> => { return ipcRenderer.invoke('mcp-delete-server', uuid)},
      getInstallCommand: (registry: string, server: string): string => { return ipcRenderer.sendSync('mcp-get-install-command', { registry, server }) },
      installServer: (registry: string, server: string): Promise<boolean> => { return ipcRenderer.invoke('mcp-install-server', { registry, server }) },
      reload: (): Promise<void> => { return ipcRenderer.invoke('mcp-reload') },
      getStatus: (): McpStatus|null => { return ipcRenderer.sendSync('mcp-get-status') },
      getServerTools: (uuid: string): Promise<McpTool[]> => { return ipcRenderer.invoke('mcp-get-server-tools', uuid) },
      getTools: (): Promise<LlmTool[]> => { return ipcRenderer.invoke('mcp-get-tools') },
      callTool: (name: string, parameters: anyDict): Promise<any> => { return ipcRenderer.invoke('mcp-call-tool', { name, parameters }) },
    },
    scratchpad: {
      open: (textId?: string): void => { return ipcRenderer.send('scratchpad-open', textId) },
    },
    computer: {
      isAvailable: (): boolean => { return ipcRenderer.sendSync('computer-is-available') },
      getScaledScreenSize: (): Size => { return ipcRenderer.sendSync('computer-get-scaled-screen-size') },
      getScreenNumber: (): number => { return ipcRenderer.sendSync('computer-get-screen-number') },
      takeScreenshot: (): string => { return ipcRenderer.sendSync('computer-get-screenshot') },
      executeAction: (action: ComputerAction): anyDict => { return ipcRenderer.sendSync('computer-execute-action', action) },
      updateStatus(chunk: LlmChunk): void { ipcRenderer.send('computer-status', chunk) },
      start: (): void => { return ipcRenderer.send('computer-start') },
      close: (): void => { return ipcRenderer.send('computer-close') },
      stop: (): void => { return ipcRenderer.send('computer-stop') },
    },
    memory: {
      reset: (): void => { ipcRenderer.send('memory-reset') },
      isNotEmpty: (): boolean => { return ipcRenderer.sendSync('memory-has-facts') },
      facts: (): string[] => { return ipcRenderer.sendSync('memory-facts') },
      store: (content: string): boolean => { return ipcRenderer.sendSync('memory-store', content) },
      retrieve: (query: string): string[] => { return ipcRenderer.sendSync('memory-retrieve', query) },
      delete: (uuid: string): void => { return ipcRenderer.sendSync('memory-delete', uuid) },
    },
    search: {
      query: (query: string, num: number = 5): Promise<LocalSearchResult[]> => { return ipcRenderer.invoke('search-query', { query, num }) },
    },
    studio: {
      start: (): void => { return ipcRenderer.send('studio-start') },
    },
    voiceMode: {
      start: (): void => { return ipcRenderer.send('voice-mode-start') },
    }
  },
);
