// Component tree management utilities

import ansiEscapes from 'ansi-escapes'
import {
  Root,
  Header,
  Separator,
  StatusText,
  Prompt,
  UserMessage,
  AssistantMessage,
  Text,
  ToolCall,
  ActivityIndicator,
  Goodbye,
} from './components'
import { state } from './state'

// Initialize the component tree with standard layout
// Structure: Header (with trailing space) → [Messages] → Separator → Prompt → Separator → StatusText
export function initializeTree(): Root {
  const root = new Root()

  // Header (includes its own trailing blank line for spacing)
  const header = new Header(state.port)
  root.appendChild(header, 'header')
  header.setCachedHeight(header.calculateHeight())

  // Top separator (above input)
  const topSeparator = new Separator()
  root.appendChild(topSeparator, 'separator-top')
  topSeparator.setCachedHeight(topSeparator.calculateHeight())

  // Prompt/Input area (initially 1 line)
  const prompt = new Prompt('> ')
  root.appendChild(prompt, 'prompt')
  prompt.setCachedHeight(prompt.calculateHeight())

  // Bottom separator (below input)
  const bottomSeparator = new Separator()
  root.appendChild(bottomSeparator, 'separator-bottom')
  bottomSeparator.setCachedHeight(bottomSeparator.calculateHeight())

  // Status text (model info, message count)
  const status = new StatusText()
  root.appendChild(status, 'status')
  status.setCachedHeight(status.calculateHeight())

  // Goodbye message (hidden by default, shown on exit)
  const goodbye = new Goodbye()
  goodbye.hide()
  root.appendChild(goodbye, 'goodbye')

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

// Update status text (marks dirty so it re-renders with current state)
export function updateStatus(inputText?: string): void {
  const tree = getTree()
  const status = tree.find('status') as StatusText | null
  if (status) {
    if (inputText !== undefined) {
      status.setInputText(inputText)
    }
    status.markDirty()
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

  // Update status
  updateStatus()

  // Render all visible components
  let currentRow = 0
  for (const child of tree.getChildren()) {
    // Skip hidden components (like v-if in Vue)
    if (!child.visible) {
      child.setCachedHeight(0)
      continue
    }
    const lines = child.render(width)
    for (const line of lines) {
      process.stdout.write(ansiEscapes.cursorTo(0, currentRow))
      process.stdout.write(line)
      currentRow++
    }
    child.clearDirty()
    child.setCachedHeight(lines.length)
  }

  // Position cursor at the prompt (after the "> ") if visible
  const prompt = tree.find('prompt') as Prompt | null
  if (prompt?.visible) {
    // Find prompt position
    let promptRow = 0
    for (const child of tree.getChildren()) {
      if (child.id === 'prompt') break
      if (child.visible) {
        promptRow += child.getCachedHeight()
      }
    }
    process.stdout.write(ansiEscapes.cursorTo(2, promptRow))
  }
}

// Render dialog mode - shows only header and positions cursor for input
// Used for command dialogs like /port, /title, etc.
export function renderDialog(promptText: string): void {
  const tree = getTree()
  const width = process.stdout.columns || 80

  // Clear terminal
  process.stdout.write(ansiEscapes.clearTerminal)
  process.stdout.write(ansiEscapes.cursorTo(0, 0))

  // Render only the header
  const header = tree.find('header')
  let currentRow = 0
  if (header) {
    const lines = header.render(width)
    for (const line of lines) {
      process.stdout.write(ansiEscapes.cursorTo(0, currentRow))
      process.stdout.write(line)
      currentRow++
    }
  }

  // Write the prompt text
  process.stdout.write('\n')
  process.stdout.write(ansiEscapes.cursorTo(2, currentRow+1))
  process.stdout.write(promptText)
}

// Show goodbye state - hide prompt area, show goodbye message
export function showGoodbye(): void {
  const tree = getTree()

  // Hide prompt area components
  tree.find('separator-top')?.hide()
  tree.find('prompt')?.hide()
  tree.find('separator-bottom')?.hide()
  tree.find('status')?.hide()

  // Show goodbye (it's a fixed component, always exists after initializeTree)
  tree.find('goodbye').show()

  // Render the updated tree
  renderTree()
}

// Render status area (bottom separator + status text) - for incremental updates
export function renderStatusArea(): void {
  // Update status text
  updateStatus()

  // renderFromComponent handles cursor save/restore internally
  renderFromComponent('separator-bottom')
}

// Add a user message to the tree (before separator-top)
export function addUserMessage(content: string): UserMessage {
  const tree = getTree()
  const separatorTop = tree.find('separator-top')

  const userMsg = new UserMessage(content)
  const msgId = `user-${Date.now()}`

  if (separatorTop) {
    tree.insertBefore(userMsg, separatorTop, msgId)
  } else {
    tree.appendChild(userMsg, msgId)
  }

  return userMsg
}

// Add an assistant message container to the tree (before separator-top)
export function addAssistantMessage(): AssistantMessage {
  const tree = getTree()
  const separatorTop = tree.find('separator-top')

  const assistantMsg = new AssistantMessage()
  const msgId = `assistant-${Date.now()}`

  if (separatorTop) {
    tree.insertBefore(assistantMsg, separatorTop, msgId)
  } else {
    tree.appendChild(assistantMsg, msgId)
  }

  return assistantMsg
}

// Show activity indicator (before separator-top)
export function showActivity(text: string): ActivityIndicator {
  const tree = getTree()
  const separatorTop = tree.find('separator-top')

  // Remove any existing activity indicator
  hideActivity()

  const indicator = new ActivityIndicator(text)

  if (separatorTop) {
    tree.insertBefore(indicator, separatorTop, 'activity')
  } else {
    tree.appendChild(indicator, 'activity')
  }

  // Render from the indicator down
  renderFromComponent('activity')

  // Start animation
  tree.startAnimation('activity', () => {
    indicator.advanceAnimation()
    renderComponent('activity')
  }, 150)

  return indicator
}

// Hide activity indicator
export function hideActivity(): void {
  const tree = getTree()
  const indicator = tree.find('activity')

  if (indicator) {
    tree.stopAnimation('activity')

    // Find what comes after indicator to re-render from there
    const children = tree.getChildren()
    const idx = children.findIndex(c => c.id === 'activity')
    const nextId = idx >= 0 && idx < children.length - 1 ? children[idx + 1].id : null

    tree.removeChild(indicator)

    // Re-render from next component (or do nothing if indicator was last)
    if (nextId) {
      renderFromComponent(nextId)
    }
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

  // Remove all message components (user-* and assistant-*)
  const toRemove: string[] = []
  for (const child of tree.getChildren()) {
    if (child.id.startsWith('user-') || child.id.startsWith('assistant-')) {
      toRemove.push(child.id)
    }
  }

  for (const id of toRemove) {
    const component = tree.find(id)
    if (component) {
      tree.removeChild(component)
    }
  }

  // Add messages from chat state (before separator-top)
  const separatorTop = tree.find('separator-top')

  for (let i = 0; i < state.chat.messages.length; i++) {
    const msg = state.chat.messages[i]
    if (msg.role === 'user') {
      const userMsg = new UserMessage(msg.content)
      const msgId = `user-${i}`
      if (separatorTop) {
        tree.insertBefore(userMsg, separatorTop, msgId)
      }
    } else if (msg.role === 'assistant') {
      const assistantMsg = new AssistantMessage()
      const text = new Text(msg.content, 'assistant')
      assistantMsg.appendChild(text)
      const msgId = `assistant-${i}`
      if (separatorTop) {
        tree.insertBefore(assistantMsg, separatorTop, msgId)
      }
    }
  }

  // Update status
  updateStatus()
}

// Clear all messages from tree
export function clearMessages(): void {
  const tree = getTree()

  const toRemove: string[] = []
  for (const child of tree.getChildren()) {
    if (child.id.startsWith('user-') || child.id.startsWith('assistant-')) {
      toRemove.push(child.id)
    }
  }

  for (const id of toRemove) {
    const component = tree.find(id)
    if (component) {
      tree.removeChild(component)
    }
  }

  updateStatus()
}

// Get prompt component
export function getPrompt(): Prompt | null {
  const tree = getTree()
  return tree.find('prompt') as Prompt | null
}


// Calculate a component's row position in the tree
export function getComponentRow(componentId: string): number {
  const tree = getTree()
  const width = process.stdout.columns || 80
  let row = 0

  for (const child of tree.getChildren()) {
    if (child.id === componentId) {
      return row
    }
    // Use cached height, but fall back to calculateHeight if cache is 0
    const height = child.getCachedHeight() || child.calculateHeight(width)
    if (child.getCachedHeight() === 0) {
      // process.stderr.write(`WARNING: ${child.id} has cachedHeight 0, using calculateHeight=${height}\n`)
      child.setCachedHeight(height)
    }
    row += height
  }

  return -1 // Not found
}

// Render a specific component at its position (incremental update)
export function renderComponent(componentId: string): void {
  const tree = getTree()
  const component = tree.find(componentId)
  if (!component) return

  const width = process.stdout.columns || 80
  const startRow = getComponentRow(componentId)
  if (startRow < 0) return

  const oldHeight = component.getCachedHeight()
  const lines = component.render(width)
  const newHeight = lines.length

  // Save cursor position
  process.stdout.write(ansiEscapes.cursorSavePosition)

  // Handle height change
  if (newHeight > oldHeight) {
    // Need to insert lines - move to end of old component and insert
    process.stdout.write(ansiEscapes.cursorTo(0, startRow + oldHeight))
    // Insert blank lines by scrolling down
    for (let i = 0; i < newHeight - oldHeight; i++) {
      process.stdout.write('\n')
    }
  } else if (newHeight < oldHeight) {
    // Need to delete lines - we'll handle this by clearing and re-rendering below components
  }

  // Render the component
  for (let i = 0; i < lines.length; i++) {
    process.stdout.write(ansiEscapes.cursorTo(0, startRow + i))
    process.stdout.write(ansiEscapes.eraseLine)
    process.stdout.write(lines[i])
  }

  // If component shrank, we need to re-render everything below
  if (newHeight < oldHeight) {
    // Clear the extra lines
    for (let i = newHeight; i < oldHeight; i++) {
      process.stdout.write(ansiEscapes.cursorTo(0, startRow + i))
      process.stdout.write(ansiEscapes.eraseLine)
    }

    // Re-render components below this one
    let currentRow = startRow + newHeight
    let foundComponent = false
    for (const child of tree.getChildren()) {
      if (foundComponent) {
        const childLines = child.render(width)
        for (const line of childLines) {
          process.stdout.write(ansiEscapes.cursorTo(0, currentRow))
          process.stdout.write(ansiEscapes.eraseLine)
          process.stdout.write(line)
          currentRow++
        }
        child.setCachedHeight(childLines.length)
      }
      if (child.id === componentId) {
        foundComponent = true
      }
    }
  }

  component.setCachedHeight(newHeight)
  component.clearDirty()

  // Restore cursor position
  process.stdout.write(ansiEscapes.cursorRestorePosition)
}

// Render from a specific component downward (for when components are added/removed)
export function renderFromComponent(componentId: string): void {
  const tree = getTree()
  const width = process.stdout.columns || 80

  // DEBUG: Log cached heights
  const debugHeights: string[] = []
  for (const child of tree.getChildren()) {
    debugHeights.push(`${child.id}:${child.getCachedHeight()}`)
  }
  // process.stderr.write(`renderFromComponent(${componentId}) heights: ${debugHeights.join(', ')}\n`)

  const startRow = getComponentRow(componentId)
  // process.stderr.write(`startRow for ${componentId}: ${startRow}\n`)
  if (startRow < 0) return

  // Save cursor
  process.stdout.write(ansiEscapes.cursorSavePosition)

  // Erase from startRow down
  process.stdout.write(ansiEscapes.cursorTo(0, startRow))
  process.stdout.write(ansiEscapes.eraseDown)

  // Render from componentId to end
  let foundStart = false
  let currentRow = startRow

  for (const child of tree.getChildren()) {
    if (child.id === componentId) {
      foundStart = true
    }
    if (foundStart) {
      const lines = child.render(width)
      for (const line of lines) {
        process.stdout.write(ansiEscapes.cursorTo(0, currentRow))
        process.stdout.write(line)
        currentRow++
      }
      child.setCachedHeight(lines.length)
      child.clearDirty()
    }
  }

  // Restore cursor
  process.stdout.write(ansiEscapes.cursorRestorePosition)
}

// Position cursor after the last rendered content (for streaming)
export function positionCursorAtEnd(): void {
  const tree = getTree()
  let row = 0

  for (const child of tree.getChildren()) {
    row += child.getCachedHeight()
  }

  process.stdout.write(ansiEscapes.cursorTo(0, row))
}

// Export component types for convenience
export {
  Root,
  Header,
  Separator,
  StatusText,
  Prompt,
  UserMessage,
  AssistantMessage,
  Text,
  ToolCall,
  ActivityIndicator,
}
