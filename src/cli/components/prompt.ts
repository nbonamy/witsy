// Prompt component - wrapper for input field area
// Note: The actual input is rendered by witsyInputField, this component
// tracks the height/position for the layout system and notifies tree of changes

import { Component } from './component'

export class Prompt extends Component {
  private promptText: string
  private lineCount: number = 1

  constructor(promptText: string = '> ') {
    super()
    this.promptText = promptText
  }

  setPromptText(text: string): void {
    this.promptText = text
    this.markDirty()
  }

  getPromptText(): string {
    return this.promptText
  }

  getLineCount(): number {
    return this.lineCount
  }

  // Called when input text changes - calculates new height and notifies tree if changed
  // Returns true if height changed
  onInputChange(inputText: string, termWidth: number): boolean {
    const newLineCount = this.calculateInputLineCount(inputText, termWidth)

    if (newLineCount !== this.lineCount) {
      const oldHeight = this.lineCount
      this.lineCount = newLineCount
      // Notify tree of size change - tree will re-render from here down
      this.notifySizeChange(oldHeight, newLineCount)
      return true
    }

    return false
  }

  // Calculate line count based on input text
  private calculateInputLineCount(inputText: string, termWidth: number): number {
    const lines = inputText.split('\n')
    let totalLines = 0

    // First line includes the prompt
    const firstLineLength = this.promptText.length + (lines[0]?.length || 0) + 1
    totalLines += Math.max(1, Math.ceil(firstLineLength / termWidth))

    // Subsequent lines don't have prompt
    for (let i = 1; i < lines.length; i++) {
      const lineLength = lines[i].length
      totalLines += Math.max(1, Math.ceil(lineLength / termWidth))
    }

    return totalLines
  }

  // Height is the current line count (dynamic based on input)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  calculateHeight(_width?: number): number {
    return this.lineCount
  }

  // Render just returns the prompt text for the first line
  // The actual input is rendered by witsyInputField externally
  render(): string[] {
    const lines: string[] = [this.promptText]
    // Add empty lines for any additional wrapped lines
    for (let i = 1; i < this.lineCount; i++) {
      lines.push('')
    }
    return lines
  }
}
