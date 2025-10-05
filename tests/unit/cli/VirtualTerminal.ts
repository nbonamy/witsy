/**
 * Virtual Terminal - Simulates a terminal for testing CLI output
 *
 * This class maintains terminal state (screen content, cursor position)
 * and handles ANSI escape codes to verify REQUIREMENTS rather than
 * implementation details.
 */

export class VirtualTerminal {
  private screen: string[][]
  private cursor: { row: number; col: number }
  private savedCursor: { row: number; col: number } | null = null
  private width: number
  private height: number

  constructor(width: number = 80, height: number = 24) {
    this.width = width
    this.height = height
    this.cursor = { row: 0, col: 0 }
    this.screen = Array(height).fill(null).map(() => Array(width).fill(' '))
  }

  /**
   * Write text to terminal, handling ANSI escape codes
   */
  write(text: string | Buffer): void {
    const str = text.toString()
    let i = 0

    while (i < str.length) {
      // Check for ANSI escape sequence
      if (str[i] === '\x1B' && str[i + 1] === '[') {
        // Look for the end of the escape sequence
        const endings = ['m', 'A', 'B', 'G', 'K', 'J', 's', 'u']
        let escapeEnd = -1

        for (const ending of endings) {
          const idx = str.indexOf(ending, i + 2)
          if (idx !== -1 && (escapeEnd === -1 || idx < escapeEnd)) {
            escapeEnd = idx
          }
        }

        if (escapeEnd !== -1) {
          const escapeSeq = str.substring(i, escapeEnd + 1)
          this.handleEscape(escapeSeq)
          i = escapeEnd + 1
          continue
        }
      }

      // Handle special characters
      if (str[i] === '\n') {
        this.cursor.row++
        this.cursor.col = 0
        if (this.cursor.row >= this.height) {
          // Scroll up
          this.screen.shift()
          this.screen.push(Array(this.width).fill(' '))
          this.cursor.row = this.height - 1
        }
        i++
        continue
      }

      if (str[i] === '\r') {
        this.cursor.col = 0
        i++
        continue
      }

      // Regular character
      // Check if we need to wrap BEFORE writing
      if (this.cursor.col >= this.width) {
        // Auto-wrap to next line
        this.cursor.col = 0
        this.cursor.row++
        if (this.cursor.row >= this.height) {
          this.screen.shift()
          this.screen.push(Array(this.width).fill(' '))
          this.cursor.row = this.height - 1
        }
      }

      // Now write the character
      if (this.cursor.row < this.height && this.cursor.col < this.width) {
        this.screen[this.cursor.row][this.cursor.col] = str[i]
      }

      // Move cursor to next position
      this.cursor.col++

      i++
    }
  }

  /**
   * Write text followed by newline (like console.log)
   */
  log(...args: any[]): void {
    const text = args.join(' ')
    this.write(text + '\n')
  }

  /**
   * Clear the entire screen
   */
  clear(): void {
    this.screen = Array(this.height).fill(null).map(() => Array(this.width).fill(' '))
    this.cursor = { row: 0, col: 0 }
  }

  /**
   * Handle ANSI escape codes
   */
  private handleEscape(seq: string): void {
    // Cursor save: \x1B[s
    if (seq === '\x1B[s') {
      this.savedCursor = { ...this.cursor }
      return
    }

    // Cursor restore: \x1B[u
    if (seq === '\x1B[u') {
      if (this.savedCursor) {
        this.cursor = { ...this.savedCursor }
      }
      return
    }

    // Cursor up: \x1B[{n}A
    // eslint-disable-next-line no-control-regex
    const upMatch = seq.match(/\x1B\[(\d*)A/)
    if (upMatch) {
      const n = parseInt(upMatch[1] || '1')
      this.cursor.row = Math.max(0, this.cursor.row - n)
      return
    }

    // Cursor down: \x1B[{n}B
    // eslint-disable-next-line no-control-regex
    const downMatch = seq.match(/\x1B\[(\d*)B/)
    if (downMatch) {
      const n = parseInt(downMatch[1] || '1')
      this.cursor.row = Math.min(this.height - 1, this.cursor.row + n)
      return
    }

    // Cursor to column: \x1B[{col}G (1-based column number)
    // eslint-disable-next-line no-control-regex
    const colMatch = seq.match(/\x1B\[(\d+)G/)
    if (colMatch) {
      const col = parseInt(colMatch[1]) - 1  // Convert 1-based to 0-based
      this.cursor.col = Math.min(this.width - 1, Math.max(0, col))
      return
    }

    // Erase line: \x1B[2K or \x1B[K
    if (seq === '\x1B[2K' || seq === '\x1B[K') {
      for (let col = 0; col < this.width; col++) {
        this.screen[this.cursor.row][col] = ' '
      }
      return
    }

    // Clear screen: \x1B[2J
    if (seq === '\x1B[2J') {
      this.clear()
      return
    }

    // Color codes - ignore (don't affect visible output)
    // eslint-disable-next-line no-control-regex
    if (seq.match(/\x1B\[\d+(;\d+)*m/)) {
      return
    }
  }

  /**
   * Get visible text from screen (strips trailing spaces from each line)
   */
  getVisibleText(): string {
    return this.screen
      .map(row => row.join('').trimEnd())
      .join('\n')
      .trimEnd()
  }

  /**
   * Get a specific line (0-indexed)
   */
  getLine(lineNumber: number): string {
    if (lineNumber < 0 || lineNumber >= this.height) {
      return ''
    }
    return this.screen[lineNumber].join('').trimEnd()
  }

  /**
   * Get cursor position
   */
  getCursorPosition(): { row: number; col: number } {
    return { ...this.cursor }
  }

  /**
   * Count how many separator lines are visible
   */
  countSeparators(): number {
    const separatorPattern = /^─+$/
    return this.screen.filter(row => {
      const line = row.join('').trimEnd()
      return separatorPattern.test(line)
    }).length
  }

  /**
   * Check if text exists anywhere on screen
   */
  contains(text: string): boolean {
    return this.getVisibleText().includes(text)
  }

  /**
   * Assert a specific line matches expected text
   */
  assertLine(lineNumber: number, expected: string): void {
    const actual = this.getLine(lineNumber)
    if (actual !== expected) {
      throw new Error(`Line ${lineNumber} mismatch:\nExpected: "${expected}"\nActual:   "${actual}"`)
    }
  }

  /**
   * Assert cursor is at expected position
   */
  assertCursorAt(row: number, col: number): void {
    if (this.cursor.row !== row || this.cursor.col !== col) {
      throw new Error(`Cursor position mismatch:\nExpected: (${row}, ${col})\nActual:   (${this.cursor.row}, ${this.cursor.col})`)
    }
  }

  /**
   * Debug: print the entire screen
   */
  debug(): void {
    console.error('=== VIRTUAL TERMINAL ===')
    console.error(`Cursor: (${this.cursor.row}, ${this.cursor.col})`)
    console.error('Screen:')
    this.screen.forEach((row, idx) => {
      const line = row.join('').trimEnd()
      console.error(`${idx.toString().padStart(2)}: ${JSON.stringify(line)}`)
    })
    console.error('========================')
  }
}
