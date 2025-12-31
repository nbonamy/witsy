// Text component - renders text with word wrapping

import { Component } from './component'
import { grayText } from '../display'

export type TextStyle = 'default' | 'user' | 'assistant' | 'gray'

export class Text extends Component {
  private content: string
  private style: TextStyle
  private cachedLines: string[] = []
  private cachedWidth: number = 0

  constructor(content: string = '', style: TextStyle = 'default', id?: string) {
    super(id)
    this.content = content
    this.style = style
  }

  setContent(content: string): void {
    if (this.content !== content) {
      this.content = content
      this.cachedWidth = 0 // Invalidate cache
      this.markDirty()
    }
  }

  appendContent(content: string): void {
    this.content += content
    this.cachedWidth = 0 // Invalidate cache
    this.markDirty()
  }

  getContent(): string {
    return this.content
  }

  setStyle(style: TextStyle): void {
    if (this.style !== style) {
      this.style = style
      this.markDirty()
    }
  }

  calculateHeight(width: number): number {
    this.ensureCache(width)
    // Content lines + trailing blank for spacing
    return this.cachedLines.length + 1
  }

  render(width: number): string[] {
    this.ensureCache(width)
    const styled = this.applyStyle(this.cachedLines)
    // Add trailing blank for spacing
    styled.push('')
    return styled
  }

  private ensureCache(width: number): void {
    if (this.cachedWidth !== width) {
      this.cachedLines = this.wrapText(this.content, width)
      this.cachedWidth = width
    }
  }

  private applyStyle(lines: string[]): string[] {
    switch (this.style) {
      case 'user':
        // User messages: gray with "> " prefix on first line
        return lines.map((line, i) => {
          if (i === 0) {
            // Replace leading spaces with "> " for first line
            return grayText('> ' + line.slice(2))
          }
          return grayText(line)
        })
      case 'assistant':
        // Assistant messages: "⏺ " prefix on first line
        return lines.map((line, i) => {
          if (i === 0) {
            // Replace leading spaces with "⏺ " for first line
            return '⏺ ' + line.slice(2)
          }
          return line
        })
      case 'gray':
        return lines.map(line => grayText(line))
      default:
        return lines
    }
  }

  // Word-wrap text with padding (based on padContent from display.ts)
  private wrapText(text: string, width: number): string[] {
    const maxLineWidth = width - 4 // Reserve 2 left + 2 right for padding
    const lines: string[] = []

    // Split by existing newlines first (preserve intentional line breaks)
    const paragraphs = text.split('\n')

    for (const paragraph of paragraphs) {
      // Handle empty paragraphs
      if (paragraph === '') {
        lines.push('    ')
        continue
      }

      const words = paragraph.split(' ')
      let currentLine = ''

      for (const word of words) {
        // Skip empty words (from multiple spaces)
        if (word === '') continue

        // If word alone is longer than maxLineWidth, break it
        if (word.length > maxLineWidth) {
          // Flush current line if not empty
          if (currentLine) {
            lines.push(`  ${currentLine.trimEnd()}  `)
            currentLine = ''
          }
          // Break long word into chunks
          for (let i = 0; i < word.length; i += maxLineWidth) {
            lines.push(`  ${word.slice(i, i + maxLineWidth)}  `)
          }
          continue
        }

        // Try adding word to current line
        const testLine = currentLine ? `${currentLine} ${word}` : word

        if (testLine.length <= maxLineWidth) {
          currentLine = testLine
        } else {
          // Line would be too long, flush current line and start new one
          lines.push(`  ${currentLine.trimEnd()}  `)
          currentLine = word
        }
      }

      // Flush remaining line
      if (currentLine) {
        lines.push(`  ${currentLine.trimEnd()}  `)
      }
    }

    // Ensure at least one line
    if (lines.length === 0) {
      lines.push('    ')
    }

    return lines
  }
}
