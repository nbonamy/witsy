// Footer component - separator line and status

import { Component } from './component'
import { secondaryText, grayText } from '../display'

export class Footer extends Component {
  private leftText: string = ''
  private rightText: string = ''

  constructor() {
    super('footer')
  }

  setLeftText(text: string): void {
    if (this.leftText !== text) {
      this.leftText = text
      this.markDirty()
    }
  }

  setRightText(text: string): void {
    if (this.rightText !== text) {
      this.rightText = text
      this.markDirty()
    }
  }

  getLeftText(): string {
    return this.leftText
  }

  getRightText(): string {
    return this.rightText
  }

  // Footer is always 2 lines: separator + status
  calculateHeight(): number {
    return 2
  }

  render(width: number): string[] {
    const separator = secondaryText('─'.repeat(width))

    const padding = Math.max(0, width - this.leftText.length - this.rightText.length - 4)
    const statusLine = grayText('  ' + this.leftText + ' '.repeat(padding) + this.rightText + '  ')

    return [separator, statusLine]
  }
}
