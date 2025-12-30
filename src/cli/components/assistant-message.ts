// AssistantMessage component - container for assistant message content (tools + text)

import { Component } from './component'
import { Text } from './text'
import { ToolCall } from './toolcall'

export class AssistantMessage extends Component {

  constructor(id?: string) {
    super(id)
  }

  // Add a tool call to this message
  addToolCall(toolId: string, status: string): ToolCall {
    const tool = new ToolCall(toolId, status)
    this.appendChild(tool)
    return tool
  }

  // Add text content to this message
  addText(content: string): Text {
    const text = new Text(content, 'default')
    this.appendChild(text)
    return text
  }

  // Get the last text component (for appending streamed content)
  getLastText(): Text | null {
    for (let i = this.children.length - 1; i >= 0; i--) {
      if (this.children[i] instanceof Text) {
        return this.children[i] as Text
      }
    }
    return null
  }

  // Get all tool calls
  getToolCalls(): ToolCall[] {
    return this.children.filter(c => c instanceof ToolCall) as ToolCall[]
  }

  // Height is sum of children heights + blank lines between + blank line after
  calculateHeight(width: number): number {
    let total = 0
    for (let i = 0; i < this.children.length; i++) {
      total += this.children[i].calculateHeight(width)
      // Add blank line between children (not after last)
      if (i < this.children.length - 1) {
        total += 1
      }
    }
    // Add blank line after the whole message
    if (this.children.length > 0) {
      total += 1
    }
    return total
  }

  render(width: number): string[] {
    const lines: string[] = []

    for (let i = 0; i < this.children.length; i++) {
      const childLines = this.children[i].render(width)
      lines.push(...childLines)

      // Add blank line between children (not after last)
      if (i < this.children.length - 1) {
        lines.push('')
      }
    }

    // Add blank line after the whole message
    if (this.children.length > 0) {
      lines.push('')
    }

    return lines
  }
}
