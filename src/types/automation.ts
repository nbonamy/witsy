
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
}

export interface Automator {
  getForemostAppId(): Promise<string|null>
  getForemostAppPath(): Promise<string|null>
  selectAll(): Promise<void>
  moveCaretBelow(): Promise<void>
  copySelectedText(): Promise<void>
  pasteText(): Promise<void>
}

export type RunCommandParams = {
  textId: string
  sourceApp: string | null
  command: Command
}
