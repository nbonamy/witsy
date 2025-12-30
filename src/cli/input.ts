// Custom input handler using terminal-kit's witsyInputField

import ansiEscapes from 'ansi-escapes'
import terminalKit from 'terminal-kit'
import { clearShortcutHelp, displayShortcutHelp, repositionFooter, resetDisplay, updateFooterRightText } from './display'
import { state } from './state'
import { witsyInputField } from './witsyInputField'

const term = terminalKit.terminal

interface InputOptions {
  prompt: string
}

// Calculate line count correctly - accounts for both explicit newlines and wrapping
const calculateLineCount = (promptText: string, text: string): number => {
  const termWidth = process.stdout.columns || 80

  // Split text into logical lines (by \n)
  const lines = text.split('\n')

  // Calculate total visual lines
  let totalLines = 0

  // First line includes the prompt
  const firstLineLength = promptText.length + (lines[0]?.length || 0) + 1
  totalLines += Math.max(1, Math.ceil(firstLineLength / termWidth))

  // Subsequent lines don't have prompt
  for (let i = 1; i < lines.length; i++) {
    const lineLength = lines[i].length
    totalLines += Math.max(1, Math.ceil(lineLength / termWidth))
  }

  return totalLines
}

export async function promptInput(options: InputOptions): Promise<string> {

  return new Promise((resolve, reject) => {

    term.getCursorLocation((error, x, y) => {

      // State
      let previousLineCount = 1
      let escapePressed = false
      let escapeTimer: NodeJS.Timeout | null = null
      let controller: any = null
      const initialInputY = y
      let helpShowing = false

      // Show prompt
      const promptText = options.prompt
      process.stdout.write(promptText)

      // Helper: handle resize - just abort and let main loop restart fresh
      const handleResize = () => {
        cleanup()
        process.stdout.write(ansiEscapes.clearTerminal)
        resolve('')  // Empty string triggers resetDisplay() + continue in main loop
      }

      // Helper: cleanup
      const cleanup = () => {
        if (escapeTimer) {
          clearTimeout(escapeTimer)
          escapeTimer = null
        }
        process.stdout.removeListener('resize', handleResize)
        if (controller && typeof controller.abort === 'function') {
          controller.abort()
        }
      }

      // Add resize listener
      process.stdout.on('resize', handleResize)

      // Call witsyInputField
      controller = witsyInputField.call(term, {

        cancelable: true,
        history: state.cliConfig?.history || [],
        debug: state.debug,

        onCharacter: (char: string, text: string) => {
          // Clear help on any key press (if help is showing)
          if (helpShowing) {
            // Pass current text (character hasn't been inserted yet)
            clearShortcutHelp(initialInputY, previousLineCount, text)
            helpShowing = false
          }

          // If '?' pressed on empty prompt, show help and prevent character insertion
          if (char === '?' && text === '') {
            displayShortcutHelp(initialInputY, previousLineCount)
            helpShowing = true
            return true // Prevent default (don't insert the '?')
          }

          return false // Allow default behavior
        },

        onTextChange: (text: string) => {

          // Calculate line count ourselves
          const calculatedLineCount = calculateLineCount(promptText, text)

          // ONLY update when line count changes
          if (calculatedLineCount !== previousLineCount) {
            repositionFooter(initialInputY, previousLineCount, calculatedLineCount, text)
            previousLineCount = calculatedLineCount
          } else if (state.chat.messages.length === 0) {
            // If no messages, update footer to show/hide shortcuts hint based on input
            updateFooterRightText(initialInputY, previousLineCount, undefined, text)
          }

          // When "/" typed, immediately trigger command selector
          if (text === '/') {
            cleanup()
            resolve('/')
          }
        },

        onSpecialKey: (key: string) => {
          // Handle Ctrl+C (always exit) and Ctrl+D (clear or exit based on history)
          if (key === 'CTRL_C') {
            cleanup()
            resolve('__CTRL_C__')
            return true // Prevent default
          }
          if (key === 'CTRL_D') {
            cleanup()
            resolve('__CTRL_D__')
            return true // Prevent default
          }

          return false // Allow default behavior
        },

        onEscape: (text: string) => {
          // If input is empty, nothing to clear - ignore escape
          if (text.length === 0) {
            return
          }

          // ESCAPE double-tap logic
          if (escapePressed) {
            // Second escape - clear terminal and redraw everything
            escapePressed = false

            // Cleanup
            cleanup()

            // Clear terminal and redraw
            resetDisplay()
            resolve('')

          } else {
            // First escape - show message
            escapePressed = true
            updateFooterRightText(initialInputY, previousLineCount, 'Press Escape again to clear', text)

            // Start 1-second timer
            escapeTimer = setTimeout(() => {
              escapePressed = false
              escapeTimer = null
              updateFooterRightText(initialInputY, previousLineCount, undefined, text)
            }, 1000)
          }
        },
      }, (error: Error | undefined, input: string) => {

        // Cleanup
        cleanup()

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
