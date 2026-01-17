
import { Command } from './index'

declare module 'applescript'

// Callback for Electron shortcuts (single trigger)
export type ShortcutCallback = () => void

// Callbacks for native shortcuts (down and up events)
export type NativeShortcutCallback = {
  onDown: () => void
  onUp: () => void
}

// Electron shortcut callbacks
export interface ShortcutCallbacks {
  prompt: ShortcutCallback
  chat: ShortcutCallback
  command: ShortcutCallback
  readaloud: ShortcutCallback
  dictation: ShortcutCallback
  audioBooth: ShortcutCallback
  scratchpad: ShortcutCallback
  realtime: ShortcutCallback
  studio: ShortcutCallback
  forge: ShortcutCallback
}

// Native shortcut callbacks (with down/up)
export interface NativeShortcutCallbacks {
  prompt: NativeShortcutCallback
  chat: NativeShortcutCallback
  command: NativeShortcutCallback
  readaloud: NativeShortcutCallback
  dictation: NativeShortcutCallback
  audioBooth: NativeShortcutCallback
  scratchpad: NativeShortcutCallback
  realtime: NativeShortcutCallback
  studio: NativeShortcutCallback
  forge: NativeShortcutCallback
}

export type Application = {
  id: string
  name: string
  path: string
  window: string
}

export interface Automator {
  getForemostApp(): Promise<Application|null>
  selectAll(): Promise<void>
  moveCaretBelow(): Promise<void>
  copySelectedText(): Promise<void>
  deleteSelectedText(): Promise<void>
  pasteText(): Promise<void>
}

export type CommandAction = 'default' | 'copy' | 'insert' | 'replace'

export type RunCommandParams = {
  textId: string
  sourceApp: Application | null
  command: Command
  action: CommandAction
}
