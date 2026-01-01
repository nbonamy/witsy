// StatusText component - bottom status line with model info and message count

import { Component } from './component'
import { grayText } from '../display'
import { state } from '../state'
import { inputEvents, InputEvent, DOUBLE_ESCAPE_DELAY } from '../events'

export class StatusText extends Component {
  private customLeftText: string | null = null
  private customRightText: string | null = null
  private inputText: string = ''
  private showingHelp: boolean = false
  private escapeMessageTimer: NodeJS.Timeout | null = null

  constructor() {
    super()
    // Subscribe to input events
    inputEvents.subscribe(this.handleInputEvent.bind(this))
  }

  // Clear the escape message timer
  private clearEscapeTimer(): void {
    if (this.escapeMessageTimer) {
      clearTimeout(this.escapeMessageTimer)
      this.escapeMessageTimer = null
    }
  }

  // Handle input events - returns true to consume the event
  private handleInputEvent(event: InputEvent): boolean | void {
    // Track input text from keyup events
    if (event.type === 'keyup') {
      if (this.inputText !== event.text) {
        this.inputText = event.text
        this.requestRender()
      }
      return
    }

    // Handle input-cleared - hide escape message immediately
    if (event.type === 'input-cleared') {
      this.clearEscapeTimer()
      this.customRightText = null
      this.inputText = ''
      this.requestRender()
      return
    }

    // Only handle keydown events below
    if (event.type !== 'keydown') return

    // ESCAPE with text - show "Press Escape again" message
    if (event.key === 'ESCAPE' && event.text !== '') {
      this.clearEscapeTimer()
      this.customRightText = 'Press Escape again to clear'
      this.requestRender()

      // Start timer to hide message
      this.escapeMessageTimer = setTimeout(() => {
        this.escapeMessageTimer = null
        this.customRightText = null
        this.requestRender()
      }, DOUBLE_ESCAPE_DELAY)
      return
    }

    // Show help on '?' when input is empty
    if (event.key === '?' && event.text === '') {
      this.showingHelp = true
      this.requestRender()
      return true // consume the '?' - don't display it
    }

    // Hide help on any other key (but don't consume)
    if (this.showingHelp) {
      this.showingHelp = false
      this.requestRender()
    }
  }

  // Set custom left text (overrides auto-computed)
  setLeftText(text: string | null): void {
    if (this.customLeftText !== text) {
      this.customLeftText = text
      this.markDirty()
    }
  }

  // Set custom right text (overrides auto-computed)
  setRightText(text: string | null): void {
    if (this.customRightText !== text) {
      this.customRightText = text
      this.markDirty()
    }
  }

  // Update input text (affects right text computation)
  setInputText(text: string): void {
    if (this.inputText !== text) {
      this.inputText = text
      this.markDirty()
    }
  }

  // Compute left text from state
  private computeLeftText(): string {
    if (this.customLeftText !== null) {
      return this.customLeftText
    }
    return state.engine && state.model
      ? `${state.engine.name} · ${state.model.name}`
      : '[connecting…]'
  }

  // Compute right text from state
  private computeRightText(): string {
    if (this.customRightText !== null) {
      return this.customRightText
    }

    if (state.chat.messages.length === 0) {
      if (this.inputText && this.inputText.length > 0) {
        return ''
      }
      return '? for shortcuts'
    }

    const msgCount = `${state.chat.messages.length} messages`

    if (state.chat.uuid) {
      return `${msgCount} · auto-saving`
    } else if (state.chat.messages.length >= 4) {
      return `${msgCount} · type /save`
    } else {
      return msgCount
    }
  }

  getLeftText(): string {
    return this.computeLeftText()
  }

  getRightText(): string {
    return this.computeRightText()
  }

  // Height depends on whether help is showing
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  calculateHeight(_width?: number): number {
    return this.showingHelp ? 2 : 1
  }

  render(width: number): string[] {

    if (this.showingHelp) {
      const col1Width = 25
      const col2Width = 30
      const helpLine1 = grayText('  ' + '/ for commands'.padEnd(col1Width) + 'double tap esc to clear input'.padEnd(col2Width))
      const helpLine2 = grayText('  ' + ''.padEnd(col1Width) + 'shift + ⏎ for newline'.padEnd(col2Width))
      return [ helpLine1, helpLine2 ]
    }

    const leftText = this.computeLeftText()
    const rightText = this.computeRightText()
    const padding = Math.max(0, width - leftText.length - rightText.length - 4)
    const statusLine = grayText('  ' + leftText + ' '.repeat(padding) + rightText + '  ')
    return [statusLine]

  }
}
