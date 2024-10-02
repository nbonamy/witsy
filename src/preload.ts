// See the Electron documentation for details on how to use preload scripts:
// https://www.electronjs.org/docs/latest/tutorial/process-model#preload-scripts

import { Chat, Command, Expert, ExternalApp, FileContents, anyDict, strDict } from './types/index.d';
import { Configuration } from './types/config.d';
import { DocRepoQueryResponseItem } from './types/rag.d';
import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld(
  'api', {
    licensed: true,
    platform: process.platform,
    userDataPath: ipcRenderer.sendSync('get-app-path'),
    on: (signal: string, callback: (value: any) => void): void => { ipcRenderer.on(signal, (_event, value) => callback(value)) },
    store: {
      get(key: string, fallback: any): any { return ipcRenderer.sendSync('store-get-value', { key, fallback }) },
      set(key: string, value: any): void { return ipcRenderer.send('store-set-value', { key, value }) },
    },
    runAtLogin: {
      get: (): boolean => { return ipcRenderer.sendSync('run-at-login-get').openAtLogin },
      set: (state: boolean): void => { return ipcRenderer.send('run-at-login-set', state) }
    },
    fullscreen: (state: boolean): void => { return ipcRenderer.send('fullscreen', state) },
    base64: {
      encode: (data: string): string => { return Buffer.from(data).toString('base64') },
      decode: (data: string): string => { return Buffer.from(data, 'base64').toString() },
    },
    file: {
      read: (filepath: string): FileContents => { return ipcRenderer.sendSync('read-file', filepath) },
      readIcon: (filepath: string): FileContents => { return ipcRenderer.sendSync('read-icon', filepath) },
      save: (opts: any): string => { return ipcRenderer.sendSync('save-file', JSON.stringify(opts)) },
      pick: (opts: any): string|strDict|string[] => { return ipcRenderer.sendSync('pick-file', JSON.stringify(opts)) },
      pickDir: (): string => { return ipcRenderer.sendSync('pick-directory') },
      download: (opts: any): string => { return ipcRenderer.sendSync('download', JSON.stringify(opts)) },
      delete: (filepath: string): void => { return ipcRenderer.send('delete-file', filepath) },
      find: (name: string): string => { return ipcRenderer.sendSync('find-program', name) },
      extractText: (contents: string, format: string): string => { return ipcRenderer.sendSync('get-text-content', contents, format) },
      getAppInfo: (filepath: string): ExternalApp => { return ipcRenderer.sendSync('get-app-info', filepath) },
    },
    clipboard: {
      writeText: (text: string): void => { return ipcRenderer.send('clipboard-write-text', text) },
      writeImage: (path: string): void => { return ipcRenderer.send('clipboard-write-image', path) },
    },
    shortcuts: {
      register: (): void => { return ipcRenderer.send('shortcuts-register') },
      unregister: (): void => { return ipcRenderer.send('shortcuts-unregister') },
    },
    config: {
      load: (): Configuration => { return JSON.parse(ipcRenderer.sendSync('config-load')) },
      save: (data: Configuration) => { return ipcRenderer.send('config-save', JSON.stringify(data)) },
    },
    history: {
      load: (): Chat[] => { return JSON.parse(ipcRenderer.sendSync('history-load')) },
      save: (data: Chat[]) => { return ipcRenderer.send('history-save', JSON.stringify(data)) },
    },
    commands: {
      load: (): Command[] => { return JSON.parse(ipcRenderer.sendSync('commands-load')) },
      save: (data: Command[]) => { return ipcRenderer.send('commands-save', JSON.stringify(data)) },
      export: (): void => { return ipcRenderer.sendSync('commands-export') },
      import: (): void => { return ipcRenderer.sendSync('commands-import') },
      run: (command: Command): void => { return ipcRenderer.send('command-run', JSON.stringify(command)) },
      closePalette: (): void => { return ipcRenderer.send('command-palette-close') },
      getPrompt: (id: string): string => { return ipcRenderer.sendSync('command-get-prompt', id) },
      cancel: (): void => { return ipcRenderer.send('command-stop') },
    },
    anywhere: {
      prompt: (text: string): void => { return ipcRenderer.sendSync('anywhere-prompt', JSON.stringify(text)) },
      resize: (height: number): void => { return ipcRenderer.send('anywhere-resize', height) },
      showExperts: (): void => { return ipcRenderer.send('anywhere-show-experts') },
      closeExperts: (): void => { return ipcRenderer.send('anywhere-close-experts') },
      toggleExperts: (): void => { return ipcRenderer.send('anywhere-toggle-experts') },
      isExpertsOpen: (): boolean => { return ipcRenderer.sendSync('anywhere-is-experts-open') },
      onExpert: (expertId: string): void => { return ipcRenderer.sendSync('anywhere-on-expert', JSON.stringify(expertId)) },
      cancel: (): void => { return ipcRenderer.send('anywhere-cancel') },
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
      getText: (id: string): string => { return ipcRenderer.sendSync('readaloud-get-text', id) },
      closePalette: (): void => { return ipcRenderer.send('readaloud-close-palette') },
    },
    transcribe: {
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
      getStatus: (): Promise<any> => { return ipcRenderer.invoke('nestor-get-status') },
      getTools: (): Promise<any[]> => { return ipcRenderer.invoke('nestor-get-tools') },
      callTool: (name: string, parameters: anyDict): Promise<any> => { return ipcRenderer.invoke('nestor-call-tool', { name, parameters }) },
    },
    dropbox: {
      getAuthenticationUrl: (): string => { return ipcRenderer.sendSync('dropbox-get-authentication-url') },
      authenticateWithCode: (code: string): boolean => { return ipcRenderer.sendSync('dropbox-authenticate-with-code', code) },
    }
  },
);
