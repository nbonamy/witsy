// Empty component - blank lines for spacing

import { Component } from './component'

export class Empty extends Component {
  private lines: number

  constructor(lines: number = 1, id?: string) {
    super(id ?? 'empty')
    this.lines = lines
  }

  setLines(lines: number): void {
    if (this.lines !== lines) {
      this.lines = lines
      this.markDirty()
    }
  }

  calculateHeight(): number {
    return this.lines
  }

  render(): string[] {
    return Array(this.lines).fill('')
  }
}
