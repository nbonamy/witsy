// Command Handlers

import chalk from 'chalk'
import { state } from './state'
import { WitsyAPI } from './api'
import { displayHeader, displayFooter, displayConversation, clearFooter } from './display'
import { promptInput } from './input'
import { selectOption } from './select'
import ansiEscapes from 'ansi-escapes'
import { LlmChunk } from 'multi-llm-ts'
import { loadCliConfig, saveCliConfig } from './config'

const api = new WitsyAPI()

export const COMMANDS = [
  { name: '/help', value: 'help', description: 'Show this help message' },
  { name: '/port', value: 'port', description: 'Change server port' },
  { name: '/model', value: 'model', description: 'Select engine and model' },
  { name: '/clear', value: 'clear', description: 'Clear conversation history' },
  { name: '/history', value: 'history', description: 'Show conversation history' },
  { name: '/exit', value: 'exit', description: 'Exit the CLI' }
]

export async function handleHelp() {

  clearFooter()

  console.log(chalk.yellow('\nAvailable Commands:'))
  for (const cmd of COMMANDS) {
    console.log(chalk.dim(`  ${cmd.name.padEnd(20)} ${cmd.description}`))
  }
  console.log()

  displayFooter()
}

export async function handlePort() {

  process.stdout.write(ansiEscapes.cursorDown(1))
  process.stdout.write(ansiEscapes.eraseLine)

  const portStr = await promptInput({
    message: 'Enter port number:',
    defaultText: state.port.toString()
  })

  const port = parseInt(portStr)
  if (isNaN(port) || port < 1 || port > 65535) {
    console.log(chalk.red('\nInvalid port number (must be 1-65535)\n'))
    displayFooter()
    return
  }

  state.port = port
  console.log(chalk.yellow(`\n✓ Port changed to ${state.port}\n`))

  // Redraw entire screen
  displayHeader()
  displayConversation()
  displayFooter()
}

export async function handleModel() {
  try {

    process.stdout.write(ansiEscapes.cursorDown(1))

    const engines = await api.getEngines()

    if (engines.length === 0) {
      console.log(chalk.red('\nNo engines available\n'))
      return
    }

    const selectedEngine = await selectOption({
      title: 'Select engine:',
      choices: engines.map(e => ({
        name: `${e.name} (${e.id})`,
        value: e.id
      })),
      pageSize: 8
    })

    const models = await api.getModels(selectedEngine)

    if (models.length === 0) {
      console.log(chalk.red('\nNo models available\n'))
      return
    }

    const selectedModel = await selectOption({
      title: 'Select model:',
      choices: models.map(m => ({
        name: m.name,
        value: m.id
      })),
      pageSize: 8
    })

    state.engine = selectedEngine
    state.model = selectedModel

    // Persist selection to cli.json
    if (state.cliConfig && state.userDataPath) {
      state.cliConfig.engine = selectedEngine
      state.cliConfig.model = selectedModel
      saveCliConfig(state.userDataPath, state.cliConfig)
    }

    const engineName = engines.find(e => e.id === selectedEngine)?.name || selectedEngine
    const modelName = models.find(m => m.id === selectedModel)?.name || selectedModel

    console.log(chalk.yellow(`\n✓ Selected ${engineName} / ${modelName}\n`))

    // Redraw entire screen
    displayHeader()
    displayConversation()
    displayFooter()
  } catch (error: any) {
    // Handle cancellation (Escape key)
    if (error?.message?.includes('cancelled')) {
      // Clear terminal and redraw entire screen to clear selector
      process.stdout.write(ansiEscapes.clearTerminal)
      displayHeader()
      displayConversation()
      displayFooter()
      return
    }
    // Clear and redraw entire screen with error message
    process.stdout.write(ansiEscapes.clearTerminal)
    displayHeader()
    displayConversation()
    console.log(chalk.red(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`))
    console.log(chalk.dim('Make sure Witsy is running'))
    console.log()
    displayFooter()
  }
}

export async function handleClear() {
  state.history = []
  console.log(chalk.yellow('\n✓ Conversation history cleared\n'))

  // Redraw screen without messages
  displayHeader()
  displayConversation() // Will be empty
  displayFooter()
}

export async function handleHistory() {
  if (state.history.length === 0) {
    console.log(chalk.dim('\nNo conversation history\n'))
    return
  }

  // Just display the conversation
  displayConversation()
}

export async function handleMessage(message: string) {
  
  // Add user message to history
  state.history.push({ role: 'user', content: message })

  try {
    
    let response = ''
    let inTools = false

    // Stream assistant response (no prefix, just content in white/default color)
    await api.complete(state.history, (payload: string) => {

      const chunk: LlmChunk = JSON.parse(payload)
      if (chunk.type === 'content') {
        process.stdout.write(chunk.text)
        response += chunk.text
      } else if (chunk.type === 'tool') {

        if (!inTools) {
          if (response.length > 0 && !response.endsWith('\n')) {
            console.log()
            console.log()
          }
          inTools = true
        } else {
          process.stdout.write(ansiEscapes.cursorTo(0))
          process.stdout.write(ansiEscapes.eraseLine)
        }

        process.stdout.write((chunk.done ? chalk.greenBright('⏺') : chalk.blueBright('⏺')) + ` ${chunk.status}`)

        if (chunk.done) {
          console.log()
          console.log()
          inTools = false
        }

      }

    })

    // Add assistant response to history
    state.history.push({ role: 'assistant', content: response })

    // Blank line after response
    console.log('\n')

  } catch (error) {
    
    console.log(chalk.red(`\nError: ${error instanceof Error ? error.message : 'Unknown error'}`))
    console.log(chalk.dim('Make sure Witsy is running\n'))
    state.history.pop()
  }
}

export async function handleCommand(commandInput: string) {
  // Parse command and args
  const [cmd] = commandInput.slice(1).split(' ')
  await executeCommand(cmd.toLowerCase())
}

export async function executeCommand(command: string) {
  switch (command) {
    case 'help':
      await handleHelp()
      break
    case 'port':
      await handlePort()
      break
    case 'model':
      await handleModel()
      break
    case 'clear':
      await handleClear()
      break
    case 'history':
      await handleHistory()
      break
    case 'exit':
    case 'quit':
      console.log(chalk.yellow('\nGoodbye! 👋\n'))
      process.exit(0)
      break
    default:
      process.stdout.write(ansiEscapes.cursorSavePosition)
      console.log(chalk.red(`\nUnknown command: /${command}`))
      console.log(chalk.dim('Type /help for available commands\n'))
      process.stdout.write(ansiEscapes.cursorRestorePosition)
      process.stdout.write(ansiEscapes.cursorUp(1))
      process.stdout.write(ansiEscapes.eraseLine)

  }
}

export async function initialize() {
  try {
    const config = await api.getConfig()
    state.userDataPath = config.userDataPath

    // Load CLI config from disk
    const cliConfig = loadCliConfig(state.userDataPath)
    state.cliConfig = cliConfig

    // Use CLI config values if present, otherwise fall back to API config
    state.engine = cliConfig.engine || config.engine
    state.model = cliConfig.model || config.model

    // If CLI config didn't have engine/model, save them now
    if (!cliConfig.engine || !cliConfig.model) {
      state.cliConfig.engine = state.engine
      state.cliConfig.model = state.model
      saveCliConfig(state.userDataPath, state.cliConfig)
    }
  } catch {
    // Silently fail - will show connecting status
    state.engine = ''
    state.model = ''
  }

  displayHeader()
  displayConversation() // Will be empty initially
  displayFooter() // Print top separator, prompt will appear below
}
