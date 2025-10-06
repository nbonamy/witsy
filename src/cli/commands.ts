// Command Handlers

import ansiEscapes from 'ansi-escapes'
import chalk from 'chalk'
import terminalKit from 'terminal-kit'
import { LlmChunk } from 'multi-llm-ts'
import { WitsyAPI } from './api'
import { loadCliConfig, saveCliConfig } from './config'
import { clearFooter, displayConversation, displayFooter, resetDisplay } from './display'
import { promptInput } from './input'
import { selectOption } from './select'
import { state } from './state'
import Message from '../models/message'
import Chat from '../models/chat'

const term = terminalKit.terminal

const api = new WitsyAPI()

export const COMMANDS = [
  { name: '/help', value: 'help', description: 'Show this help message' },
  { name: '/port', value: 'port', description: 'Change server port' },
  { name: '/model', value: 'model', description: 'Select engine and model' },
  { name: '/title', value: 'title', description: 'Set conversation title' },
  { name: '/save', value: 'save', description: 'Save conversation to workspace' },
  { name: '/clear', value: 'clear', description: 'Clear conversation history' },
  // { name: '/history', value: 'history', description: 'Show conversation history' },
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

  process.stdout.write(ansiEscapes.cursorUp(1))
  process.stdout.write(ansiEscapes.eraseDown)

  const portStr = await promptInput({
    prompt: 'Enter port number: ',
  })

  const port = parseInt(portStr)
  if (isNaN(port) || port < 1 || port > 65535) {
    console.log(chalk.red('\nInvalid port number (must be 1-65535)\n'))
    displayFooter()
    return
  }

  // Test connection to new port
  console.log(chalk.dim(`\nTesting connection to port ${port}...`))
  const connected = await api.connectWithTimeout(port, 2000)

  if (!connected) {
    console.log(chalk.red(`\n✗ Cannot connect to Witsy on port ${port}`))
    console.log(chalk.dim('  Make sure Witsy is running on that port\n'))
    displayFooter()
    return
  }

  // Update port and fetch new config
  state.port = port

  try {
    const config = await api.getConfig()

    // Check if HTTP endpoints are enabled
    if (!config.enableHttpEndpoints) {
      console.log(chalk.red('\n✗ HTTP endpoints are disabled'))
      console.log(chalk.dim('  Enable HTTP endpoints in Witsy settings to use the CLI'))
      console.log(chalk.dim('  Settings > Advanced > Enable HTTP endpoints\n'))
      displayFooter()
      return
    }

    state.userDataPath = config.userDataPath
    state.engine = config.engine
    state.model = config.model

    // Update CLI config
    if (state.cliConfig) {
      state.cliConfig.engine = config.engine
      state.cliConfig.model = config.model
      saveCliConfig(state.userDataPath, state.cliConfig)
    }

    console.log(chalk.yellow(`\n✓ Connected to Witsy on port ${state.port}\n`))
  } catch {
    console.log(chalk.red(`\n✗ Error fetching config from port ${port}\n`))
  }

  // Redraw entire screen
  resetDisplay()
}

export async function handleModel() {
  try {

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
      }))
    })

    // If empty (cancelled), just redraw and return
    if (!selectedEngine) {
      resetDisplay()
      return
    }

    const models = await api.getModels(selectedEngine)

    if (models.length === 0) {
      resetDisplay(() => {
        console.log(chalk.red('\nNo models available\n'))
      })
      return
    }

    const selectedModel = await selectOption({
      title: 'Select model:',
      choices: models.map(m => ({
        name: m.name,
        value: m.id
      }))
    })

    // If empty (cancelled), just redraw and return
    if (!selectedModel) {
      resetDisplay()
      return
    }

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
    resetDisplay()

  } catch (error: any) {
    // Handle cancellation (Escape key)
    if (error?.message?.includes('cancelled')) {
      resetDisplay()
      return
    }
    resetDisplay(() => {
      console.log(chalk.red(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`))
      console.log(chalk.dim('Make sure Witsy is running'))
      console.log()
    })
  }
}

export async function handleTitle() {

  process.stdout.write(ansiEscapes.cursorUp(1))
  process.stdout.write(ansiEscapes.eraseDown)

  const title = await promptInput({
    prompt: 'Enter conversation title: ',
  })

  const trimmedTitle = title.trim()
  if (!trimmedTitle) {
    console.log(chalk.red('\nTitle cannot be empty\n'))
    displayFooter()
    return
  }

  // Update chat title
  state.chat.title = trimmedTitle

  // Auto-save if chat is already saved
  if (state.chat.uuid) {
    try {
      await api.saveConversation(state.chat)
      console.log(chalk.yellow(`\n✓ Title updated and saved: "${trimmedTitle}"\n`))
    } catch {
      console.log(chalk.yellow(`\n✓ Title updated: "${trimmedTitle}"`))
      console.log(chalk.red('  (Auto-save failed)\n'))
    }
  } else {
    console.log(chalk.yellow(`\n✓ Title updated: "${trimmedTitle}"\n`))
  }

  // Redraw entire screen
  resetDisplay()
}

export async function handleClear() {
  state.chat = new Chat('CLI Session')
  state.chat.uuid = ''
  console.log(chalk.yellow('\n✓ Conversation history cleared\n'))

  // Redraw screen without messages
  resetDisplay()
}

export async function handleHistory() {
  if (state.chat.messages.length === 0) {
    console.log(chalk.dim('\nNo conversation history\n'))
    return
  }

  // Just display the conversation
  displayConversation()
}

export async function handleMessage(message: string) {

  // Update chat engine/model before each message (user can change model mid-conversation)
  state.chat.setEngineModel(state.engine, state.model)

  // Create and add user message
  const userMessage = new Message('user', message)
  userMessage.engine = state.engine
  userMessage.model = state.model
  state.chat.addMessage(userMessage)

  // Setup abort controller for cancellation
  const controller = new AbortController()
  let cancelled = false
  let response = '' // Declare here so it's accessible in catch block

  // Use terminal-kit to grab input for escape key handling
  let keyHandler: any = null

  try {

    let inTools = false

    // Show hint that user can cancel (only on first message)
    if (state.chat.messages.length === 1) {
      console.log(chalk.italic.dim('(Press ESC to cancel)\n'))
    }

    // Grab input using terminal-kit and listen for Escape key
    term.grabInput(true)
    keyHandler = term.on('key', (key: string) => {
      if (key === 'ESCAPE') {
        cancelled = true
        controller.abort()
      }
    })

    // Build thread for API (convert to simple format for /api/complete)
    const thread = state.chat.messages.map(msg => ({
      role: msg.role,
      content: msg.content
    }))

    // Stream assistant response (no prefix, just content in white/default color)
    await api.complete(thread, (payload: string) => {

      const chunk: LlmChunk = JSON.parse(payload)
      if (chunk.type === 'content') {
        response += chunk.text
        process.stdout.write(chunk.text)
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

    }, controller.signal)

    // Create and add assistant response (if we got any content)
    if (response.length > 0) {
      const assistantMessage = new Message('assistant', response)
      assistantMessage.engine = state.engine
      assistantMessage.model = state.model
      state.chat.addMessage(assistantMessage)
    }

    // Blank line after response
    console.log('\n')

    // Auto-save if chat has been saved before
    if (state.chat.uuid) {
      try {
        await api.saveConversation(state.chat)
      } catch {
        console.log(chalk.dim('(Auto-save failed)'))
      }
    }

  } catch (error) {

    // Handle cancellation
    if (cancelled || (error instanceof Error && error.name === 'AbortError')) {
      console.log(chalk.yellow('\n(Cancelled)\n'))

      // Keep partial response if we got any
      if (response && response.length > 0) {
        const assistantMessage = new Message('assistant', response)
        assistantMessage.engine = state.engine
        assistantMessage.model = state.model
        state.chat.addMessage(assistantMessage)

        // Auto-save if chat has been saved before
        if (state.chat.uuid) {
          try {
            await api.saveConversation(state.chat)
          } catch {
            console.log(chalk.dim('(Auto-save failed)'))
          }
        }
      } else {
        // No response - remove user message
        state.chat.messages.pop()
      }
    } else {
      console.log(chalk.red(`\nError: ${error instanceof Error ? error.message : 'Unknown error'}`))
      console.log(chalk.dim('Make sure Witsy is running\n'))

      // Remove the user message we just added
      state.chat.messages.pop()
    }

  } finally {
    // Cleanup: ungrab input and remove key listener
    if (keyHandler) {
      term.removeListener('key', keyHandler)
    }
    term.grabInput(false)
  }
}

export async function handleSave() {

  clearFooter()

  // Check if there are messages to save
  if (state.chat.messages.length === 0) {
    console.log(chalk.red('\nNo conversation to save\n'))
    displayFooter()
    return
  }

  try {
    // Call API to save conversation
    const chatId = await api.saveConversation(state.chat)

    // Update chat UUID to enable auto-save
    state.chat.uuid = chatId

    console.log(chalk.yellow('\n✓ Conversation saved to workspace'))
    console.log(chalk.dim('  Auto-save enabled for this conversation\n'))

  } catch (error) {
    console.log(chalk.red(`\nError saving conversation: ${error instanceof Error ? error.message : 'Unknown error'}`))
    console.log(chalk.dim('Make sure Witsy is running\n'))
  }

  displayFooter()
}

export async function handleCommand(commandInput: string) {
  // Parse command and args
  const [cmd] = commandInput.slice(1).split(' ')
  await executeCommand(cmd.toLowerCase())
}

export function handleQuit() {
  console.log(chalk.yellow('\nGoodbye! 👋\n'))
  process.exit(0)
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
    case 'title':
      await handleTitle()
      break
    case 'save':
      await handleSave()
      break
    case 'clear':
      await handleClear()
      break
    // case 'history':
    //   await handleHistory()
    //   break
    case 'exit':
    case 'quit':
      handleQuit()
      break
    default:
      resetDisplay(() => {
        console.log(chalk.red(`\nUnknown command: /${command}`))
        console.log(chalk.dim('Type /help for available commands\n'))
      })

  }
}

export async function initialize() {
  // Try to connect with short timeout
  const connected = await api.connectWithTimeout(state.port, 2000)

  if (!connected) {
    state.engine = ''
    state.model = ''
    resetDisplay(() => {
      console.log(chalk.red('\n✗ Cannot connect to Witsy'))
      console.log(chalk.dim('  Make sure Witsy desktop app is running on port ' + state.port + '\n'))
    })
    process.stdout.write(ansiEscapes.eraseDown)
    process.exit(1)
  }

  try {
    const config = await api.getConfig()

    // Check if HTTP endpoints are enabled
    if (!config.enableHttpEndpoints) {
      resetDisplay(() => {
        console.log(chalk.red('\n✗ HTTP endpoints are disabled'))
        console.log(chalk.dim('  Enable HTTP endpoints in Witsy settings to use the CLI'))
        console.log(chalk.dim('  Settings > General > Enable HTTP endpoints\n'))
      })
      process.stdout.write(ansiEscapes.eraseDown)
      process.exit(1)
    }

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
    state.engine = ''
    state.model = ''
  }

  resetDisplay()
}
