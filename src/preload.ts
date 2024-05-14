// See the Electron documentation for details on how to use preload scripts:
// https://www.electronjs.org/docs/latest/tutorial/process-model#preload-scripts

import { Chat, Command, Prompt, strDict } from './types/index.d';
import { Configuration } from './types/config.d';
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
      pick: (opts: any): string|strDict => { return ipcRenderer.sendSync('pick-file', JSON.stringify(opts)) },
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
    },
    prompts: {
      load: (): Prompt[] => { return JSON.parse(ipcRenderer.sendSync('load-prompts')) },
      save: (data: Prompt[]) => { return ipcRenderer.send('save-prompts', JSON.stringify(data)) },
    },
    markdown: {
      render: (markdown: string): string => { return ipcRenderer.sendSync('render-markdown', markdown) },
    },
    interpreter: {
      python: (code: string): string => { return ipcRenderer.sendSync('run-python-code', code) },
    }
  },
);
