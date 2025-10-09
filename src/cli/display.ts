// Display Functions

import chalk from 'chalk'
import ansiEscapes from 'ansi-escapes'
import { state } from './state'
import { MessageCli } from './models'

// Version is injected at build time via esbuild define
declare const __WITSY_VERSION__: string
const VERSION = typeof __WITSY_VERSION__ !== 'undefined' ? __WITSY_VERSION__ : 'dev'

// override gray
export const primaryText = chalk.rgb(215, 119, 87)
export const secondaryText = chalk.rgb(101, 113, 153)
export const tertiaryText = chalk.rgb(180, 142, 238)
export const successText = chalk.greenBright
export const grayText = chalk.rgb(139, 148, 156)

// Reasoning display constants
const REASONING_SHOWN_INDICATOR = '◆'
const REASONING_HIDDEN_INDICATOR = '◇'
const REASONING_AVAILABLE_TEXT = ''//TAB to show reasoning'

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

  console.log(`
${primaryText('  ██  █  ██')}  ${chalk.bold('Witsy CLI')} ${grayText('v' + VERSION)}
${primaryText('  ██ ███ ██')}  ${grayText('AI Assistant · Command Line Interface')}
${primaryText('   ███ ███')}   ${grayText(`http://localhost:${state.port}`)}
`)
}

export function getDefaultFooterLeftText(): string {
  return state.engine && state.model
    ? `${state.engine.name} · ${state.model.name}`
    : '[connecting…]'
}

export function getDefaultFooterRightText(inputText?: string): string {
  if (state.chat.messages.length === 0) {
    // Don't show shortcuts hint if user has typed something (including spaces)
    if (inputText && inputText.length > 0) {
      return ''
    }
    return '? for shortcuts'
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
function renderFooterContent(rightText?: string, inputText?: string) {

  const terminalWidth = process.stdout.columns || 80

  const leftText = getDefaultFooterLeftText()
  rightText = rightText ?? getDefaultFooterRightText(inputText)
  const padding = Math.max(0, terminalWidth - leftText.length - rightText.length - 4)

  process.stdout.write(secondaryText('─'.repeat(terminalWidth)) + '\n')
  process.stdout.write(grayText('  ' + leftText + ' '.repeat(padding) + rightText + '  '))
}

export function displayFooter(inputText?: string) {

  // make sure we have the space
  process.stdout.write('\n\n\n\n')
  process.stdout.write(ansiEscapes.cursorUp(4))

  const terminalWidth = process.stdout.columns || 80

  // Print top separator
  process.stdout.write(secondaryText('─'.repeat(terminalWidth)))
  process.stdout.write(ansiEscapes.cursorDown(2))
  process.stdout.write(ansiEscapes.cursorTo(0))

  // Render footer using helper
  renderFooterContent(undefined, inputText)

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

export function updateFooterRightText(initialInputY: number, lineCount: number, text?: string, inputText?: string) {

  // Save cursor position
  process.stdout.write(ansiEscapes.cursorSavePosition)

  // Move to footer line
  process.stdout.write(ansiEscapes.cursorTo(0, initialInputY + lineCount - 1))
  process.stdout.write(ansiEscapes.eraseDown)
  renderFooterContent(text, inputText)

  // Restore cursor position
  process.stdout.write(ansiEscapes.cursorRestorePosition)
}

export function repositionFooter(initialInputY: number, previousLineCount: number, newLineCount: number, inputText?: string) {

  // Save current cursor position (don't interrupt terminal-kit's rendering)
  process.stdout.write(ansiEscapes.cursorSavePosition)

  // Go to old footer position and erase it
  process.stdout.write(ansiEscapes.cursorTo(0, initialInputY + previousLineCount - 1))
  process.stdout.write(ansiEscapes.eraseDown)

  // Move to new footer position
  process.stdout.write(ansiEscapes.cursorTo(0, initialInputY + newLineCount - 1))

  // Render footer at new position
  renderFooterContent(undefined, inputText)

  // Restore cursor - let terminal-kit continue rendering
  process.stdout.write(ansiEscapes.cursorRestorePosition)
}

export function displayShortcutHelp(initialInputY: number, lineCount: number): void {
  // Save cursor position
  process.stdout.write(ansiEscapes.cursorSavePosition)

  // Move to footer line (where the status text normally appears)
  process.stdout.write(ansiEscapes.cursorTo(0, initialInputY + lineCount))
  process.stdout.write(ansiEscapes.eraseDown)

  // Define 3 columns (currently using only first 2)
  const col1Width = 30
  const col2Width = 45
  const col3Width = 30

  // First row: / for commands | double tap esc to clear input
  const row1Col1 = '/ for commands'
  const row1Col2 = 'double tap esc to clear input'
  const row1Col3 = ''//tab to toggle reasoning display'
  process.stdout.write(grayText('  ' + row1Col1.padEnd(col1Width) + row1Col2.padEnd(col2Width) + row1Col3.padEnd(col3Width)))

  // Move to next line
  process.stdout.write('\n')

  // Second row: empty | shift + ⏎ for newline
  const row2Col1 = ''
  const row2Col2 = 'shift + ⏎ for newline'
  const row2Col3 = ''
  process.stdout.write(grayText('  ' + row2Col1.padEnd(col1Width) + row2Col2.padEnd(col2Width) + row2Col3.padEnd(col3Width)))

  // Restore cursor position
  process.stdout.write(ansiEscapes.cursorRestorePosition)
}

export function clearShortcutHelp(initialInputY: number, lineCount: number, inputText?: string): void {
  // Save cursor position
  process.stdout.write(ansiEscapes.cursorSavePosition)

  // Move to footer line and redraw the normal footer
  process.stdout.write(ansiEscapes.cursorTo(0, initialInputY + lineCount - 1))
  process.stdout.write(ansiEscapes.eraseDown)
  renderFooterContent(undefined, inputText)

  // Restore cursor position
  process.stdout.write(ansiEscapes.cursorRestorePosition)
}

export function displayCommandSuggestions(
  commands: Array<{ name: string; description: string }>,
  selectedIndex: number

): number {
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
    const prefix = isSelected ? tertiaryText('  › ') : '    '
    const cmdText = isSelected
      ? tertiaryText(cmd.name.padEnd(15) + cmd.description)
      : grayText(cmd.name.padEnd(15) + cmd.description)

    console.log(prefix + cmdText)
  }

  // Restore cursor position
  process.stdout.write(ansiEscapes.cursorRestorePosition)

  // Return number of lines rendered (blank line + commands)
  return commands.length + 1
}

// Word-wrap text with padding on each physical line
export function padContent(text: string, width: number = process.stdout.columns || 80): string {
  const maxLineWidth = width - 4  // Reserve 2 left + 2 right for padding
  const lines: string[] = []

  // Split by existing newlines first (preserve intentional line breaks)
  const paragraphs = text.split('\n')

  for (const paragraph of paragraphs) {
    // Handle empty paragraphs
    if (paragraph === '') {
      lines.push('    ')
      continue
    }

    const words = paragraph.split(' ')
    let currentLine = ''

    for (const word of words) {
      // Skip empty words (from multiple spaces)
      if (word === '') continue

      // If word alone is longer than maxLineWidth, break it
      if (word.length > maxLineWidth) {
        // Flush current line if not empty
        if (currentLine) {
          lines.push(`  ${currentLine.trimEnd()}  `)
          currentLine = ''
        }
        // Break long word into chunks
        for (let i = 0; i < word.length; i += maxLineWidth) {
          lines.push(`  ${word.slice(i, i + maxLineWidth)}  `)
        }
        continue
      }

      // Try adding word to current line
      const testLine = currentLine ? `${currentLine} ${word}` : word

      if (testLine.length <= maxLineWidth) {
        currentLine = testLine
      } else {
        // Line would be too long, flush current line and start new one
        lines.push(`  ${currentLine.trimEnd()}  `)
        currentLine = word
      }
    }

    // Flush remaining line
    if (currentLine) {
      lines.push(`  ${currentLine.trimEnd()}  `)
    }
  }

  return lines.join('\n')
}

export function writeReasoningAvailableIndicator(): number {
  process.stdout.write(grayText(REASONING_HIDDEN_INDICATOR + ' ' + REASONING_AVAILABLE_TEXT))
  return 1
}

export function writeReasoningTokens(msg: MessageCli, takeSpace: boolean = false): number {
  const paddedReasoning = padContent(msg.reasoning.trim())
  const lines = paddedReasoning.split('\n')
  const lineCount = lines.length

  if (takeSpace) {
    // Reserve space by writing blank lines, then move cursor back up
    console.log('\n'.repeat(lineCount - 1))
    process.stdout.write(ansiEscapes.cursorUp(lineCount))
  }

  process.stdout.write(grayText(REASONING_SHOWN_INDICATOR + ' ' + paddedReasoning.slice(2)))
  return lineCount
}

export function displayConversation() {

  // Always add ONE blank line after header
  console.log()

  for (let i = 0; i < state.chat.messages.length; i++) {
    const msg = state.chat.messages[i]
    if (msg.role === 'user') {
      // User messages: gray with "> " prefix, content gets padding but not the prefix
      const paddedContent = padContent(msg.content)
      // Remove left padding (2 spaces) since "> " already provides positioning
      console.log(grayText('> ' + paddedContent.slice(2)))
    } else {
      // Assistant messages: white (default terminal color)
      // // Show reasoning if enabled and available
      // if (msg.reasoning) {
      //   if (state.showReasoning) {
      //     writeReasoningTokens(msg)
      //     console.log('\n')
      //   } else {
      //     writeReasoningAvailableIndicator()
      //     console.log('\n')
      //   }
      // }
      console.log(padContent(msg.content.trim()))
    }
    // Blank line after each message
    console.log()
  }
}

// Pulsating animation frames for tool execution
const ANIMATION_FRAMES = [
  '⋅',
  '∘',
  '○',
  '◯',
  '⊙',
  '◉',
  '⊙',
  '◯',
  '○',
  '∘',
]

let animationIndex = 0

function getToolAnimationFrame(): string {
  const frame = ANIMATION_FRAMES[animationIndex]
  animationIndex = (animationIndex + 1) % ANIMATION_FRAMES.length
  return frame
}

export function startPulseAnimation(text: string): NodeJS.Timeout {
  // Display initial frame
  process.stdout.write(chalk.blueBright(getToolAnimationFrame()) + ` ${text}`)

  // // Start animation interval
  // return setInterval(() => {
  //   process.stdout.write(ansiEscapes.cursorTo(0))
  //   process.stdout.write(ansiEscapes.eraseLine)
  //   process.stdout.write(secondaryText(getToolAnimationFrame()) + ` ${text}`)
  // }, 150)
  return undefined
}

export function stopPulseAnimation(interval: NodeJS.Timeout | null): void {
  if (interval) {
    clearInterval(interval)
  }
}

// Debug logging function - writes to line 1 when debug mode is enabled
let debugTimeout: NodeJS.Timeout | null = null

export function debugLog(message: string): void {
  if (state.debug) {
    process.stdout.write(ansiEscapes.cursorSavePosition)
    process.stdout.write(ansiEscapes.cursorTo(0, 0))
    process.stdout.write(ansiEscapes.eraseLine)
    process.stdout.write(`DEBUG: ${message}`)
    process.stdout.write(ansiEscapes.cursorRestorePosition)

    // Clear debug line after 3 seconds
    if (debugTimeout) {
      clearTimeout(debugTimeout)
    }
    debugTimeout = setTimeout(() => {
      process.stdout.write(ansiEscapes.cursorSavePosition)
      process.stdout.write(ansiEscapes.cursorTo(0, 0))
      process.stdout.write(ansiEscapes.eraseLine)
      process.stdout.write(ansiEscapes.cursorRestorePosition)
      debugTimeout = null
    }, 3000)
  }
}

// Setup console.debug override (must be called after state.debug is set)
export function setupDebugLogging(): void {
  // const originalDebug = console.debug
  console.debug = (...args: any[]) => {
    if (state.debug) {
      debugLog(args.map(arg => String(arg)).join(' '))
    } else {
      //originalDebug(...args)
    }
  }
}
