// Display Functions

import chalk from 'chalk'
import ansiEscapes from 'ansi-escapes'
import { state } from './state'

// Version is injected at build time via esbuild define
declare const __WITSY_VERSION__: string
const VERSION = typeof __WITSY_VERSION__ !== 'undefined' ? __WITSY_VERSION__ : 'dev'

export function resetDisplay(beforeFooter?: () => void) {
  console.clear()
  displayHeader()
  displayConversation()
  if (beforeFooter) {
    beforeFooter()
  }
  displayFooter()
}

export function displayHeader() {
  console.clear()
  const iconColor = chalk.rgb(215, 119, 87)  // Coral/orange for icon
  const grayText = chalk.rgb(139, 148, 156)  // Muted gray for text

  console.log(`
${iconColor('  ██  █  ██')}  ${chalk.bold('Witsy CLI')} ${grayText('v' + VERSION)}
${iconColor('  ██ ███ ██')}  ${grayText('AI Assistant · Command Line Interface')}
${iconColor('   ███ ███')}   ${grayText(`http://localhost:${state.port}`)}
`)
}

export function getDefaultFooterLeftText(): string {
  return state.engine && state.model
    ? `${state.engine} ${state.model}`
    : '[connecting...]'
}

export function getDefaultFooterRightText(): string {
  if (state.chat.messages.length === 0) {
    return ''
  }

  const msgCount = `${state.chat.messages.length} messages`

  if (state.chat.uuid) {
    // Chat is saved - show auto-save status
    return `${msgCount} · auto-saving`
  } else if (state.chat.messages.length >= 4) {
    // Long conversation not saved - remind user
    return `${msgCount} · type /save`
  } else {
    // Short conversation - just show count
    return msgCount
  }
}

// Helper to render footer content (separator + status line)
function renderFooterContent(rightText?: string) {
  
  const terminalWidth = process.stdout.columns || 80
  const separatorColor = chalk.rgb(101, 113, 153)
  const grayText = chalk.rgb(139, 148, 156)

  const leftText = getDefaultFooterLeftText()
  rightText = rightText ?? getDefaultFooterRightText()
  const padding = Math.max(0, terminalWidth - leftText.length - rightText.length)

  process.stdout.write(separatorColor('─'.repeat(terminalWidth)) + '\n')
  process.stdout.write(grayText(leftText + ' '.repeat(padding) + rightText))
}

export function displayFooter() {
  const terminalWidth = process.stdout.columns || 80
  const separatorColor = chalk.rgb(101, 113, 153)

  // Print top separator
  process.stdout.write(separatorColor('─'.repeat(terminalWidth)))
  process.stdout.write(ansiEscapes.cursorDown(2))
  process.stdout.write(ansiEscapes.cursorTo(0))

  // Render footer using helper
  renderFooterContent()

  // Move cursor back up to the prompt line (1 line up from current position)
  process.stdout.write(ansiEscapes.cursorUp(2))
  process.stdout.write(ansiEscapes.cursorTo(0))
}

export function clearFooter() {
  // After Enter, cursor may have moved down
  // Move up 2 lines to top separator and erase everything down
  process.stdout.write(ansiEscapes.cursorUp(2))
  process.stdout.write(ansiEscapes.cursorTo(0))
  process.stdout.write(ansiEscapes.eraseDown)
}


export function eraseLines(count: number) {
  // Move cursor to beginning of current line
  process.stdout.write(ansiEscapes.cursorTo(0))

  // Move up and erase each line
  for (let i = 0; i < count; i++) {
    process.stdout.write(ansiEscapes.cursorUp())
    process.stdout.write(ansiEscapes.eraseLine)
  }
}

export function updateFooterRightText(initialInputY: number, lineCount: number, text?: string) {

  // Save cursor position
  process.stdout.write(ansiEscapes.cursorSavePosition)

  // Move to footer line
  process.stdout.write(ansiEscapes.cursorTo(0, initialInputY + lineCount - 1))
  process.stdout.write(ansiEscapes.eraseDown)
  renderFooterContent(text)

  // Restore cursor position
  process.stdout.write(ansiEscapes.cursorRestorePosition)
}

export function repositionFooter(initialInputY: number, previousLineCount: number, newLineCount: number) {
  
  // Save current cursor position (don't interrupt terminal-kit's rendering)
  process.stdout.write(ansiEscapes.cursorSavePosition)

  // Go to old footer position and erase it
  process.stdout.write(ansiEscapes.cursorTo(0, initialInputY + previousLineCount - 1))
  process.stdout.write(ansiEscapes.eraseDown)

  // Move to new footer position
  process.stdout.write(ansiEscapes.cursorTo(0, initialInputY + newLineCount - 1))

  // Render footer at new position
  renderFooterContent()

  // Restore cursor - let terminal-kit continue rendering
  process.stdout.write(ansiEscapes.cursorRestorePosition)
}

export function displayCommandSuggestions(
  commands: Array<{ name: string; description: string }>,
  selectedIndex: number
): number {
  const grayText = chalk.rgb(139, 148, 156)
  const highlightColor = chalk.rgb(180, 142, 238) // Light purple for selected

  // Save cursor position
  process.stdout.write(ansiEscapes.cursorSavePosition)

  // Move down past footer (1 line down from input)
  process.stdout.write(ansiEscapes.cursorDown(3))
  process.stdout.write(ansiEscapes.cursorTo(0))

  // Blank line before suggestions
  console.log()

  // Display each command
  for (let i = 0; i < commands.length; i++) {
    const cmd = commands[i]
    const isSelected = i === selectedIndex
    const prefix = isSelected ? highlightColor('  › ') : '    '
    const cmdText = isSelected
      ? highlightColor(cmd.name.padEnd(15) + cmd.description)
      : grayText(cmd.name.padEnd(15) + cmd.description)

    console.log(prefix + cmdText)
  }

  // Restore cursor position
  process.stdout.write(ansiEscapes.cursorRestorePosition)

  // Return number of lines rendered (blank line + commands)
  return commands.length + 1
}

export function displayConversation() {
  const grayText = chalk.rgb(139, 148, 156)  // Muted gray for text

  // Always add ONE blank line after header
  console.log()

  for (let i = 0; i < state.chat.messages.length; i++) {
    const msg = state.chat.messages[i]
    if (msg.role === 'user') {
      // User messages: gray with "> " prefix
      console.log(grayText('> ' + msg.content))
    } else {
      // Assistant messages: white (default terminal color)
      console.log(msg.content)
    }
    // Blank line after each message
    console.log()
  }
}

