// Component tree management utilities

import ansiEscapes from 'ansi-escapes'
import {
  Root,
  Header,
  Empty,
  Footer,
  Prompt,
  UserMessage,
  AssistantMessage,
  Text,
  ToolCall,
  ActivityIndicator,
} from './components'
import { state } from './state'

// Initialize the component tree with standard layout
export function initializeTree(): Root {
  const root = new Root()

  // Header
  const header = new Header(state.port)
  root.appendChild(header)

  // Empty line after header
  const spacer = new Empty(1, 'spacer')
  root.appendChild(spacer)

  // Prompt (initially 1 line)
  const prompt = new Prompt('> ')
  root.appendChild(prompt)

  // Footer (computes its own text from state)
  const footer = new Footer()
  root.appendChild(footer)

  state.componentTree = root
  return root
}

// Get the component tree (initialize if needed)
export function getTree(): Root {
  if (!state.componentTree) {
    return initializeTree()
  }
  return state.componentTree
}

// Update footer (marks dirty so it re-renders with current state)
export function updateFooter(inputText?: string): void {
  const tree = getTree()
  const footer = tree.find('footer') as Footer | null
  if (footer) {
    if (inputText !== undefined) {
      footer.setInputText(inputText)
    }
    footer.markDirty()
  }
}

// Render the entire tree to terminal (replaces resetDisplay)
export function renderTree(): void {
  const tree = getTree()
  const width = process.stdout.columns || 80

  // Clear terminal
  process.stdout.write(ansiEscapes.clearTerminal)
  process.stdout.write(ansiEscapes.cursorTo(0, 0))

  // Rebuild messages from chat state
  rebuildTreeFromMessages()

  // Update footer
  updateFooter()

  // Render all components
  let currentRow = 0
  for (const child of tree.getChildren()) {
    const lines = child.render(width)
    for (const line of lines) {
      process.stdout.write(ansiEscapes.cursorTo(0, currentRow))
      process.stdout.write(line)
      currentRow++
    }
    child.clearDirty()
    child.setCachedHeight(lines.length)
  }

  // Position cursor at the prompt (after the "> ")
  const prompt = tree.find('prompt') as Prompt | null
  if (prompt) {
    // Find prompt position
    let promptRow = 0
    for (const child of tree.getChildren()) {
      if (child.id === 'prompt') break
      promptRow += child.getCachedHeight()
    }
    process.stdout.write(ansiEscapes.cursorTo(2, promptRow))
  }
}

// Render footer only (for incremental updates)
export function renderFooter(): void {
  const tree = getTree()
  const footer = tree.find('footer') as Footer | null
  if (!footer) return

  const width = process.stdout.columns || 80

  // Calculate footer position
  let footerRow = 0
  for (const child of tree.getChildren()) {
    if (child.id === 'footer') break
    footerRow += child.getCachedHeight()
  }

  // Update footer text
  updateFooter()

  // Render footer
  const lines = footer.render(width)
  for (let i = 0; i < lines.length; i++) {
    process.stdout.write(ansiEscapes.cursorTo(0, footerRow + i))
    process.stdout.write(ansiEscapes.eraseLine)
    process.stdout.write(lines[i])
  }
}

// Add a user message to the tree
export function addUserMessage(content: string): UserMessage {
  const tree = getTree()
  const prompt = tree.find('prompt')

  const userMsg = new UserMessage(content, `user-${Date.now()}`)

  if (prompt) {
    tree.insertBefore(userMsg, prompt)
  } else {
    tree.appendChild(userMsg)
  }

  return userMsg
}

// Add an assistant message container to the tree
export function addAssistantMessage(): AssistantMessage {
  const tree = getTree()
  const prompt = tree.find('prompt')

  const assistantMsg = new AssistantMessage(`assistant-${Date.now()}`)

  if (prompt) {
    tree.insertBefore(assistantMsg, prompt)
  } else {
    tree.appendChild(assistantMsg)
  }

  return assistantMsg
}

// Show activity indicator
export function showActivity(text: string): ActivityIndicator {
  const tree = getTree()
  const prompt = tree.find('prompt')

  // Remove any existing activity indicator
  hideActivity()

  const indicator = new ActivityIndicator(text, 'activity')

  if (prompt) {
    tree.insertBefore(indicator, prompt)
  } else {
    tree.appendChild(indicator)
  }

  // Start animation
  tree.startAnimation('activity', () => {
    indicator.advanceAnimation()
    tree.updateComponent(indicator)
  }, 150)

  return indicator
}

// Hide activity indicator
export function hideActivity(): void {
  const tree = getTree()
  const indicator = tree.find('activity')

  if (indicator) {
    tree.stopAnimation('activity')
    tree.removeChild(indicator)
  }
}

// Update activity indicator text
export function updateActivity(text: string): void {
  const tree = getTree()
  const indicator = tree.find('activity') as ActivityIndicator | null

  if (indicator) {
    indicator.setText(text)
  }
}

// Start tool animations for an assistant message
export function startToolAnimations(assistantMsg: AssistantMessage): void {
  const tree = getTree()

  tree.startAnimation('tools', () => {
    for (const tool of assistantMsg.getToolCalls()) {
      if (!tool.isCompleted()) {
        tool.advanceAnimation()
        tree.updateComponent(tool)
      }
    }
  }, 150)
}

// Stop tool animations
export function stopToolAnimations(): void {
  const tree = getTree()
  tree.stopAnimation('tools')
}

// Rebuild tree from chat messages (for resetDisplay)
export function rebuildTreeFromMessages(): void {
  const tree = getTree()

  // Remove all messages (keep header, spacer, prompt, footer)
  const toRemove: string[] = []
  for (const child of tree.getChildren()) {
    if (child.id !== 'header' && child.id !== 'spacer' &&
        child.id !== 'prompt' && child.id !== 'footer' &&
        child.id !== 'activity') {
      toRemove.push(child.id)
    }
  }

  for (const id of toRemove) {
    const component = tree.find(id)
    if (component) {
      tree.removeChild(component)
    }
  }

  // Add messages from chat state
  const prompt = tree.find('prompt')

  for (const msg of state.chat.messages) {
    if (msg.role === 'user') {
      const userMsg = new UserMessage(msg.content, `user-${Date.now()}-${Math.random()}`)
      if (prompt) {
        tree.insertBefore(userMsg, prompt)
      }
    } else if (msg.role === 'assistant') {
      const assistantMsg = new AssistantMessage(`assistant-${Date.now()}-${Math.random()}`)
      const text = new Text(msg.content, 'default')
      assistantMsg.appendChild(text)
      if (prompt) {
        tree.insertBefore(assistantMsg, prompt)
      }
    }
  }

  // Update footer
  updateFooter()
}

// Clear all messages from tree
export function clearMessages(): void {
  const tree = getTree()

  const toRemove: string[] = []
  for (const child of tree.getChildren()) {
    if (child.id !== 'header' && child.id !== 'spacer' &&
        child.id !== 'prompt' && child.id !== 'footer' &&
        child.id !== 'activity') {
      toRemove.push(child.id)
    }
  }

  for (const id of toRemove) {
    const component = tree.find(id)
    if (component) {
      tree.removeChild(component)
    }
  }

  updateFooter()
}

// Get prompt component
export function getPrompt(): Prompt | null {
  const tree = getTree()
  return tree.find('prompt') as Prompt | null
}

// Update prompt line count (for footer repositioning)
export function updatePromptLineCount(inputText: string): boolean {
  const tree = getTree()
  const prompt = getPrompt()

  if (!prompt) return false

  const termWidth = tree.getTermWidth()
  const newLineCount = prompt.calculateInputLineCount(inputText, termWidth)
  const oldLineCount = prompt.getLineCount()

  if (newLineCount !== oldLineCount) {
    prompt.setLineCount(newLineCount)
    return true // Height changed
  }

  return false // No change
}

// Export component types for convenience
export {
  Root,
  Header,
  Empty,
  Footer,
  Prompt,
  UserMessage,
  AssistantMessage,
  Text,
  ToolCall,
  ActivityIndicator,
}
