// See the Electron documentation for details on how to use preload scripts:
// https://www.electronjs.org/docs/latest/tutorial/process-model#preload-scripts

import { Chat, Command, Expert, strDict } from './types/index.d';
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
      get(key: string, fallback: any): any { return ipcRenderer.sendSync('get-store-value', { key, fallback }) },
      set(key: string, value: any): void { return ipcRenderer.send('set-store-value', { key, value }) },
    },
    runAtLogin: {
      get: (): boolean => { return ipcRenderer.sendSync('get-run-at-login').openAtLogin },
      set: (state: boolean): void => { return ipcRenderer.send('set-run-at-login', state) }
    },
    fullscreen: (state: boolean): void => { return ipcRenderer.send('fullscreen', state) },
    base64: {
      encode: (data: string): string => { return Buffer.from(data).toString('base64') },
      decode: (data: string): string => { return Buffer.from(data, 'base64').toString() },
    },
    file: {
      read: (filepath: string): string => { return ipcRenderer.sendSync('read-file', filepath) },
      save: (opts: any): string => { return ipcRenderer.sendSync('save-file', JSON.stringify(opts)) },
      pick: (opts: any): string|strDict|string[] => { return ipcRenderer.sendSync('pick-file', JSON.stringify(opts)) },
      pickDir: (): string => { return ipcRenderer.sendSync('pick-directory') },
      download: (opts: any): string => { return ipcRenderer.sendSync('download', JSON.stringify(opts)) },
      delete: (filepath: string): void => { return ipcRenderer.send('delete-file', filepath) },
      find: (name: string): string => { return ipcRenderer.sendSync('find-program', name) },
      extractText: (contents: string, format: string): string => { return ipcRenderer.sendSync('get-text-content', contents, format) },
    },
    clipboard: {
      writeText: (text: string): void => { return ipcRenderer.send('clipboard-write-text', text) },
      writeImage: (path: string): void => { return ipcRenderer.send('clipboard-write-image', path) },
    },
    shortcuts: {
      register: (): void => { return ipcRenderer.send('register-shortcuts') },
      unregister: (): void => { return ipcRenderer.send('unregister-shortcuts') },
    },
    config: {
      load: (): Configuration => { return JSON.parse(ipcRenderer.sendSync('load-config')) },
      save: (data: Configuration) => { return ipcRenderer.send('save-config', JSON.stringify(data)) },
    },
    history: {
      load: (): Chat[] => { return JSON.parse(ipcRenderer.sendSync('load-history')) },
      save: (data: Chat[]) => { return ipcRenderer.send('save-history', JSON.stringify(data)) },
    },
    commands: {
      load: (): Command[] => { return JSON.parse(ipcRenderer.sendSync('load-commands')) },
      save: (data: Command[]) => { return ipcRenderer.send('save-commands', JSON.stringify(data)) },
      run: (command: Command): void => { return ipcRenderer.send('run-command', JSON.stringify(command)) },
      cancel: (): void => { return ipcRenderer.send('stop-command') },
      closePalette: (): void => { return ipcRenderer.send('close-command-palette') },
      getPrompt: (id: string): string => { return ipcRenderer.sendSync('get-command-prompt', id) },
      export: (): void => { return ipcRenderer.sendSync('export-commands') },
      import: (): void => { return ipcRenderer.sendSync('import-commands') },
    },
    anywhere: {
      prompt: (text: string): void => { return ipcRenderer.sendSync('prompt-anywhere', JSON.stringify(text)) },
      resize: (height: number): void => { return ipcRenderer.send('anywhere-resize', height) },
      showExperts: (): void => { return ipcRenderer.send('anywhere-show-experts') },
      closeExperts: (): void => { return ipcRenderer.send('anywhere-close-experts') },
      toggleExperts: (): void => { return ipcRenderer.send('anywhere-toggle-experts') },
      isExpertsOpen: (): boolean => { return ipcRenderer.sendSync('anywhere-is-experts-open') },
      onExpert: (expertId: string): void => { return ipcRenderer.sendSync('anywhere-on-expert', JSON.stringify(expertId)) },
      cancel: (): void => { return ipcRenderer.send('anywhere-cancel') },
    },
    experts: {
      load: (): Expert[] => { return JSON.parse(ipcRenderer.sendSync('load-experts')) },
      save: (data: Expert[]): void => { return ipcRenderer.send('save-experts', JSON.stringify(data)) },
      export: (): void => { return ipcRenderer.sendSync('export-experts') },
      import: (): void => { return ipcRenderer.sendSync('import-experts') },
    },
    docrepo: {
      list(): strDict[] { return JSON.parse(ipcRenderer.sendSync('docrepo-list')) },
      create(title: string, embeddingEngine: string, embeddingModel: string): string { return ipcRenderer.sendSync('docrepo-create', { title, embeddingEngine, embeddingModel }) },
      rename(baseId: string, title: string): void { return ipcRenderer.sendSync('docrepo-rename', { baseId, title }) },
      delete(baseId: string): void { return ipcRenderer.sendSync('docrepo-delete', baseId) },
      addDocument(baseId: string, type: string, url: string): void { return ipcRenderer.send('docrepo-add-document', { baseId, type, url }) },
      removeDocument(baseId: string, docId: string): void { return ipcRenderer.sendSync('docrepo-remove-document', { baseId, docId }) },
      query(baseId: string, text: string): DocRepoQueryResponseItem[] { return ipcRenderer.sendSync('docrepo-query', { baseId, text }) },
      isEmbeddingAvailable(engine: string, model: string): boolean { return ipcRenderer.sendSync('docrepo-is-embedding-available', { engine, model }) },
    },
    readaloud: {
      getText: (id: string): string => { return ipcRenderer.sendSync('get-readaloud-text', id) },
      closePalette: (): void => { return ipcRenderer.send('close-readaloud-palette') },
    },
    markdown: {
      render: (markdown: string): string => { return ipcRenderer.sendSync('render-markdown', markdown) },
    },
    interpreter: {
      python: (code: string): string => { return ipcRenderer.sendSync('run-python-code', code) },
    },
    dropbox: {
      getAuthenticationUrl: (): string => { return ipcRenderer.sendSync('dropbox-get-authentication-url') },
      authenticateWithCode: (code: string): boolean => { return ipcRenderer.sendSync('dropbox-authenticate-with-code', code) },
    }
  },
);
