// Custom input handler using readline for multi-line support

import * as readline from 'readline'
import { Writable } from 'stream'
import ansiEscapes from 'ansi-escapes'
import { repositionFooter, updateFooterRightText, displayCommandSuggestions, clearCommandSuggestions, displayHeader, displayConversation, displayFooter } from './display'
import { state } from './state'
import { COMMANDS } from './commands'

interface InputOptions {
  message: string
  defaultText?: string
}

export async function promptInput(options: InputOptions): Promise<string> {
  return new Promise((resolve, reject) => {
    // Create a null stream to prevent readline from echoing
    const nullStream = new Writable({
      write(_chunk: any, _encoding: any, callback: any) {
        callback()
      }
    })

    // Create interface with terminal mode to enable escapeCodeTimeout
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

    let input = ''
    let previousLineCount = 1
    let hasStartedTyping = false
    let escapePressed = false
    let escapeTimer: NodeJS.Timeout | null = null
    let showingSuggestions = false
    let selectedSuggestionIndex = 0
    let filteredCommands: typeof COMMANDS = []
    let suggestionLineCount = 0

    // Show prompt and default text
    process.stdout.write(options.message + ' ')
    if (options.defaultText) {
      process.stdout.write(ansiEscapes.cursorSavePosition)
      process.stdout.write(options.defaultText)
      process.stdout.write(ansiEscapes.cursorRestorePosition)
    }

    // Calculate how many lines the current input takes
    const calculateLineCount = (text: string): number => {
      const terminalWidth = process.stdout.columns || 80
      const promptLength = options.message.length + 1 // message + space
      const totalLength = promptLength + text.length
      return Math.ceil(totalLength / terminalWidth)
    }

    // Update command suggestions based on current input
    const updateCommandSuggestions = (currentInput: string) => {
      // Clear old suggestions
      if (suggestionLineCount > 0) {
        clearCommandSuggestions(suggestionLineCount)
        suggestionLineCount = 0
      }

      // Filter commands
      filteredCommands = COMMANDS.filter(cmd =>
        cmd.name.startsWith(currentInput)
      )

      // Show suggestions if any match
      if (filteredCommands.length > 0) {
        showingSuggestions = true
        selectedSuggestionIndex = Math.min(selectedSuggestionIndex, filteredCommands.length - 1)
        suggestionLineCount = displayCommandSuggestions(filteredCommands, selectedSuggestionIndex)
      } else {
        showingSuggestions = false
        selectedSuggestionIndex = 0
      }
    }

    // Handle terminal resize
    const handleResize = () => {
      // Save whether suggestions were showing
      const wasShowingSuggestions = showingSuggestions

      // Clear suggestions if showing
      if (showingSuggestions) {
        clearCommandSuggestions(suggestionLineCount)
        suggestionLineCount = 0
      }

      // Clear terminal and redraw everything
      process.stdout.write(ansiEscapes.clearTerminal)
      displayHeader()
      displayConversation()

      // Calculate new line count before drawing footer
      const newLineCount = calculateLineCount(input)
      previousLineCount = newLineCount

      // Draw footer positioned for the new line count
      displayFooter()

      // Redraw input - cursor is now at the prompt position
      process.stdout.write(options.message + ' ')
      if (input.length > 0) {
        process.stdout.write(input)
      }

      // If input spans multiple lines, we need to reposition footer
      if (newLineCount > 1) {
        // Move footer down by the extra lines
        const delta = newLineCount - 1
        repositionFooter(delta)
      }

      // Re-show suggestions if they were visible
      if (wasShowingSuggestions && input.startsWith('/')) {
        updateCommandSuggestions(input)
      }
    }

    // Add resize listener
    process.stdout.on('resize', handleResize)

    // Handle each character
    process.stdin.on('keypress', (char: string, key: any) => {
      if (!key) return

      // Handle Ctrl+C and Ctrl+D
      if (key.ctrl && (key.name === 'c' || key.name === 'd')) {
        rl.close()
        reject(new Error('User force closed the prompt'))
        return
      }

      // Handle arrow keys for command navigation
      if (showingSuggestions && (key.name === 'up' || key.name === 'down')) {
        if (key.name === 'up') {
          selectedSuggestionIndex = (selectedSuggestionIndex - 1 + filteredCommands.length) % filteredCommands.length
        } else {
          selectedSuggestionIndex = (selectedSuggestionIndex + 1) % filteredCommands.length
        }

        // Redraw suggestions with new selection
        clearCommandSuggestions(suggestionLineCount)
        suggestionLineCount = displayCommandSuggestions(filteredCommands, selectedSuggestionIndex)
        return
      }

      // Handle Enter
      if (key.name === 'return' || key.name === 'enter') {
        // If showing suggestions, select the highlighted command and execute immediately
        if (showingSuggestions && filteredCommands.length > 0) {
          const selectedCommand = filteredCommands[selectedSuggestionIndex]
          clearCommandSuggestions(suggestionLineCount)
          showingSuggestions = false
          suggestionLineCount = 0

          input = selectedCommand.name

          // Execute immediately
          process.stdout.write('\n')
          rl.close()
          resolve(input)
          return
        }

        // Check for empty input early - erase line, move cursor up and return empty
        if (!input.trim()) {
          process.stdout.write(ansiEscapes.cursorTo(0))
          process.stdout.write(ansiEscapes.eraseLine)
          process.stdout.write(ansiEscapes.cursorUp(1))
          rl.close()
          resolve('')
          return
        }

        // Normal case: write newline and submit
        process.stdout.write('\n')
        rl.close()
        resolve(input)
        return
      }

      // Handle Escape
      if (key.name === 'escape') {
        if (escapePressed) {
          // Second escape - clear input
          if (escapeTimer) {
            clearTimeout(escapeTimer)
            escapeTimer = null
          }

          const oldLineCount = calculateLineCount(input)
          input = ''

          // Move cursor to start position (after prompt)
          const promptLength = options.message.length + 1
          process.stdout.write(ansiEscapes.cursorTo(promptLength))

          // Erase current line from cursor position
          process.stdout.write(ansiEscapes.eraseEndLine)

          // If there were additional lines, erase them
          if (oldLineCount > 1) {
            for (let i = 1; i < oldLineCount; i++) {
              process.stdout.write(ansiEscapes.cursorDown(1))
              process.stdout.write(ansiEscapes.cursorTo(0))
              process.stdout.write(ansiEscapes.eraseLine)
            }
            // Move cursor back to input position
            process.stdout.write(ansiEscapes.cursorUp(oldLineCount - 1))
            process.stdout.write(ansiEscapes.cursorTo(promptLength))
          }

          // Clear suggestions if showing
          if (showingSuggestions) {
            clearCommandSuggestions(suggestionLineCount)
            showingSuggestions = false
            suggestionLineCount = 0
            selectedSuggestionIndex = 0
          }

          // Trigger footer repositioning if needed
          const newLineCount = 1
          const delta = newLineCount - oldLineCount
          if (delta !== 0) {
            repositionFooter(delta)
            previousLineCount = newLineCount
          }

          // Reset footer text
          updateFooterRightText(`${state.history.length} messages`)
          escapePressed = false
        } else {
          // First escape - show message
          escapePressed = true
          updateFooterRightText('Press Escape again to clear')

          // Start timer to reset
          escapeTimer = setTimeout(() => {
            updateFooterRightText(`${state.history.length} messages`)
            escapePressed = false
            escapeTimer = null
          }, 1000)
        }
        return
      }

      // Clear default text on first keypress
      if (!hasStartedTyping && options.defaultText) {
        hasStartedTyping = true
        // Move cursor to start of input (after prompt)
        const promptLength = options.message.length + 1
        process.stdout.write(ansiEscapes.cursorTo(promptLength))

        // Erase default text
        const defaultLineCount = calculateLineCount(options.defaultText)

        // Erase from cursor to end of first line
        process.stdout.write(ansiEscapes.eraseEndLine)

        // If default text spans multiple lines, erase those lines too
        if (defaultLineCount > 1) {
          for (let i = 1; i < defaultLineCount; i++) {
            process.stdout.write(ansiEscapes.cursorDown(1))
            process.stdout.write(ansiEscapes.cursorTo(0))
            process.stdout.write(ansiEscapes.eraseLine)
          }
          // Move back to input position
          process.stdout.write(ansiEscapes.cursorUp(defaultLineCount - 1))
          process.stdout.write(ansiEscapes.cursorTo(promptLength))
        }
      }

      // Handle backspace
      if (key.name === 'backspace') {
        if (input.length > 0) {
          input = input.slice(0, -1)

          // Calculate current cursor position
          const terminalWidth = process.stdout.columns || 80
          const promptLength = options.message.length + 1
          const totalLength = promptLength + input.length
          const currentCol = totalLength % terminalWidth

          // If at beginning of line, move up to end of previous line
          if (currentCol === 0) {
            process.stdout.write(ansiEscapes.cursorUp(1))
            process.stdout.write(ansiEscapes.cursorTo(terminalWidth - 1))
            process.stdout.write(ansiEscapes.eraseEndLine)
          } else {
            process.stdout.write(ansiEscapes.cursorBackward(1))
            process.stdout.write(ansiEscapes.eraseEndLine)
          }

          // Update suggestions if they were showing or if input starts with /
          if (input.length === 0) {
            // If input is now empty, hide suggestions
            if (showingSuggestions) {
              clearCommandSuggestions(suggestionLineCount)
              showingSuggestions = false
              suggestionLineCount = 0
            }
          } else if (input.startsWith('/')) {
            // If input starts with /, update/show suggestions
            updateCommandSuggestions(input)
          }
        }
      }
      // Handle regular characters
      else if (char && char.length === 1 && !key.ctrl && !key.meta) {
        input += char
        process.stdout.write(char)

        // If input starts with /, show/update command suggestions
        if (input.startsWith('/')) {
          updateCommandSuggestions(input)
        }
      }

      // Check if line count changed
      const currentLineCount = calculateLineCount(input)
      if (currentLineCount !== previousLineCount) {
        const delta = currentLineCount - previousLineCount
        repositionFooter(delta)
        previousLineCount = currentLineCount
      }
    })

    // Clean up on close
    rl.on('close', () => {
      if (escapeTimer) {
        clearTimeout(escapeTimer)
      }
      if (showingSuggestions && suggestionLineCount > 0) {
        clearCommandSuggestions(suggestionLineCount)
      }
      process.stdout.removeListener('resize', handleResize)
      if (process.stdin.isTTY) {
        process.stdin.setRawMode(false)
      }
      process.stdin.removeAllListeners('keypress')
    })
  })
}
