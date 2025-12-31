// Custom input handler using terminal-kit's witsyInputField

import ansiEscapes from 'ansi-escapes'
import terminalKit from 'terminal-kit'
import { resetDisplay } from './display'
import { state } from './state'
import { inputEvents, DOUBLE_ESCAPE_DELAY } from './events'
import {
  getTree,
  Prompt,
} from './tree'
import { witsyInputField } from './witsyInputField'

const term = terminalKit.terminal

interface InputOptions {
  prompt?: string  // Custom prompt (if not using Prompt component)
}

export async function promptInput(options: InputOptions = {}): Promise<string> {

  return new Promise((resolve, reject) => {

    term.getCursorLocation(() => {

      // State
      let escapePressed = false
      let escapeTimer: NodeJS.Timeout | null = null
      let controller: any = null

      // If custom prompt provided, write it (for command dialogs)
      if (options.prompt) {
        process.stdout.write(options.prompt)
      }

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
          // Emit keydown event - if consumed, prevent default
          const consumed = inputEvents.emit({ type: 'keydown', key: char, text })
          return consumed
        },

        onTextChange: (text: string) => {
          // Notify prompt of input change - it will notify tree if height changed
          const tree = getTree()
          const prompt = tree.find('prompt') as Prompt | null
          const termWidth = process.stdout.columns || 80
          prompt?.onInputChange(text, termWidth)

          // Emit keyup event so components can react to text changes
          inputEvents.emit({ type: 'keyup', key: '', text })

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
          // Emit keydown for ESCAPE so components can react
          inputEvents.emit({ type: 'keydown', key: 'ESCAPE', text })

          // If input is empty, nothing to clear - ignore escape
          if (text.length === 0) {
            return
          }

          // ESCAPE double-tap state machine
          if (escapePressed) {
            // Second escape within timeout - clear input
            escapePressed = false
            if (escapeTimer) {
              clearTimeout(escapeTimer)
              escapeTimer = null
            }

            // Emit input-cleared event
            inputEvents.emit({ type: 'input-cleared', key: '', text: '' })

            // Cleanup and resolve
            cleanup()
            resetDisplay()
            resolve('')

          } else {
            // First escape - start timeout
            escapePressed = true
            escapeTimer = setTimeout(() => {
              escapePressed = false
              escapeTimer = null
            }, DOUBLE_ESCAPE_DELAY)
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
