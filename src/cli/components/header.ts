// Header component - displays logo and version info

import chalk from 'chalk'
import { Component } from './component'
import { primaryText, grayText } from '../display'

// Version is injected at build time via esbuild define
declare const __WITSY_VERSION__: string
const VERSION = typeof __WITSY_VERSION__ !== 'undefined' ? __WITSY_VERSION__ : 'dev'

export class Header extends Component {
  private port: number

  constructor(port: number) {
    super()
    this.port = port
  }

  setPort(port: number): void {
    if (this.port !== port) {
      this.port = port
      this.markDirty()
    }
  }

  // Header is 5 lines (blank + 3 logo lines + trailing blank for spacing)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  calculateHeight(_width?: number): number {
    return 5
  }

  render(): string[] {
    return [
      '',
      `${primaryText('  ██  █  ██')}  ${chalk.bold('Witsy CLI')} ${grayText('v' + VERSION)}`,
      `${primaryText('  ██ ███ ██')}  ${grayText('AI Assistant · Command Line Interface')}`,
      `${primaryText('   ███ ███')}   ${grayText(`http://localhost:${this.port}`)}`,
      '', // Trailing blank for spacing
    ]
  }
}
