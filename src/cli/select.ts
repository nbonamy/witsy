// Custom select prompt for CLI

import * as readline from 'readline'
import { Writable } from 'stream'
import chalk from 'chalk'
import ansiEscapes from 'ansi-escapes'

interface SelectChoice<T = string> {
  name: string
  value: T
}

interface SelectOptions<T> {
  title: string
  choices: SelectChoice<T>[]
  pageSize?: number
}

export async function selectOption<T = string>(options: SelectOptions<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    const pageSize = options.pageSize || 8
    const grayText = chalk.rgb(139, 148, 156)
    const highlightColor = chalk.rgb(180, 142, 238)

    // Create a null stream to prevent readline from echoing
    const nullStream = new Writable({
      write(_chunk: any, _encoding: any, callback: any) {
        callback()
      }
    })

    // Create interface with terminal mode
    const rl = readline.createInterface({
      input: process.stdin,
      output: nullStream,
      terminal: true,
      escapeCodeTimeout: 0
    })

    // Enable keypress events
    readline.emitKeypressEvents(process.stdin, rl)
    if (process.stdin.isTTY) {
      process.stdin.setRawMode(true)
    }

    let selectedIndex = 0
    let topIndex = 0
    let isFirstRender = true
    let lastRenderedLines = 0

    const render = () => {
      // Move cursor back to start position (except for first render)
      if (!isFirstRender && lastRenderedLines > 0) {
        process.stdout.write(ansiEscapes.cursorUp(lastRenderedLines))
      }
      isFirstRender = false

      // Clear from cursor down
      process.stdout.write(ansiEscapes.cursorTo(0))
      process.stdout.write(ansiEscapes.eraseDown)

      // Count lines we're about to render
      let lineCount = 0

      // Display title with navigation hint if multiple pages
      if (options.choices.length > pageSize) {
        console.log(chalk.cyan(`? ${options.title}`) + grayText(' (Use arrow keys to navigate)'))
      } else {
        console.log(chalk.cyan(`? ${options.title}`))
      }
      lineCount++

      // Empty line after title
      console.log()
      lineCount++

      // Calculate visible range
      const visibleChoices = options.choices.slice(topIndex, topIndex + pageSize)

      // Display choices
      for (let i = 0; i < visibleChoices.length; i++) {
        const actualIndex = topIndex + i
        const choice = visibleChoices[i]
        const isSelected = actualIndex === selectedIndex

        const prefix = isSelected ? highlightColor('  › ') : '    '
        const text = isSelected
          ? highlightColor(choice.name)
          : grayText(choice.name)

        console.log(prefix + text)
        lineCount++
      }

      lastRenderedLines = lineCount
    }

    // Initial render
    render()

    // Handle keypresses
    process.stdin.on('keypress', (_char: string, key: any) => {
      if (!key) return

      // Handle Ctrl+C and Ctrl+D
      if (key.ctrl && (key.name === 'c' || key.name === 'd')) {
        rl.close()
        reject(new Error('User cancelled'))
        return
      }

      // Handle Escape
      if (key.name === 'escape') {
        rl.close()
        reject(new Error('User cancelled'))
        return
      }

      // Handle arrow keys
      if (key.name === 'up') {
        const prevIndex = selectedIndex
        selectedIndex = (selectedIndex - 1 + options.choices.length) % options.choices.length

        // Adjust topIndex if selection goes above visible window
        if (selectedIndex < topIndex) {
          topIndex = selectedIndex
        }

        // Handle wrap-around from top to bottom
        if (prevIndex === 0 && selectedIndex === options.choices.length - 1) {
          // Moved from first to last - show last page
          topIndex = Math.max(0, options.choices.length - pageSize)
        }

        render()
        return
      }

      if (key.name === 'down') {
        const prevIndex = selectedIndex
        selectedIndex = (selectedIndex + 1) % options.choices.length

        // Adjust topIndex if selection goes below visible window
        if (selectedIndex >= topIndex + pageSize) {
          topIndex = selectedIndex - pageSize + 1
        }

        // Handle wrap-around from bottom to top
        if (prevIndex === options.choices.length - 1 && selectedIndex === 0) {
          // Moved from last to first - show first page
          topIndex = 0
        }

        render()
        return
      }

      // Handle Enter
      if (key.name === 'return' || key.name === 'enter') {
        const selected = options.choices[selectedIndex]

        // Move cursor back to start and clear the selector display
        if (lastRenderedLines > 0) {
          process.stdout.write(ansiEscapes.cursorUp(lastRenderedLines))
        }
        process.stdout.write(ansiEscapes.cursorTo(0))
        process.stdout.write(ansiEscapes.eraseDown)

        rl.close()
        resolve(selected.value)
        return
      }
    })

    // Clean up on close
    rl.on('close', () => {
      if (process.stdin.isTTY) {
        process.stdin.setRawMode(false)
      }
      process.stdin.removeAllListeners('keypress')
    })
  })
}
