#!/usr/bin/env node

import ansiEscapes from 'ansi-escapes'
import chalk from 'chalk'
import { parseArgs } from 'node:util'
import { COMMANDS, handleClear, handleCommand, handleMessage, handleQuit, initialize } from './commands'
import { saveCliConfig } from './config'
import { clearFooter, displayFooter, grayText, padContent, resetDisplay } from './display'
import { promptInput } from './input'
import { selectOption } from './select'
import { state } from './state'
import { initializeTree } from './tree'

// Parse command line arguments
function parseCliArgs() {
  try {
    const { values } = parseArgs({
      options: {
        port: { type: 'string', short: 'p' },
        debug: { type: 'boolean', short: 'd' },
        help: { type: 'boolean', short: 'h' }
      },
      allowPositionals: false
    })

    // Show help
    if (values.help) {
      console.log(`
${chalk.bold('Witsy CLI')} - AI Assistant Command Line Interface

${chalk.bold('Usage:')}
  witsy [options]

${chalk.bold('Options:')}
  -p, --port <port>    Connect to Witsy on specified port (default: 8090)
  -d, --debug          Enable debug mode (show keycodes)
  -h, --help           Show this help message

${chalk.bold('Commands (during session):')}
  /help                Show available commands
  /port                Change server port
  /model               Select engine and model
  /exit                Exit the CLI
`)
      process.exit(0)
    }

    // Parse and validate port
    if (values.port) {
      const port = parseInt(values.port)
      if (isNaN(port) || port < 1 || port > 65535) {
        console.error(chalk.red(`Error: Invalid port number "${values.port}" (must be 1-65535)`))
        process.exit(1)
      }
      state.port = port
    }

    // Enable debug mode
    if (values.debug) {
      state.debug = true
    }
  } catch (error: any) {
    console.error(chalk.red(`Error: ${error.message}`))
    console.log(chalk.dim('Use --help for usage information'))
    process.exit(1)
  }
}

// Main loop
async function main() {

  // Parse CLI arguments first
  parseCliArgs()

  process.stdout.write(ansiEscapes.clearTerminal)

  await initialize()

  // Initialize component tree (for future use)
  // The tree is now available via state.componentTree
  initializeTree()

  // Main input loop
  while (true) {
    
    try {
      // Top separator is already visible from init or previous iteration
      // Prompt will appear below it
      const userInput = await promptInput({
        prompt: '> ',
      })

      // Handle Ctrl+C (always exit)
      if (userInput === '__CTRL_C__') {
        handleQuit()
      }

      // Handle Ctrl+D (clear if messages exist, else exit)
      if (userInput === '__CTRL_D__') {
        if (state.chat.messages.length > 0) {
          await handleClear()
        } else {
          handleQuit()
        }
        continue
      }

      const trimmed = userInput.trim()

      if (!trimmed) {
        resetDisplay()
        continue
      }

      // After input() returns, print bottom separator and status
      // Skip for now - displayFooter already handles the full footer

      // Handle commands
      if (trimmed.startsWith('/')) {
        // If just "/", show command selector
        if (trimmed === '/') {
          const selectedCommand = await selectOption({
            title: 'Select command',
            choices: COMMANDS
          })

          // If empty (cancelled), just redraw and continue
          if (!selectedCommand) {
            resetDisplay()
            continue
          }

          // selectOption returns value field, need to prepend "/"
          await handleCommand('/' + selectedCommand)
        } else {
          await handleCommand(trimmed)
        }
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
      console.log()
      const paddedUserContent = padContent(trimmed)
      console.log(grayText('> ' + paddedUserContent.slice(2))) // Remove left padding
      console.log() // Blank line

      // Stream assistant response
      await handleMessage(trimmed)

      // Print footer for next prompt
      displayFooter()
    
    } catch (error) {
      console.error(chalk.red(`\nError: ${error instanceof Error ? error.message : 'Unknown error'}\n`))
      // Print footer for next prompt after error
      displayFooter()
    }
  }
}

// Handle Ctrl+C gracefully
process.on('SIGINT', () => {
  handleQuit()
})

// Run
main().catch((error) => {
  console.error(chalk.red(`\nFatal error: ${error.message}\n`))
  process.exit(1)
})
