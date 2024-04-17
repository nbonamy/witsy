
declare module 'applescript'

export interface ShortcutCallbacks {
  chat: () => void
  command: () => void
}

export interface Automator {
  selectAll(): Promise<void>
  moveCaretBelow(): Promise<void>
  copySelectedText(): Promise<void>
  pasteText(): Promise<void>
}
