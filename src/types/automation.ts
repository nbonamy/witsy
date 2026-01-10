
import { Command } from './index'

declare module 'applescript'

export interface ShortcutCallbacks {
  prompt: () => void
  chat: () => void
  command: () => void
  readaloud: () => void
  dictation: () => void
  audioBooth: () => void
  scratchpad: () => void
  realtime: () => void
  studio: () => void
  forge: () => void
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
