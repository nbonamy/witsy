// UserMessage component - container for user message content

import { Component } from './component'
import { Text } from './text'

export class UserMessage extends Component {
  private textComponent: Text

  constructor(content: string, id?: string) {
    super(id)
    this.textComponent = new Text(content, 'user')
    this.appendChild(this.textComponent)
  }

  setContent(content: string): void {
    this.textComponent.setContent(content)
  }

  getContent(): string {
    return this.textComponent.getContent()
  }

  // Height is text height + 1 blank line after
  calculateHeight(width: number): number {
    return this.textComponent.calculateHeight(width) + 1
  }

  render(width: number): string[] {
    const lines = this.textComponent.render(width)
    // Add blank line after message
    lines.push('')
    return lines
  }
}
