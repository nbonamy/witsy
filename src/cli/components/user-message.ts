// UserMessage component - container for user message content

import { Component } from './component'
import { Text } from './text'

export class UserMessage extends Component {
  private textComponent: Text

  constructor(content: string) {
    super()
    this.textComponent = new Text(content, 'user')
    this.appendChild(this.textComponent)
  }

  setContent(content: string): void {
    this.textComponent.setContent(content)
  }

  getContent(): string {
    return this.textComponent.getContent()
  }

  // Height is just text height (Text includes its own trailing blank)
  calculateHeight(width: number): number {
    return this.textComponent.calculateHeight(width)
  }

  render(width: number): string[] {
    return this.textComponent.render(width)
  }
}
