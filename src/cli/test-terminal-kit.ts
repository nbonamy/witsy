#!/usr/bin/env node

/**
 * witsyInputField Interactive Test
 *
 * Interactive test for witsyInputField with all features
 * Run with: npx tsx src/cli/test-terminal-kit.ts
 */

import terminalKit from 'terminal-kit'
import { witsyInputField } from './witsyInputField'

const term = terminalKit.terminal

async function main() {
  term.clear()

  term.bold.magenta('witsyInputField Interactive Test\n\n')

  term.cyan('Features:\n')
  term.gray('  • Type normally, use backspace, left/right arrows, HOME/END\n')
  term.gray('  • UP at position 0 on first line → navigate history backward\n')
  term.gray('  • DOWN at end on last line → navigate history forward\n')
  term.gray('  • UP/DOWN elsewhere → move cursor up/down (multi-line)\n')
  term.gray('  • ESCAPE twice within 1 second → clear input\n')
  term.gray('  • Type "/" → triggers onTextChange callback (shows "Command detected!")\n')
  term.gray('  • ENTER → submit and add to history\n')
  term.gray('  • Ctrl+C/Ctrl+D → exit with "Goodbye!"\n\n')

  const history: string[] = ['first message', 'second message', 'third message']

  term.yellow('Initial history: ')
  term.gray(`["${history.join('", "')}"]\n\n`)

  const shouldExit = false
  let escapePressed = false
  let escapeTimer: NodeJS.Timeout | null = null

  while (!shouldExit) {
    term('> ')

    try {
      const result = await new Promise<string>((resolve, reject) => {
        witsyInputField.call(term, {
          cancelable: true,
          history: history,
          onTextChange: (text: string, key: string, lineCount: number) => {
            // Detect command
            if (text.startsWith('/')) {
              term.saveCursor()
              term.moveTo(1, term.height)
              term.eraseLine()
              term.yellow(`Command detected! (${lineCount} line${lineCount > 1 ? 's' : ''})`)
              term.restoreCursor()
            } else if (text.length === 0) {
              // Clear the message when text is cleared
              term.saveCursor()
              term.moveTo(1, term.height)
              term.eraseLine()
              term.restoreCursor()
            }
          },
          onSpecialKey: (key: string) => {
            if (key === 'CTRL_C' || key === 'CTRL_D') {
              term('\n')
              term.yellow('Goodbye!\n')
              process.exit(0)
            }
            return false
          },
          onEscape: () => {
            if (escapePressed) {
              // Second escape - resolve with empty string (clears on next iteration)
              if (escapeTimer) {
                clearTimeout(escapeTimer)
                escapeTimer = null
              }
              escapePressed = false

              // Clear the message
              term.saveCursor()
              term.moveTo(1, term.height)
              term.eraseLine()
              term.restoreCursor()

              resolve('')
            } else {
              // First escape - show message
              escapePressed = true
              term.saveCursor()
              term.moveTo(1, term.height)
              term.eraseLine()
              term.yellow('Press Escape again to clear')
              term.restoreCursor()

              // Start 1-second timer
              escapeTimer = setTimeout(() => {
                escapePressed = false
                escapeTimer = null
                term.saveCursor()
                term.moveTo(1, term.height)
                term.eraseLine()
                term.restoreCursor()
              }, 1000)
            }
          },
        }, (error: Error | undefined, input: string) => {
          if (error) {
            reject(error)
          } else {
            resolve(input)
          }
        })
      })

      if (shouldExit) break

      // Reset escape state for next iteration
      escapePressed = false
      if (escapeTimer) {
        clearTimeout(escapeTimer)
        escapeTimer = null
      }

      term('\n')

      if (result && result.trim()) {
        if (!result.startsWith('/')) {
          history.push(result)
        }
      } else {
        term.gray('Empty input, not added to history\n\n')
      }

    } catch (error) {
      // Check if we're exiting due to Ctrl+C/Ctrl+D
      if (shouldExit) {
        break
      }

      term('\n')
      if (error instanceof Error && error.message.includes('force closed')) {
        term.yellow('Exiting...\n')
        break
      } else {
        throw error
      }
    }
  }

  term('\n')
  process.exit(0)
}

main().catch((error) => {
  term.red(`\nError: ${error.message}\n`)
  process.exit(1)
})
