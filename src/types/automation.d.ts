
declare module 'applescript'

export interface ShortcutCallbacks {
  chat: () => void
  command: () => void
  anywhere: () => void
  readaloud: () => void
  transcribe: () => void
  scratchpad: () => void
}

export interface Automator {
  getForemostApp(): Promise<string>
  selectAll(): Promise<void>
  moveCaretBelow(): Promise<void>
  copySelectedText(): Promise<void>
  pasteText(): Promise<void>
}

export interface RunCommandResponse {
  text: string
  prompt: string|null
  response: string|null
  chatWindow: BrowserWindow | null
  cancelled: boolean
}
