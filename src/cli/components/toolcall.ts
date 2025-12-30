// ToolCall component - displays tool execution with animation

import chalk from 'chalk'
import { Component } from './component'
import { secondaryText, successText, errorText } from '../display'

// Pulsating animation frames for tool execution
const ANIMATION_FRAMES = [
  '⋅',
  '∘',
  '○',
  '◯',
  '⊙',
  '◉',
  '⊙',
  '◯',
  '○',
  '∘',
]

export type ToolState = 'running' | 'completed' | 'error'

export class ToolCall extends Component {
  private status: string
  private state: ToolState = 'running'
  private animationFrame: number = 0

  constructor(id: string, status: string) {
    super(id)
    this.status = status
  }

  updateStatus(status: string): void {
    if (this.status !== status) {
      this.status = status
      this.markDirty()
    }
  }

  getStatus(): string {
    return this.status
  }

  complete(state: 'completed' | 'error', finalStatus?: string): void {
    this.state = state
    if (finalStatus !== undefined) {
      this.status = finalStatus
    }
    this.markDirty()
  }

  isCompleted(): boolean {
    return this.state !== 'running'
  }

  getState(): ToolState {
    return this.state
  }

  // Advance animation frame (called by animation interval)
  advanceAnimation(): void {
    if (!this.isCompleted()) {
      this.animationFrame = (this.animationFrame + 1) % ANIMATION_FRAMES.length
      this.markDirty()
    }
  }

  calculateHeight(): number {
    // Count lines in status
    return this.status.split('\n').length
  }

  render(width: number): string[] {
    const lines = this.status.split('\n')
    const result: string[] = []

    const prefix = this.getPrefix()

    lines.forEach((line, i) => {
      if (i === 0) {
        // First line: prefix + bold tool name (before the "(")
        const parenIndex = line.indexOf('(')
        if (parenIndex > 0) {
          const toolName = line.substring(0, parenIndex)
          const rest = line.substring(parenIndex)
          result.push(`${prefix} ${chalk.bold(toolName)}${rest}`)
        } else {
          result.push(`${prefix} ${line}`)
        }
      } else {
        // Detail lines: gray, truncated to terminal width
        const maxLen = width - 1 // Leave 1 char margin
        const truncated = line.length > maxLen ? line.substring(0, maxLen - 1) + '…' : line
        result.push(chalk.rgb(164, 164, 164)(truncated))
      }
    })

    return result
  }

  private getPrefix(): string {
    switch (this.state) {
      case 'completed':
        return successText('⏺')
      case 'error':
        return errorText('⏺')
      default:
        return secondaryText(ANIMATION_FRAMES[this.animationFrame])
    }
  }
}
