// Custom input handler using terminal-kit's witsyInputField

import terminalKit from 'terminal-kit'
import ansiEscapes from 'ansi-escapes'
import { repositionFooter, updateFooterRightText, displayHeader, displayConversation, displayFooter } from './display'
import { state } from './state'
import { witsyInputField } from './witsyInputField'

const term = terminalKit.terminal

interface InputOptions {
  message: string
  defaultText?: string
}

export async function promptInput(options: InputOptions): Promise<string> {
  return new Promise((resolve, reject) => {
    // State
    let previousLineCount = 1
    let escapePressed = false
    let escapeTimer: NodeJS.Timeout | null = null
    let controller: any = null

    const startInputField = () => {
      // Show prompt
      process.stdout.write(options.message + ' ')

      // Helper: handle resize
      const handleResize = () => {
        // Clear terminal and redraw everything
        process.stdout.write(ansiEscapes.clearTerminal)
        displayHeader()
        displayConversation()
        displayFooter()

        // controller.redraw() will handle redrawing the input
        if (controller) {
          controller.redraw()
        }
      }

      // Add resize listener
      process.stdout.on('resize', handleResize)

      // Call witsyInputField
      controller = witsyInputField.call(term, {
        cancelable: true,
        history: state.cliConfig?.history || [],

        onTextChange: (text: string, _key: string, lineCount: number) => {
          // Track line count changes for footer positioning
          if (lineCount !== previousLineCount) {
            const delta = lineCount - previousLineCount
            repositionFooter(delta)
            previousLineCount = lineCount
          }

          // When "/" typed, immediately trigger command selector
          if (text === '/') {
            resolve('/')
          }
        },

        onSpecialKey: (key: string) => {
          // Handle Ctrl+C / Ctrl+D
          if (key === 'CTRL_C' || key === 'CTRL_D') {
            reject(new Error('User force closed the prompt'))
            return true // Prevent default
          }

          return false // Allow default behavior
        },

        onEscape: () => {
          // ESCAPE double-tap logic
          if (escapePressed) {
            // Second escape - clear terminal and redraw everything
            if (escapeTimer) {
              clearTimeout(escapeTimer)
              escapeTimer = null
            }
            escapePressed = false

            // Clear terminal and redraw
            process.stdout.write(ansiEscapes.clearTerminal)
            displayHeader()
            displayConversation()
            displayFooter()

            // Resolve empty to start fresh input
            resolve('')
          } else {
            // First escape - show message
            escapePressed = true
            updateFooterRightText('Press Escape again to clear', previousLineCount)

            // Start 1-second timer
            escapeTimer = setTimeout(() => {
              escapePressed = false
              escapeTimer = null
              updateFooterRightText(`${state.history.length} messages`, previousLineCount)
            }, 1000)
          }
        },
      }, (error: Error | undefined, input: string) => {
        // Cleanup
        if (escapeTimer) {
          clearTimeout(escapeTimer)
        }
        process.stdout.removeListener('resize', handleResize)

        // Resolve/reject
        if (error) {
          reject(error)
        } else {
          resolve(input)
        }
      })
    }

    // Drain stdin to clear any leftover escape sequences before starting
    if (process.stdin.isTTY && process.stdin.readable) {
      const drainListener = () => { /* discard */ }
      process.stdin.on('data', drainListener)

      setTimeout(() => {
        process.stdin.removeListener('data', drainListener)
        startInputField()
      }, 50)
    } else {
      startInputField()
    }
  })
}
