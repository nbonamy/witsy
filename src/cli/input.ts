// Custom input handler using terminal-kit's witsyInputField

import terminalKit from 'terminal-kit'
import { repositionFooter, resetDisplay, updateFooterRightText } from './display'
import { state } from './state'
import { witsyInputField } from './witsyInputField'

const term = terminalKit.terminal

interface InputOptions {
  prompt: string
}

// Calculate line count correctly
const calculateLineCount = (promptText: string, text: string): number => {
  const termWidth = process.stdout.columns || 80
  const totalChars = promptText.length + text.length + 1
  return Math.max(1, Math.ceil(totalChars / termWidth))
}

export async function promptInput(options: InputOptions): Promise<string> {

  return new Promise((resolve, reject) => {

    term.getCursorLocation((error, x, y) => {

      // State
      let previousLineCount = 1
      let escapePressed = false
      let escapeTimer: NodeJS.Timeout | null = null
      let controller: any = null
      const initialCursorY = y

      // Show prompt
      const promptText = options.prompt
      process.stdout.write(promptText)

      // Helper: handle resize
      const handleResize = () => {
        resetDisplay()
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

        onTextChange: (text: string) => {

          // Calculate line count ourselves
          const calculatedLineCount = calculateLineCount(promptText, text)

          // ONLY update when line count changes
          if (calculatedLineCount !== previousLineCount) {
            const delta = calculatedLineCount - previousLineCount
            repositionFooter(delta, calculatedLineCount, initialCursorY)
            previousLineCount = calculatedLineCount
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

            // Cleanup
            process.stdout.removeListener('resize', handleResize)

            // Abort the controller to properly close it
            if (controller && typeof controller.abort === 'function') {
              controller.abort()
            }

            // Clear terminal and redraw
            resetDisplay()
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

    })

  })
  
}
