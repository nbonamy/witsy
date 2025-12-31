// Separator component - horizontal line

import { Component } from './component'
import { secondaryText } from '../display'

export class Separator extends Component {

  constructor(id?: string) {
    super(id)
  }

  // Separator is always 1 line
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  calculateHeight(_width?: number): number {
    return 1
  }

  render(width: number): string[] {
    return [secondaryText('─'.repeat(width))]
  }
}
