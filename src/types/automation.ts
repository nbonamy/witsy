
import { Command } from './index'

declare module 'applescript'

export interface ShortcutCallbacks {
  prompt: () => void
  chat: () => void
  command: () => void
  readaloud: () => void
  transcribe: () => void
  scratchpad: () => void
  realtime: () => void
  studio: () => void
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

export type RunCommandParams = {
  textId: string
  sourceApp: string | null
  command: Command
}
