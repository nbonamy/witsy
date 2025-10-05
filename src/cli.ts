#!/usr/bin/env node

import chalk from 'chalk'
import { handleCommand, handleMessage, initialize } from './cli/commands'
import { clearFooter, displayFooter } from './cli/display'
import { promptInput } from './cli/input'
import { state } from './cli/state'
import { saveCliConfig } from './cli/config'
import ansiEscapes from 'ansi-escapes'

// Main loop
async function main() {
  
  process.stdout.write(ansiEscapes.clearTerminal)

  await initialize()

  // Track first prompt to show default text
  let isFirstPrompt = true

  // Main input loop
  while (true) {
    try {
      // Top separator is already visible from init or previous iteration
      // Prompt will appear below it
      const userInput = await promptInput({
        message: '>',
        defaultText: isFirstPrompt ? 'Try "tell me a joke"' : undefined
      })

      const trimmed = userInput.trim()

      if (!trimmed) {
        displayFooter()
        continue
      }

      // Clear the first prompt flag
      isFirstPrompt = false

      // After input() returns, print bottom separator and status
      // Skip for now - displayFooter already handles the full footer

      // Handle commands
      if (trimmed.startsWith('/')) {
        await handleCommand(trimmed)
        // displayFooter already called by handleCommand redraw
        continue
      }

      // Add to prompt history (avoid consecutive duplicates)
      // Only for regular prompts, not commands
      if (state.cliConfig && state.userDataPath) {
        const lastPrompt = state.cliConfig.history[state.cliConfig.history.length - 1]
        if (trimmed !== lastPrompt) {
          state.cliConfig.history.push(trimmed)
          saveCliConfig(state.userDataPath, state.cliConfig)
        }
      }

      // Clear the footer (bottom separator + status) that was displayed above
      clearFooter()

      // Handle chat message
      // Display user message with "> " prefix and gray color
      const grayText = chalk.rgb(139, 148, 156)
      console.log()
      console.log(grayText('> ' + trimmed))
      console.log() // Blank line

      // Stream assistant response
      await handleMessage(trimmed)

      // Print footer for next prompt
      displayFooter()
    } catch (error) {
      if (error instanceof Error && error.message.includes('User force closed')) {
        clearFooter()
        console.log(chalk.yellow('\n\n Goodbye! 👋\n'))
        process.exit(0)
      }
      console.error(chalk.red(`\nError: ${error instanceof Error ? error.message : 'Unknown error'}\n`))
      // Print footer for next prompt after error
      displayFooter()
    }
  }
}

// Handle Ctrl+C gracefully
process.on('SIGINT', () => {
  console.log(chalk.yellow('\n\nGoodbye! 👋\n'))
  process.exit(0)
})

// Run
main().catch((error) => {
  console.error(chalk.red(`\nFatal error: ${error.message}\n`))
  process.exit(1)
})
