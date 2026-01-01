// Footer component - separator line and status

import { Component } from './component'
import { secondaryText, grayText } from '../display'
import { state } from '../state'

export class Footer extends Component {
  private customLeftText: string | null = null
  private customRightText: string | null = null
  private inputText: string = ''

  constructor() {
    super()
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

  // Footer is always 2 lines: separator + status
  calculateHeight(): number {
    return 2
  }

  render(width: number): string[] {
    const separator = secondaryText('─'.repeat(width))

    const leftText = this.computeLeftText()
    const rightText = this.computeRightText()
    const padding = Math.max(0, width - leftText.length - rightText.length - 4)
    const statusLine = grayText('  ' + leftText + ' '.repeat(padding) + rightText + '  ')

    return [separator, statusLine]
  }
}
