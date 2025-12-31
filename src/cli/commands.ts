import ansiEscapes from 'ansi-escapes'
import chalk from 'chalk'
import type { LlmChunk } from 'multi-llm-ts'
import terminalKit from 'terminal-kit'
import { WitsyAPI } from './api'
import { loadCliConfig, saveCliConfig } from './config'
import { clearFooter, displayConversation, displayFooter, grayText, padContent, resetDisplay } from './display'
import { applyFolderAccess, getFolderAccessLabel, promptFolderAccess } from './folder'
import { promptInput } from './input'
import { ChatCli, MessageCli } from './models'
import { selectOption } from './select'
import { state, WorkDirAccess } from './state'
import {
  showActivity,
  hideActivity,
  addAssistantMessage,
  renderComponent,
  renderFromComponent,
  getTree,
  AssistantMessage,
  Text,
  ToolCall,
} from './tree'

const term = terminalKit.terminal

const api = new WitsyAPI()

/**
 * Determines if a tool status indicates an error/failure
 */
export function isToolError(status: string | undefined): boolean {
  if (!status) return false
  const lowerStatus = status.toLowerCase()
  return lowerStatus.includes('failed') ||
         lowerStatus.includes('timed out') ||
         lowerStatus.includes('error')
}

export const COMMANDS = [
  { name: '/help', value: 'help', description: 'Show this help message' },
  { name: '/port', value: 'port', description: 'Change server port' },
  { name: '/model', value: 'model', description: 'Select engine and model' },
  { name: '/folder', value: 'folder', description: 'Change folder access' },
  { name: '/title', value: 'title', description: 'Set conversation title' },
  { name: '/save', value: 'save', description: 'Save conversation' },
  { name: '/retry', value: 'retry', description: 'Retry last message' },
  { name: '/clear', value: 'clear', description: 'Clear conversation history' },
  // { name: '/history', value: 'history', description: 'Show conversation history' },
  { name: '/exit', value: 'exit', description: 'Exit the CLI' }
]

// Loading verbs
const loadingVerbs = [
  'Fizzbuzzing',
  'Hyperspacing',
  'Calibrating',
  'Percolating',
  'Discombobulating',
  'Transmutating',
  'Bamboozling',
  'Quantum-leaping',
  'Nebulizing',
  'Fractalizating'
]

// Thinking verbs
const thinkingVerbs = [
  'Cogitating',
  'Ruminating',
  'Pondering',
  'Contemplating',
  'Deliberating',
  'Mulling',
  'Reflecting',
  'Musing',
  'Reasoning',
  'Cerebrating'
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
  console.log(chalk.dim(`\nTesting connection to port ${port}.…`))
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

    const selectedEngineId = await selectOption({
      title: 'Select engine:',
      choices: engines.map(e => ({
        name: `${e.name} (${e.id})`,
        value: e.id
      }))
    })

    // If empty (cancelled), just redraw and return
    if (!selectedEngineId) {
      resetDisplay()
      return
    }

    const selectedEngine = engines.find(e => e.id === selectedEngineId)!
    const models = await api.getModels(selectedEngineId)

    if (models.length === 0) {
      resetDisplay(() => {
        console.log(chalk.red('\nNo models available\n'))
      })
      return
    }

    const selectedModelId = await selectOption({
      title: 'Select model:',
      choices: models.map(m => ({
        name: m.name,
        value: m.id
      }))
    })

    // If empty (cancelled), just redraw and return
    if (!selectedModelId) {
      resetDisplay()
      return
    }

    const selectedModel = models.find(m => m.id === selectedModelId)!

    state.engine = selectedEngine
    state.model = selectedModel

    // Persist selection to cli.json
    if (state.cliConfig && state.userDataPath) {
      state.cliConfig.engine = selectedEngine
      state.cliConfig.model = selectedModel
      saveCliConfig(state.userDataPath, state.cliConfig)
    }

    console.log(chalk.yellow(`\n✓ Selected ${selectedEngine.name} / ${selectedModel.name}\n`))

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

export async function handleFolder() {
  try {
    const access = await promptFolderAccess(true)

    // If cancelled, just redraw and return
    if (access === null) {
      resetDisplay()
      return
    }

    const cwd = process.cwd()

    // Handle clear option
    if (access === 'clear') {
      // Remove saved config for this folder
      if (state.cliConfig?.workDirs?.[cwd]) {
        delete state.cliConfig.workDirs[cwd]
        if (state.userDataPath) {
          saveCliConfig(state.userDataPath, state.cliConfig)
        }
      }
      // Apply 'none' for this session
      applyFolderAccess('none')
      console.log(chalk.yellow('\n✓ Saved preference cleared\n'))
      resetDisplay()
      return
    }

    applyFolderAccess(access)

    // Persist selection to cli.json (per folder)
    if (state.cliConfig && state.userDataPath) {
      if (!state.cliConfig.workDirs) {
        state.cliConfig.workDirs = {}
      }
      state.cliConfig.workDirs[cwd] = { access }
      saveCliConfig(state.userDataPath, state.cliConfig)
    }

    const label = getFolderAccessLabel()
    console.log(chalk.yellow(`\n✓ ${label}\n`))

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
  state.chat = new ChatCli('CLI Session')
  console.log(chalk.yellow('\n✓ Conversation history cleared\n'))

  // Redraw screen without messages
  resetDisplay()
}

export async function handleRetry() {
  // Check if there are any messages
  if (state.chat.messages.length === 0) {
    console.log(chalk.red('\nNo message to retry\n'))
    displayFooter()
    return
  }

  // Find last user message by iterating backwards
  let lastUserIndex = -1
  for (let i = state.chat.messages.length - 1; i >= 0; i--) {
    if (state.chat.messages[i].role === 'user') {
      lastUserIndex = i
      break
    }
  }

  // If no user message found (shouldn't happen, but handle it)
  if (lastUserIndex === -1) {
    console.log(chalk.red('\nNo user message to retry\n'))
    displayFooter()
    return
  }

  // Get the content of the last user message
  const lastUserContent = state.chat.messages[lastUserIndex].content

  // Remove the last user message and everything after it
  state.chat.messages.splice(lastUserIndex)

  // Redraw screen with updated conversation (without the removed messages)
  resetDisplay()

  // Now clear the footer to make room for the retry
  clearFooter()

  // Display the user message again (same as main loop does)
  console.log()
  const paddedRetryContent = padContent(lastUserContent)
  console.log(grayText('> ' + paddedRetryContent.slice(2))) // Remove left padding
  console.log() // Blank line

  // Call handleMessage with the last user content
  // This will use CURRENT state.engine/state.model, not the old ones
  await handleMessage(lastUserContent)

  // Display footer for next prompt
  displayFooter()
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
  state.chat.setEngineModel(state.engine?.id || '', state.model?.id || '')

  // Create and add user message to state
  const userMessage = new MessageCli('user', message)
  userMessage.engine = state.engine?.id || ''
  userMessage.model = state.model?.id || ''
  state.chat.addMessage(userMessage)

  // Setup abort controller for cancellation
  const controller = new AbortController()
  let cancelled = false
  let response = ''

  // Component tree state
  let assistantMsg: AssistantMessage | null = null
  let currentTextComponent: Text | null = null
  const toolComponents = new Map<string, ToolCall>()

  // Use terminal-kit to grab input for escape key handling
  let keyHandler: any = null

  try {

    let inReasoning = false
    let firstChunk = true

    // Start loading animation using component tree
    const loadingVerb = loadingVerbs[Math.floor(Math.random() * loadingVerbs.length)]
    showActivity(`${loadingVerb}… ` + grayText('(esc to interrupt)'))

    // Grab input using terminal-kit and listen for Escape or Ctrl+C to interrupt
    term.grabInput(true)
    keyHandler = term.on('key', (key: string) => {
      if (key === 'ESCAPE' || key === 'CTRL_C') {
        cancelled = true
        controller.abort()
      }
    })

    // Build thread for API
    const thread = state.chat.messages.map(msg => ({
      role: msg.role,
      content: msg.content
    }))

    // Stream assistant response
    await api.complete(thread, (payload: string) => {

      const chunk: LlmChunk = JSON.parse(payload)

      // Stop loading animation on first chunk
      if (firstChunk) {
        hideActivity()
        firstChunk = false

        // Create assistant message component
        assistantMsg = addAssistantMessage()
        renderFromComponent(assistantMsg.id)
      }

      if (chunk.type === 'reasoning') {
        if (!inReasoning) {
          const thinkingVerb = thinkingVerbs[Math.floor(Math.random() * thinkingVerbs.length)]
          showActivity(`${thinkingVerb}…`)
        }
        inReasoning = true
        return
      }

      if (inReasoning) {
        hideActivity()
        inReasoning = false
      }

      if (chunk.type === 'content' && assistantMsg) {

        // Skip empty/whitespace-only content chunks entirely
        if (!chunk.text?.trim()) return

        response += chunk.text

        // Get or create text component
        if (!currentTextComponent) {
          currentTextComponent = assistantMsg.addText('')
        }

        // Append content and re-render
        currentTextComponent.appendContent(chunk.text)
        renderComponent(assistantMsg.id)

      } else if (chunk.type === 'tool' && assistantMsg) {

        const toolId = chunk.id

        // Handle new tool appearing
        if (!toolComponents.has(toolId)) {
          const tree = getTree()
          const tool = assistantMsg.addToolCall(toolId, chunk.status || 'Processing...')
          toolComponents.set(toolId, tool)

          // Start tool animation if not already running
          if (!tree.hasAnimation('tools')) {
            tree.startAnimation('tools', () => {
              for (const [, t] of toolComponents) {
                if (!t.isCompleted()) {
                  t.advanceAnimation()
                }
              }
              if (assistantMsg) {
                renderComponent(assistantMsg.id)
              }
            }, 150)
          }

          renderComponent(assistantMsg.id)
        } else {
          // Update existing tool status
          const tool = toolComponents.get(toolId)!
          tool.updateStatus(chunk.status || 'Processing...')
          renderComponent(assistantMsg.id)
        }

        // Handle tool completion
        if (chunk.done) {
          const tool = toolComponents.get(toolId)!
          const finalState = isToolError(chunk.status) ? 'error' : 'completed'
          tool.complete(finalState, chunk.status || 'Done')
          renderComponent(assistantMsg.id)

          // Check if all tools are done
          const allDone = Array.from(toolComponents.values()).every(t => t.isCompleted())
          if (allDone) {
            getTree().stopAnimation('tools')
          }
        }

        // Reset text component so next content creates a new one after tools
        currentTextComponent = null
      }

    }, controller.signal)

    // Create and add assistant response to state (if we got any content)
    if (response.length > 0) {
      const assistantMessage = new MessageCli('assistant', response)
      assistantMessage.engine = state.engine?.id || ''
      assistantMessage.model = state.model?.id || ''
      state.chat.addMessage(assistantMessage)
    }

    // Auto-save if chat has been saved before
    if (state.chat.uuid) {
      try {
        await api.saveConversation(state.chat)
      } catch {
        // Ignore save errors
      }
    }

  } catch (error) {

    // Handle cancellation
    if (cancelled || (error instanceof Error && error.name === 'AbortError')) {
      // Keep partial response if we got any
      if (response && response.length > 0) {
        const assistantMessage = new MessageCli('assistant', response)
        assistantMessage.engine = state.engine?.id || ''
        assistantMessage.model = state.model?.id || ''
        state.chat.addMessage(assistantMessage)

        // Auto-save if chat has been saved before
        if (state.chat.uuid) {
          try {
            await api.saveConversation(state.chat)
          } catch {
            // Ignore save errors
          }
        }
      } else {
        // No response - remove user message
        state.chat.messages.pop()

        // Remove assistant message component if it was added
        if (assistantMsg) {
          getTree().removeChild(assistantMsg)
        }
      }
    } else {
      // Remove the user message we just added
      state.chat.messages.pop()

      // Remove assistant message component if it was added
      if (assistantMsg) {
        getTree().removeChild(assistantMsg)
      }
    }

  } finally {
    // Stop all animations
    hideActivity()
    getTree().stopAnimation('tools')

    // Mark all tools as complete if interrupted
    for (const [, tool] of toolComponents) {
      if (!tool.isCompleted()) {
        tool.complete('error', 'Interrupted')
      }
    }

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
  clearFooter()
  console.log(chalk.yellow('\n  Goodbye! 👋'))
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
    case 'folder':
      await handleFolder()
      break
    case 'title':
      await handleTitle()
      break
    case 'save':
      await handleSave()
      break
    case 'retry':
      await handleRetry()
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
  const cwd = process.cwd()

  // Try to connect with short timeout
  const connected = await api.connectWithTimeout(state.port, 2000)

  if (!connected) {
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

    // Handle folder access - use saved preference for current folder
    const savedConfig = cliConfig.workDirs?.[cwd]
    if (savedConfig?.access) {
      applyFolderAccess(savedConfig.access)
    }
    // If no saved config, we'll prompt after resetDisplay()
  } catch {
    state.engine = null
    state.model = null
  }

  // Display initial screen
  resetDisplay()

  // Prompt for folder access if no saved config for this folder
  if (!state.cliConfig?.workDirs?.[cwd]?.access) {
    // Note: includeClear=false so 'clear' is never returned
    const access = await promptFolderAccess(false) as WorkDirAccess | null

    // If cancelled, apply 'none' but don't save
    if (access === null) {
      applyFolderAccess('none')
    } else {
      applyFolderAccess(access)

      // Save preference for this folder
      if (state.cliConfig && state.userDataPath) {
        if (!state.cliConfig.workDirs) {
          state.cliConfig.workDirs = {}
        }
        state.cliConfig.workDirs[cwd] = { access }
        saveCliConfig(state.userDataPath, state.cliConfig)
      }
    }
  }
}
