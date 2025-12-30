import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { displayHeader, displayFooter, displayConversation, repositionFooter, updateFooterRightText, resetDisplay, clearFooter, eraseLines, displayCommandSuggestions, displayShortcutHelp, clearShortcutHelp, getDefaultFooterRightText, padContent, initToolsDisplay, addTool, completeTool, startToolsAnimation, stopToolsAnimation, clearToolsDisplay, resetAnimationIndex } from '@/cli/display'
import { state } from '@/cli/state'
import { VirtualTerminal } from './VirtualTerminal'
import { ChatCli, MessageCli } from '@/cli/models'

describe('CLI Display Requirements', () => {
  let terminal: VirtualTerminal
  let originalLog: typeof console.log
  let originalWrite: typeof process.stdout.write
  let originalClear: typeof console.clear
  let originalColumns: number | undefined

  beforeEach(() => {
    // Create virtual terminal
    terminal = new VirtualTerminal(80, 24)

    // Save original functions
    originalLog = console.log
    originalWrite = process.stdout.write
    originalClear = console.clear
    originalColumns = process.stdout.columns

    // Mock to use virtual terminal
    console.log = (...args: any[]) => terminal.log(...args)
    process.stdout.write = ((text: any) => {
      terminal.write(text)
      return true
    }) as any
    console.clear = () => terminal.clear()

    // Set terminal width
    Object.defineProperty(process.stdout, 'columns', {
      value: 80,
      writable: true,
      configurable: true
    })

    // Reset state
    state.port = 8090
    state.engine = { id: 'openai', name: 'OpenAI' }
    state.model = { id: 'gpt-4', name: 'GPT-4' }
    state.chat = new ChatCli('CLI Session')
    state.chat.uuid = ''
  })

  afterEach(() => {
    // Restore
    console.log = originalLog
    process.stdout.write = originalWrite
    console.clear = originalClear
    if (originalColumns !== undefined) {
      Object.defineProperty(process.stdout, 'columns', {
        value: originalColumns,
        writable: true,
        configurable: true
      })
    }
    vi.clearAllMocks()
  })

  describe('Requirement: Initial Display', () => {
    test('should show complete initial layout with prompt and footer', async () => {
      // Act: Display initial screen
      displayHeader()
      displayConversation()  // empty
      displayFooter()
      process.stdout.write('>')  // Simulate prompt appearing at cursor

      // Assert: Exact expected output per requirements
      // HEADER
      // SEPARATOR
      // PROMPT WHERE CURSOR IS
      // SEPARATOR
      // FOOTER (current model + number of messages)
      const expected = `
  ██  █  ██  Witsy CLI vdev
  ██ ███ ██  AI Assistant · Command Line Interface
   ███ ███   http://localhost:8090


────────────────────────────────────────────────────────────────────────────────
>
────────────────────────────────────────────────────────────────────────────────
  OpenAI · GPT-4                                               ? for shortcuts  `

      expect(terminal.getVisibleText()).toBe(expected)
    })
  })

  describe('Requirement: After User Message', () => {
    test('should show layout with user message', async () => {
      // Arrange: User submitted "hello"
      const userMsg = new MessageCli('user', 'hello')
      state.chat.addMessage(userMsg)

      // Act: Display after user message
      // HEADER
      // blank line
      // hello
      // blank line
      // SEPARATOR
      // PROMPT WHERE CURSOR IS
      // SEPARATOR
      // FOOTER
      displayHeader()
      displayConversation()
      displayFooter()
      process.stdout.write('>')  // Simulate prompt appearing at cursor

      const expected = `
  ██  █  ██  Witsy CLI vdev
  ██ ███ ██  AI Assistant · Command Line Interface
   ███ ███   http://localhost:8090


> hello

────────────────────────────────────────────────────────────────────────────────
>
────────────────────────────────────────────────────────────────────────────────
  OpenAI · GPT-4                                                    1 messages  `

      expect(terminal.getVisibleText()).toBe(expected)
    })
  })

  describe('Requirement: After Conversation', () => {
    test('should show layout with full conversation', async () => {
      // Arrange: User said "hello", assistant replied "Hello how are you?"
      const userMsg = new MessageCli('user', 'hello')
      const assistantMsg = new MessageCli('assistant', 'Hello how are you?')
      state.chat.addMessage(userMsg)
      state.chat.addMessage(assistantMsg)

      // Act: Display after assistant response
      // HEADER
      // blank line
      // hello
      // blank line
      // Hello how are you?
      // blank line
      // SEPARATOR
      // PROMPT WHERE CURSOR IS
      // SEPARATOR
      // FOOTER
      displayHeader()
      displayConversation()
      displayFooter()
      process.stdout.write('>')  // Simulate prompt appearing at cursor

      const expected = `
  ██  █  ██  Witsy CLI vdev
  ██ ███ ██  AI Assistant · Command Line Interface
   ███ ███   http://localhost:8090


> hello

  Hello how are you?

────────────────────────────────────────────────────────────────────────────────
>
────────────────────────────────────────────────────────────────────────────────
  OpenAI · GPT-4                                                    2 messages  `

      expect(terminal.getVisibleText()).toBe(expected)
    })
  })

  describe('Requirement: Multiple Messages', () => {
    test('should show layout with multiple exchanges', async () => {
      // Arrange: Multiple message exchanges
      state.chat.addMessage(new MessageCli('user', 'Tell me a joke'))
      state.chat.addMessage(new MessageCli('assistant', 'Why did the chicken cross the road?'))
      state.chat.addMessage(new MessageCli('user', 'Why?'))
      state.chat.addMessage(new MessageCli('assistant', 'To get to the other side!'))

      // Act
      displayHeader()
      displayConversation()
      displayFooter()
      process.stdout.write('>')  // Simulate prompt appearing at cursor

      const expected = `
  ██  █  ██  Witsy CLI vdev
  ██ ███ ██  AI Assistant · Command Line Interface
   ███ ███   http://localhost:8090


> Tell me a joke

  Why did the chicken cross the road?

> Why?

  To get to the other side!

────────────────────────────────────────────────────────────────────────────────
>
────────────────────────────────────────────────────────────────────────────────
  OpenAI · GPT-4                                       4 messages · type /save  `

      expect(terminal.getVisibleText()).toBe(expected)
    })
  })

  describe('Requirement: Save Status in Footer', () => {
    test('should show auto-saving status when chat is saved', async () => {
      // Arrange: Saved chat with UUID
      state.chat.addMessage(new MessageCli('user', 'hello'))
      state.chat.addMessage(new MessageCli('assistant', 'hi there'))
      state.chat.uuid = 'some-uuid-123'

      // Act
      displayHeader()
      displayConversation()
      displayFooter()
      process.stdout.write('>')

      const expected = `
  ██  █  ██  Witsy CLI vdev
  ██ ███ ██  AI Assistant · Command Line Interface
   ███ ███   http://localhost:8090


> hello

  hi there

────────────────────────────────────────────────────────────────────────────────
>
────────────────────────────────────────────────────────────────────────────────
  OpenAI · GPT-4                                      2 messages · auto-saving  `

      expect(terminal.getVisibleText()).toBe(expected)
    })
  })

  describe('Requirement: Footer Repositioning for Multi-line Input', () => {
    test('should move footer down when input wraps from 1 to 2 lines', () => {
      // Arrange: Display initial layout with 1-line prompt
      displayHeader()
      displayConversation()
      displayFooter()
      process.stdout.write('> ')  // Initial prompt

      // Get initial cursor position (where prompt is)
      const initialInputY = terminal.getCursorPosition().row

      // Act: Simulate input wrapping to 2 lines
      // When user types a long line that wraps, repositionFooter is called
      repositionFooter(initialInputY, 1, 2)

      // Assert: Footer should have moved down 1 line
      // Note: repositionFooter only handles footer, not input area clearing
      // The old separator stays - in real app, witsyInputField handles the input area
      const expected = `
  ██  █  ██  Witsy CLI vdev
  ██ ███ ██  AI Assistant · Command Line Interface
   ███ ███   http://localhost:8090


────────────────────────────────────────────────────────────────────────────────
>
────────────────────────────────────────────────────────────────────────────────
  OpenAI · GPT-4                                               ? for shortcuts  `

      expect(terminal.getVisibleText()).toBe(expected)
    })

    test('should move footer down multiple lines for very long input', () => {
      // Arrange: Initial display
      displayHeader()
      displayConversation()
      displayFooter()
      process.stdout.write('> ')

      const initialInputY = terminal.getCursorPosition().row

      // Act: Simulate input wrapping to 3 lines (e.g., large paste)
      repositionFooter(initialInputY, 1, 3)

      // Assert: Footer should have moved down 2 lines
      // Note: repositionFooter only handles footer, not input area clearing
      // The old separator stays - in real app, witsyInputField's redraw(forceClear) handles full clearing
      const expected = `
  ██  █  ██  Witsy CLI vdev
  ██ ███ ██  AI Assistant · Command Line Interface
   ███ ███   http://localhost:8090


────────────────────────────────────────────────────────────────────────────────
>
────────────────────────────────────────────────────────────────────────────────
────────────────────────────────────────────────────────────────────────────────
  OpenAI · GPT-4                                               ? for shortcuts  `

      expect(terminal.getVisibleText()).toBe(expected)
    })

    test('should move footer up when input shrinks from 2 to 1 line', () => {
      // Arrange: Start with 2-line input (footer already moved down)
      displayHeader()
      displayConversation()
      displayFooter()
      const initialInputY = terminal.getCursorPosition().row

      // First move footer down for 2-line input
      repositionFooter(initialInputY, 1, 2)

      // Act: User deletes text, input shrinks to 1 line
      repositionFooter(initialInputY, 2, 1)

      // Assert: Footer should move back up to original position
      // Old footer lines (at position 2) are cleared
      const expected = `
  ██  █  ██  Witsy CLI vdev
  ██ ███ ██  AI Assistant · Command Line Interface
   ███ ███   http://localhost:8090


────────────────────────────────────────────────────────────────────────────────
────────────────────────────────────────────────────────────────────────────────
  OpenAI · GPT-4                                               ? for shortcuts  `

      expect(terminal.getVisibleText()).toBe(expected)
    })

    test('should preserve footer content when repositioning', () => {
      // Arrange: Display with existing conversation
      const userMsg = new MessageCli('user', 'hello')
      const assistantMsg = new MessageCli('assistant', 'hi')
      state.chat.addMessage(userMsg)
      state.chat.addMessage(assistantMsg)

      displayHeader()
      displayConversation()
      displayFooter()
      const initialInputY = terminal.getCursorPosition().row

      // Act: Reposition footer
      repositionFooter(initialInputY, 1, 2)

      // Assert: Footer content (message count) should be preserved
      expect(terminal.contains('2 messages')).toBe(true)
      expect(terminal.contains('OpenAI · GPT-4')).toBe(true)
    })

    test('should handle edge case of no line count change', () => {
      // Arrange: Initial display
      displayHeader()
      displayConversation()
      displayFooter()
      const initialInputY = terminal.getCursorPosition().row
      process.stdout.write('> ')

      // Act: Call repositionFooter with same line count (shouldn't happen in practice, but test defensiveness)
      repositionFooter(initialInputY, 1, 1)

      // Assert: Footer content preserved even though prompt erased (repositionFooter always erases/redraws)
      expect(terminal.contains('OpenAI · GPT-4')).toBe(true)
      expect(terminal.contains('────────────────')).toBe(true)
    })
  })

  describe('Requirement: Dynamic Footer Text Updates', () => {
    test('should update footer text during escape hint with 1-line input', () => {
      // Arrange: Initial display
      displayHeader()
      displayConversation()
      displayFooter()
      const initialInputY = terminal.getCursorPosition().row
      process.stdout.write('> ')

      // Act: User presses escape once, footer text changes
      updateFooterRightText(initialInputY, 1, 'Press Escape again to clear')

      // Assert: Footer text updated, position unchanged (prompt was erased by updateFooterRightText)
      expect(terminal.contains('Press Escape again to clear')).toBe(true)
      expect(terminal.contains('OpenAI · GPT-4')).toBe(true)

      const expected = `
  ██  █  ██  Witsy CLI vdev
  ██ ███ ██  AI Assistant · Command Line Interface
   ███ ███   http://localhost:8090


────────────────────────────────────────────────────────────────────────────────
────────────────────────────────────────────────────────────────────────────────
  OpenAI · GPT-4                                   Press Escape again to clear  `

      expect(terminal.getVisibleText()).toBe(expected)
    })

    test('should update footer text with multi-line input', () => {
      // Arrange: Display with 2-line input
      displayHeader()
      displayConversation()
      displayFooter()
      const initialInputY = terminal.getCursorPosition().row

      // Move footer for 2-line input
      repositionFooter(initialInputY, 1, 2)

      // Act: Update footer text for escape hint
      updateFooterRightText(initialInputY, 2, 'Press Escape again to clear')

      // Assert: Footer text updated at correct position (prompt was erased)
      expect(terminal.contains('Press Escape again to clear')).toBe(true)

      const expected = `
  ██  █  ██  Witsy CLI vdev
  ██ ███ ██  AI Assistant · Command Line Interface
   ███ ███   http://localhost:8090


────────────────────────────────────────────────────────────────────────────────

────────────────────────────────────────────────────────────────────────────────
  OpenAI · GPT-4                                   Press Escape again to clear  `

      expect(terminal.getVisibleText()).toBe(expected)
    })

    test('should restore default footer text after escape timeout', () => {
      // Arrange: Footer showing escape hint
      state.chat.addMessage(new MessageCli('user', 'test'))
      displayHeader()
      displayConversation()
      displayFooter()
      const initialInputY = terminal.getCursorPosition().row
      process.stdout.write('> ')

      // Show escape hint
      updateFooterRightText(initialInputY, 1, 'Press Escape again to clear')

      // Act: Timeout fires, restore default text
      updateFooterRightText(initialInputY, 1)  // No text param = use default

      // Assert: Default text restored (message count)
      expect(terminal.contains('1 messages')).toBe(true)
      expect(terminal.contains('Press Escape again to clear')).toBe(false)
    })
  })

  describe('Requirement: resetDisplay', () => {
    test('should redraw entire screen with header, conversation, and footer', () => {
      // Arrange: State with messages
      state.chat.addMessage(new MessageCli('user', 'hello'))
      state.chat.addMessage(new MessageCli('assistant', 'hi'))

      // Act
      resetDisplay()

      // Assert: Complete screen layout
      expect(terminal.contains('Witsy CLI')).toBe(true)
      expect(terminal.contains('> hello')).toBe(true)
      expect(terminal.contains('  hi')).toBe(true)
      expect(terminal.contains('OpenAI · GPT-4')).toBe(true)
      expect(terminal.contains('2 messages')).toBe(true)
    })

    test('should call optional beforeFooter callback', () => {
      // Arrange
      let callbackCalled = false
      const beforeFooter = () => {
        callbackCalled = true
        console.log('Custom content')
      }

      // Act
      resetDisplay(beforeFooter)

      // Assert
      expect(callbackCalled).toBe(true)
      expect(terminal.contains('Custom content')).toBe(true)
    })
  })

  describe('Requirement: clearFooter', () => {
    test('should erase footer from screen', () => {
      // Arrange: Display with footer
      displayHeader()
      displayConversation()
      displayFooter()
      process.stdout.write('> test')

      // Verify footer is there
      expect(terminal.contains('OpenAI · GPT-4')).toBe(true)

      // Act: Clear footer
      clearFooter()

      // Assert: Footer content erased
      expect(terminal.contains('OpenAI · GPT-4')).toBe(false)
    })
  })

  describe('Requirement: eraseLines', () => {
    test('should erase specified number of lines', () => {
      // Arrange: Write multiple lines
      console.log('line 1')
      console.log('line 2')
      console.log('line 3')

      // Act: Erase 2 lines
      eraseLines(2)

      // Assert: Lines erased
      expect(terminal.contains('line 2')).toBe(false)
      expect(terminal.contains('line 3')).toBe(false)
    })
  })

  describe('Requirement: displayCommandSuggestions', () => {
    test('should display command list with descriptions', () => {
      // Arrange: Commands to suggest
      const commands = [
        { name: '/help', description: 'Show help' },
        { name: '/exit', description: 'Exit CLI' }
      ]

      displayHeader()
      displayConversation()
      displayFooter()

      // Act
      const linesRendered = displayCommandSuggestions(commands, 0)

      // Assert: Commands displayed
      expect(terminal.contains('/help')).toBe(true)
      expect(terminal.contains('Show help')).toBe(true)
      expect(terminal.contains('/exit')).toBe(true)
      expect(terminal.contains('Exit CLI')).toBe(true)
      expect(linesRendered).toBe(3) // blank line + 2 commands
    })

    test('should highlight selected command', () => {
      // Arrange
      const commands = [
        { name: '/help', description: 'Show help' },
        { name: '/exit', description: 'Exit CLI' }
      ]

      displayHeader()
      displayConversation()
      displayFooter()

      // Act: Select second command
      displayCommandSuggestions(commands, 1)

      // Assert: Both commands displayed (highlighting is via ANSI codes)
      expect(terminal.contains('/help')).toBe(true)
      expect(terminal.contains('/exit')).toBe(true)
    })
  })

  describe('Requirement: displayConversation with edge cases', () => {
    test('should display empty conversation with just blank line', () => {
      // Arrange: Empty conversation
      state.chat.messages = []

      // Act
      displayHeader()
      displayConversation()

      // Assert: Just header and blank line, no messages
      const lines = terminal.getVisibleText().split('\n')
      expect(lines.length).toBeLessThan(10) // Header is ~5 lines
      expect(terminal.contains('>')).toBe(false)
    })

    test('should display long message that wraps', () => {
      // Arrange: Very long message
      const longMessage = 'a'.repeat(200)
      state.chat.addMessage(new MessageCli('user', longMessage))

      // Act
      displayHeader()
      displayConversation()

      // Assert: Message displayed (wrapping handled by terminal)
      expect(terminal.contains(longMessage.slice(0, 50))).toBe(true)
    })

    test('should display multiple exchanges correctly', () => {
      // Arrange: Multiple back-and-forth messages
      state.chat.addMessage(new MessageCli('user', 'first'))
      state.chat.addMessage(new MessageCli('assistant', 'response1'))
      state.chat.addMessage(new MessageCli('user', 'second'))
      state.chat.addMessage(new MessageCli('assistant', 'response2'))

      // Act
      displayHeader()
      displayConversation()

      // Assert: All messages present
      expect(terminal.contains('> first')).toBe(true)
      expect(terminal.contains('  response1')).toBe(true)
      expect(terminal.contains('> second')).toBe(true)
      expect(terminal.contains('  response2')).toBe(true)
    })
  })

  describe('Requirement: padContent word wrapping', () => {
    test('should add padding to short single line', () => {
      // Arrange
      const text = 'Hello world'

      // Act
      const result = padContent(text, 80)

      // Assert
      expect(result).toBe('  Hello world  ')
    })

    test('should preserve existing newlines', () => {
      // Arrange
      const text = 'Line 1\nLine 2\nLine 3'

      // Act
      const result = padContent(text, 80)

      // Assert
      expect(result).toBe('  Line 1  \n  Line 2  \n  Line 3  ')
    })

    test('should wrap long line at word boundaries', () => {
      // Arrange
      // Create a line that exceeds width-4 (76 chars for 80 col terminal)
      const text = 'This is a very long line that definitely exceeds the maximum width and should be wrapped at word boundaries'

      // Act
      const result = padContent(text, 80)

      // Assert - should be wrapped into multiple lines, each with padding
      const lines = result.split('\n')
      expect(lines.length).toBeGreaterThan(1)
      for (const line of lines) {
        expect(line.startsWith('  ')).toBe(true)
        expect(line.endsWith('  ')).toBe(true)
        // Each line should not exceed 80 chars
        expect(line.length).toBeLessThanOrEqual(80)
      }
    })

    test('should break very long words', () => {
      // Arrange
      // Create a word longer than maxLineWidth (76 chars for 80 col terminal)
      const longWord = 'a'.repeat(100)

      // Act
      const result = padContent(longWord, 80)

      // Assert - should be broken into chunks
      const lines = result.split('\n')
      expect(lines.length).toBeGreaterThan(1)
      for (const line of lines) {
        expect(line.startsWith('  ')).toBe(true)
        expect(line.endsWith('  ')).toBe(true)
        expect(line.length).toBeLessThanOrEqual(80)
      }
    })

    test('should handle empty string', () => {
      // Act
      const result = padContent('', 80)

      // Assert
      expect(result).toBe('    ')
    })

    test('should handle mixed long and short lines', () => {
      // Arrange
      const text = 'Short\nThis is a very long line that exceeds the maximum width and needs wrapping\nAnother short'

      // Act
      const result = padContent(text, 80)

      // Assert
      const lines = result.split('\n')
      expect(lines[0]).toBe('  Short  ')
      expect(lines[lines.length - 1]).toBe('  Another short  ')
      // Middle lines should be wrapped (at least 3 lines total: short + wrapped middle + short)
      expect(lines.length).toBeGreaterThanOrEqual(3)
    })
  })

  describe('Requirement: Shortcut Help Display', () => {
    test('getDefaultFooterRightText should return "? for shortcuts" when no messages', () => {
      // Arrange: Empty chat
      state.chat.messages = []

      // Act
      const result = getDefaultFooterRightText()

      // Assert
      expect(result).toBe('? for shortcuts')
    })

    test('getDefaultFooterRightText should return message count when messages exist', () => {
      // Arrange: Chat with 2 messages
      state.chat.addMessage(new MessageCli('user', 'hello'))
      state.chat.addMessage(new MessageCli('assistant', 'hi'))

      // Act
      const result = getDefaultFooterRightText()

      // Assert
      expect(result).toBe('2 messages')
    })

    test('getDefaultFooterRightText should return empty string when no messages but input is not empty', () => {
      // Arrange: Empty chat with user typing
      state.chat.messages = []

      // Act
      const result = getDefaultFooterRightText('hello')

      // Assert
      expect(result).toBe('')
    })

    test('getDefaultFooterRightText should return "? for shortcuts" when no messages and input is empty', () => {
      // Arrange: Empty chat with no input
      state.chat.messages = []

      // Act
      const result = getDefaultFooterRightText('')

      // Assert
      expect(result).toBe('? for shortcuts')
    })

    test('getDefaultFooterRightText should return empty string when input contains only whitespace', () => {
      // Arrange: Empty chat with whitespace input
      state.chat.messages = []

      // Act
      const result = getDefaultFooterRightText('   ')

      // Assert
      expect(result).toBe('')
    })

    test('displayShortcutHelp should show help text in place of footer', () => {
      // Arrange: Initial display
      displayHeader()
      displayConversation()
      displayFooter()
      const initialInputY = terminal.getCursorPosition().row

      // Act: Display help (replaces footer text)
      displayShortcutHelp(initialInputY, 1)

      // Assert: Help text displayed
      expect(terminal.contains('/ for commands')).toBe(true)
      expect(terminal.contains('double tap esc to clear input')).toBe(true)
      expect(terminal.contains('shift + ⏎ for newline')).toBe(true)
    })

    test('displayShortcutHelp should use 3-column layout', () => {
      // Arrange: Initial display
      displayHeader()
      displayConversation()
      displayFooter()
      const initialInputY = terminal.getCursorPosition().row

      // Act
      displayShortcutHelp(initialInputY, 1)

      // Assert: Check spacing indicates columns (each item padded to column width)
      const text = terminal.getVisibleText()
      expect(text).toContain('/ for commands')
      expect(text).toContain('double tap esc to clear input')
      expect(text).toContain('shift + ⏎ for newline')

      // Column 1 and 2 should be on first row
      const lines = text.split('\n')
      const helpLine1 = lines.find(l => l.includes('/ for commands'))
      expect(helpLine1).toBeDefined()
      expect(helpLine1).toContain('double tap esc to clear input')
    })

    test('clearShortcutHelp should restore normal footer text', () => {
      // Arrange: Display help first
      state.chat.addMessage(new MessageCli('user', 'test'))
      displayHeader()
      displayConversation()
      displayFooter()
      const initialInputY = terminal.getCursorPosition().row

      displayShortcutHelp(initialInputY, 1)
      expect(terminal.contains('/ for commands')).toBe(true)

      // Act: Clear help
      clearShortcutHelp(initialInputY, 1)

      // Assert: Normal footer restored
      expect(terminal.contains('/ for commands')).toBe(false)
      expect(terminal.contains('OpenAI · GPT-4')).toBe(true)
      expect(terminal.contains('1 messages')).toBe(true)
    })

    test('clearShortcutHelp should work with multi-line input', () => {
      // Arrange: Display with 2-line input
      displayHeader()
      displayConversation()
      displayFooter()
      const initialInputY = terminal.getCursorPosition().row

      repositionFooter(initialInputY, 1, 2)
      displayShortcutHelp(initialInputY, 2)

      // Act: Clear help
      clearShortcutHelp(initialInputY, 2)

      // Assert: Normal footer restored at correct position
      expect(terminal.contains('/ for commands')).toBe(false)
      expect(terminal.contains('OpenAI · GPT-4')).toBe(true)
    })
  })

  describe('Requirement: Multi-Tool Animation', () => {
    beforeEach(() => {
      // Reset animation index to get predictable frames
      resetAnimationIndex()
    })

    afterEach(() => {
      // Clean up after each test
      clearToolsDisplay()
    })

    test('single tool should display without leading blank line', () => {
      // Arrange & Act
      initToolsDisplay()
      addTool('tool-1', 'Running npm test')

      // Assert: Single tool, no blank line before (last line padded to 80 chars)
      const expected = '⋅ Running npm test' + ' '.repeat(80 - 18)
      expect(terminal.getVisibleText()).toBe(expected)
    })

    test('two tools should have blank line between them', () => {
      // Arrange & Act
      initToolsDisplay()
      addTool('tool-1', 'Running npm test')
      addTool('tool-2', 'Running npm lint')

      // Assert: Two tools with blank line between (last line padded)
      const expected = `⋅ Running npm test

` + '∘ Running npm lint' + ' '.repeat(80 - 18)
      expect(terminal.getVisibleText()).toBe(expected)
    })

    test('three tools should have blank lines between each', () => {
      // Arrange & Act
      initToolsDisplay()
      addTool('tool-1', 'Running npm test')
      addTool('tool-2', 'Running npm lint')
      addTool('tool-3', 'Running npm build')

      // Assert: Three tools with blank lines between each (last line padded)
      const expected = `⋅ Running npm test

∘ Running npm lint

` + '○ Running npm build' + ' '.repeat(80 - 19)
      expect(terminal.getVisibleText()).toBe(expected)
    })

    test('completeTool should replace animation with checkmark', () => {
      // Arrange
      initToolsDisplay()
      addTool('tool-1', 'Running npm test')

      // Act
      completeTool('tool-1', 'completed', 'Ran npm test')

      // Assert: Checkmark replaces animation frame (last line padded)
      const expected = '⏺ Ran npm test' + ' '.repeat(80 - 14)
      expect(terminal.getVisibleText()).toBe(expected)
    })

    test('completeTool should update correct tool in multi-tool display', () => {
      // Arrange
      initToolsDisplay()
      addTool('tool-1', 'Running npm test')
      addTool('tool-2', 'Running npm lint')
      addTool('tool-3', 'Running npm build')

      // Act: Complete middle tool
      completeTool('tool-2', 'completed', 'Ran npm lint')

      // Assert: Middle tool shows checkmark, others unchanged (last line padded)
      const expected = `⋅ Running npm test

⏺ Ran npm lint

` + '○ Running npm build' + ' '.repeat(80 - 19)
      expect(terminal.getVisibleText()).toBe(expected)
    })

    test('multiple tools complete in any order', () => {
      // Arrange
      initToolsDisplay()
      addTool('tool-1', 'Running npm test')
      addTool('tool-2', 'Running npm lint')
      addTool('tool-3', 'Running npm build')

      // Act: Complete in different order (3, 1, 2)
      completeTool('tool-3', 'completed', 'Ran npm build')
      completeTool('tool-1', 'completed', 'Ran npm test')
      completeTool('tool-2', 'completed', 'Ran npm lint')

      // Assert: All show checkmarks in original positions (last line padded)
      const expected = `⏺ Ran npm test

⏺ Ran npm lint

` + '⏺ Ran npm build' + ' '.repeat(80 - 15)
      expect(terminal.getVisibleText()).toBe(expected)
    })

    test('initToolsDisplay should reset state for new batch', () => {
      // Arrange: First batch
      initToolsDisplay()
      addTool('tool-1', 'First batch 1')
      addTool('tool-2', 'First batch 2')

      // Act: Reset and start new batch
      clearToolsDisplay()
      terminal.clear()
      resetAnimationIndex()
      initToolsDisplay()
      addTool('tool-3', 'Second batch')

      // Assert: Only new tool, no blank line (it's first in new batch)
      const expected = '⋅ Second batch' + ' '.repeat(80 - 14)
      expect(terminal.getVisibleText()).toBe(expected)
    })

    test('startToolsAnimation should return interval', () => {
      // Arrange
      initToolsDisplay()
      addTool('tool-1', 'Running test')

      // Act
      const interval = startToolsAnimation()

      // Assert
      expect(interval).toBeDefined()

      // Cleanup
      stopToolsAnimation(interval)
    })

    test('stopToolsAnimation should handle null interval', () => {
      // Act & Assert: Should not throw
      stopToolsAnimation(null)
      expect(true).toBe(true)
    })

    // Note: Integration tests for content → tools → content flow
    // are in cli-integration.test.ts which tests the real chunk processing
  })

  describe('Requirement: Multi-line Tool Status', () => {
    beforeEach(() => {
      resetAnimationIndex()
    })

    afterEach(() => {
      clearToolsDisplay()
    })

    test('single tool with 2-line status should display correctly', () => {
      // Arrange & Act
      initToolsDisplay()
      addTool('tool-1', 'Read(test.txt)\n  └ Read 5 lines')

      // Assert: Two lines, first with animation
      const expected = `⋅ Read(test.txt)
` + '  └ Read 5 lines' + ' '.repeat(80 - 16)
      expect(terminal.getVisibleText()).toBe(expected)
    })

    test('single tool with 3-line status should display correctly', () => {
      // Arrange & Act
      initToolsDisplay()
      addTool('tool-1', 'Bash(ls -la)\n  └ file1.txt\n    file2.txt')

      // Assert: Three lines, first with animation
      const expected = `⋅ Bash(ls -la)
  └ file1.txt
` + '    file2.txt' + ' '.repeat(80 - 13)
      expect(terminal.getVisibleText()).toBe(expected)
    })

    test('two multi-line tools should have blank line between', () => {
      // Arrange & Act
      initToolsDisplay()
      addTool('tool-1', 'Read(a.txt)\n  └ Read 10 lines')
      addTool('tool-2', 'Read(b.txt)\n  └ Read 20 lines')

      // Assert: Blank line between tools
      const expected = `⋅ Read(a.txt)
  └ Read 10 lines

∘ Read(b.txt)
` + '  └ Read 20 lines' + ' '.repeat(80 - 17)
      expect(terminal.getVisibleText()).toBe(expected)
    })

    test('completeTool should update multi-line tool correctly', () => {
      // Arrange
      initToolsDisplay()
      addTool('tool-1', 'Read(test.txt)\n  └ Reading...')

      // Act: Complete with different status
      completeTool('tool-1', 'completed', 'Read(test.txt)\n  └ Read 100 lines')

      // Assert: Updated status with checkmark
      const expected = `⏺ Read(test.txt)
` + '  └ Read 100 lines' + ' '.repeat(80 - 18)
      expect(terminal.getVisibleText()).toBe(expected)
    })

    test('completeTool should handle line count increase', () => {
      // Arrange: Tool with 2 lines
      initToolsDisplay()
      addTool('tool-1', 'Bash(ls)\n  └ Running...')
      addTool('tool-2', 'Read(test.txt)')

      // Act: Complete tool-1 with 4 lines
      completeTool('tool-1', 'completed', 'Bash(ls)\n  └ file1.txt\n    file2.txt\n    ... +10 more lines')

      // Assert: Tool-1 expanded, tool-2 should still be visible
      const lines = terminal.getVisibleText().split('\n')
      expect(lines[0]).toContain('⏺ Bash(ls)')
      expect(lines[1]).toContain('  └ file1.txt')
      expect(lines[2]).toContain('    file2.txt')
      expect(lines[3]).toContain('    ... +10 more lines')
      expect(lines[4]).toBe('')  // blank line
      expect(lines[5]).toContain('∘ Read(test.txt)')  // tool-2 has frame '∘' (second tool gets second frame)
    })

    test('completeTool should handle line count decrease', () => {
      // Arrange: Tool with 4 lines
      initToolsDisplay()
      addTool('tool-1', 'Bash(ls)\n  └ file1.txt\n    file2.txt\n    ... +10 more lines')
      addTool('tool-2', 'Read(test.txt)')

      // Act: Complete tool-1 with 2 lines
      completeTool('tool-1', 'completed', 'Bash(ls)\n  └ Done')

      // Assert: Tool-1 shrunk, tool-2 should still be visible
      const lines = terminal.getVisibleText().split('\n')
      expect(lines[0]).toContain('⏺ Bash(ls)')
      expect(lines[1]).toContain('  └ Done')
      expect(lines[2]).toBe('')  // blank line
      expect(lines[3]).toContain('∘ Read(test.txt)')  // tool-2 has frame '∘'
    })

    test('multiple multi-line tools completing should maintain positions', () => {
      // Arrange
      initToolsDisplay()
      addTool('tool-1', 'Read(a.txt)\n  └ Reading...')
      addTool('tool-2', 'Bash(ls)\n  └ Running...')
      addTool('tool-3', 'Write(b.txt)\n  └ Writing...')

      // Act: Complete middle tool with more lines
      completeTool('tool-2', 'completed', 'Bash(ls)\n  └ file1.txt\n    file2.txt\n    file3.txt')

      // Assert: All tools visible in correct positions
      const lines = terminal.getVisibleText().split('\n')
      // Tool 1
      expect(lines[0]).toContain('⋅ Read(a.txt)')
      expect(lines[1]).toContain('  └ Reading...')
      expect(lines[2]).toBe('')  // blank
      // Tool 2 (expanded)
      expect(lines[3]).toContain('⏺ Bash(ls)')
      expect(lines[4]).toContain('  └ file1.txt')
      expect(lines[5]).toContain('    file2.txt')
      expect(lines[6]).toContain('    file3.txt')
      expect(lines[7]).toBe('')  // blank
      // Tool 3
      expect(lines[8]).toContain('○ Write(b.txt)')
      expect(lines[9]).toContain('  └ Writing...')
    })
  })
})
