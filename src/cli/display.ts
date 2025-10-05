// Display Functions

import chalk from 'chalk'
import ansiEscapes from 'ansi-escapes'
import { state } from './state'

// Version is injected at build time via esbuild define
declare const __WITSY_VERSION__: string
const VERSION = typeof __WITSY_VERSION__ !== 'undefined' ? __WITSY_VERSION__ : 'dev'

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

export function displayFooter() {
  const terminalWidth = process.stdout.columns || 80
  const separatorColor = chalk.rgb(101, 113, 153)  // Blue-gray for separators
  const grayText = chalk.rgb(139, 148, 156)  // Muted gray for text

  // Print top separator
  console.log(separatorColor('─'.repeat(terminalWidth)))

  // Leave an empty line for the prompt (will move cursor back here)
  console.log('')  // Explicitly pass empty string

  // Print bottom separator
  console.log(separatorColor('─'.repeat(terminalWidth)))

  // Print footer WITHOUT newline at the end
  const leftText = state.engine && state.model
    ? `[${state.engine}: ${state.model}]`
    : '[connecting...]'

  const rightText = `${state.history.length} messages`
  const padding = Math.max(0, terminalWidth - leftText.length - rightText.length)

  process.stdout.write(grayText(leftText + ' '.repeat(padding) + rightText))

  // Now cursor is at the end of the footer line
  // Move cursor back up to the prompt line (2 lines up from current position)
  process.stdout.write(ansiEscapes.cursorUp(2))

  // Move to beginning of line
  process.stdout.write(ansiEscapes.cursorTo(0))
}

export function clearFooter() {

  // Move back up to top separator and erase it
  process.stdout.write(ansiEscapes.cursorUp(3))
  process.stdout.write(ansiEscapes.eraseLine)

  for (let i = 0; i < 4; i++) {
    process.stdout.write(ansiEscapes.cursorDown(1))
    process.stdout.write(ansiEscapes.eraseLine)
  }

  // Move back up
  process.stdout.write(ansiEscapes.cursorUp(4))
  process.stdout.write(ansiEscapes.eraseLine)
  process.stdout.write(ansiEscapes.cursorTo(0))
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

export function updateFooterRightText(text: string, lineOffset: number = 1) {
  const terminalWidth = process.stdout.columns || 80
  const grayText = chalk.rgb(139, 148, 156)

  const leftText = state.engine && state.model
    ? `[${state.engine}: ${state.model}]`
    : '[connecting...]'

  const padding = Math.max(0, terminalWidth - leftText.length - text.length)

  // Save cursor position
  process.stdout.write(ansiEscapes.cursorSavePosition)

  // Move to footer line (lineOffset + 1 down from current prompt position)
  // lineOffset accounts for how many lines the input currently spans
  process.stdout.write(ansiEscapes.cursorDown(lineOffset + 1))
  process.stdout.write(ansiEscapes.cursorTo(0))

  // Erase and rewrite footer
  process.stdout.write(ansiEscapes.eraseLine)
  process.stdout.write(grayText(leftText + ' '.repeat(padding) + text))

  // Restore cursor position
  process.stdout.write(ansiEscapes.cursorRestorePosition)
}

export function repositionFooter(delta: number) {
  const terminalWidth = process.stdout.columns || 80
  const separatorColor = chalk.rgb(101, 113, 153)
  const grayText = chalk.rgb(139, 148, 156)

  if (delta === 0) return

  const leftText = state.engine && state.model
    ? `[${state.engine}: ${state.model}]`
    : '[connecting...]'
  const rightText = `${state.history.length} messages`
  const padding = Math.max(0, terminalWidth - leftText.length - rightText.length)

  if (delta > 0) {
    // Prompt grew - need to move footer down
    process.stdout.write(ansiEscapes.cursorSavePosition)
    process.stdout.write(ansiEscapes.eraseEndLine)
    process.stdout.write(ansiEscapes.cursorDown(1))
    process.stdout.write(ansiEscapes.cursorTo(0))
    process.stdout.write(ansiEscapes.eraseLine)
    process.stdout.write(separatorColor('─'.repeat(terminalWidth)))
    process.stdout.write(ansiEscapes.cursorDown(1))
    process.stdout.write(ansiEscapes.cursorTo(0))
    process.stdout.write(ansiEscapes.eraseLine)
    process.stdout.write(grayText(leftText + ' '.repeat(padding) + rightText))
    process.stdout.write(ansiEscapes.cursorRestorePosition)
  } else {
    // Prompt shrunk - need to move footer up and clean old position
    process.stdout.write(ansiEscapes.cursorSavePosition)
    process.stdout.write(ansiEscapes.cursorDown(1))
    process.stdout.write(ansiEscapes.cursorTo(0))
    process.stdout.write(ansiEscapes.eraseLine)
    process.stdout.write(separatorColor('─'.repeat(terminalWidth)))
    process.stdout.write(ansiEscapes.cursorDown(1))
    process.stdout.write(ansiEscapes.cursorTo(0))
    process.stdout.write(ansiEscapes.eraseLine)
    process.stdout.write(grayText(leftText + ' '.repeat(padding) + rightText))
    process.stdout.write(ansiEscapes.cursorDown(1))
    process.stdout.write(ansiEscapes.cursorTo(0))
    process.stdout.write(ansiEscapes.eraseLine)
    process.stdout.write(ansiEscapes.cursorRestorePosition)
  }
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

export function clearCommandSuggestions(lineCount: number) {
  if (lineCount === 0) return

  // Save cursor position
  process.stdout.write(ansiEscapes.cursorSavePosition)

  // Move down past footer
  process.stdout.write(ansiEscapes.cursorDown(3))
  process.stdout.write(ansiEscapes.cursorTo(0))

  // Erase all suggestion lines
  for (let i = 0; i < lineCount; i++) {
    process.stdout.write(ansiEscapes.eraseLine)
    if (i < lineCount - 1) {
      process.stdout.write(ansiEscapes.cursorDown(1))
      process.stdout.write(ansiEscapes.cursorTo(0))
    }
  }

  // Restore cursor position
  process.stdout.write(ansiEscapes.cursorRestorePosition)
}

export function displayConversation() {
  const grayText = chalk.rgb(139, 148, 156)  // Muted gray for text

  // Always add ONE blank line after header
  console.log()

  for (let i = 0; i < state.history.length; i++) {
    const msg = state.history[i]
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

