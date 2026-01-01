// AssistantMessage component - container for assistant message content (tools + text)

import { Component } from './component'
import { Text } from './text'
import { ToolCall } from './toolcall'

export class AssistantMessage extends Component {

  constructor() {
    super()
  }

  // Add a tool call to this message
  addToolCall(toolId: string, status: string): ToolCall {
    const tool = new ToolCall(status)
    tool.setId(toolId)
    this.appendChild(tool)
    return tool
  }

  // Add text content to this message
  addText(content: string): Text {
    const text = new Text(content, 'assistant')
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

  // Height is sum of children heights (each child includes its own trailing blank)
  calculateHeight(width: number): number {
    let total = 0
    for (const child of this.children) {
      total += child.calculateHeight(width)
    }
    return total
  }

  render(width: number): string[] {
    const lines: string[] = []
    for (const child of this.children) {
      lines.push(...child.render(width))
    }
    return lines
  }
}
