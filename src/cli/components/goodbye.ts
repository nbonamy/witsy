// Goodbye component - displays farewell message on exit

import chalk from 'chalk'
import { Component } from './component'

export class Goodbye extends Component {
  constructor() {
    super()
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  calculateHeight(_width?: number): number {
    return 3  // Blank line + message
  }

  render(): string[] {
    return [
      '',
      chalk.yellow('  Goodbye! 👋'),
      '',
    ]
  }
}
