import { beforeEach, describe, expect, test, vi } from 'vitest'
import { displayHeader, displayFooter, displayConversation } from '../../../src/cli/display'
import { state } from '../../../src/cli/state'
import { VirtualTerminal } from './VirtualTerminal'

// Mock @inquirer/prompts
vi.mock('@inquirer/prompts', () => ({
  input: vi.fn()
}))

import { input } from '@inquirer/prompts'

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

    // Mock @inquirer/prompts input to write prompt to terminal
    vi.mocked(input).mockImplementation(async (config: any) => {
      // The real inquirer library would write the prompt at the current cursor position
      // It doesn't add any newlines or move the cursor to a new line
      // Just write the prompt character where the cursor is
      process.stdout.write(config.message)
      return '' // Return empty for tests
    })

    // Reset state
    state.port = 8090
    state.engine = 'openai'
    state.model = 'gpt-4'
    state.history = []
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
      await input({ message: '>' })  // Simulate prompt appearing at cursor

      // Assert: Exact expected output per requirements
      // HEADER
      // SEPARATOR
      // PROMPT WHERE CURSOR IS
      // SEPARATOR
      // FOOTER (current model + number of messages)
      const expected = `
  ██  █  ██  Witsy CLI v3.0.0
  ██ ███ ██  AI Assistant · Command Line Interface
   ███ ███   http://localhost:8090


────────────────────────────────────────────────────────────────────────────────
>
────────────────────────────────────────────────────────────────────────────────
[openai: gpt-4]                                                       0 messages`

      expect(terminal.getVisibleText()).toBe(expected)
    })
  })

  describe('Requirement: After User Message', () => {
    test('should show layout with user message', async () => {
      // Arrange: User submitted "hello"
      state.history = [
        { role: 'user', content: 'hello' }
      ]

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
      await input({ message: '>' })  // Simulate prompt appearing at cursor

      const expected = `
  ██  █  ██  Witsy CLI v3.0.0
  ██ ███ ██  AI Assistant · Command Line Interface
   ███ ███   http://localhost:8090


> hello

────────────────────────────────────────────────────────────────────────────────
>
────────────────────────────────────────────────────────────────────────────────
[openai: gpt-4]                                                       1 messages`

      expect(terminal.getVisibleText()).toBe(expected)
    })
  })

  describe('Requirement: After Conversation', () => {
    test('should show layout with full conversation', async () => {
      // Arrange: User said "hello", assistant replied "Hello how are you?"
      state.history = [
        { role: 'user', content: 'hello' },
        { role: 'assistant', content: 'Hello how are you?' }
      ]

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
      await input({ message: '>' })  // Simulate prompt appearing at cursor

      const expected = `
  ██  █  ██  Witsy CLI v3.0.0
  ██ ███ ██  AI Assistant · Command Line Interface
   ███ ███   http://localhost:8090


> hello

Hello how are you?

────────────────────────────────────────────────────────────────────────────────
>
────────────────────────────────────────────────────────────────────────────────
[openai: gpt-4]                                                       2 messages`

      expect(terminal.getVisibleText()).toBe(expected)
    })
  })

  describe('Requirement: Multiple Messages', () => {
    test('should show layout with multiple exchanges', async () => {
      // Arrange: Multiple message exchanges
      state.history = [
        { role: 'user', content: 'Tell me a joke' },
        { role: 'assistant', content: 'Why did the chicken cross the road?' },
        { role: 'user', content: 'Why?' },
        { role: 'assistant', content: 'To get to the other side!' }
      ]

      // Act
      displayHeader()
      displayConversation()
      displayFooter()
      await input({ message: '>' })  // Simulate prompt appearing at cursor

      const expected = `
  ██  █  ██  Witsy CLI v3.0.0
  ██ ███ ██  AI Assistant · Command Line Interface
   ███ ███   http://localhost:8090


> Tell me a joke

Why did the chicken cross the road?

> Why?

To get to the other side!

────────────────────────────────────────────────────────────────────────────────
>
────────────────────────────────────────────────────────────────────────────────
[openai: gpt-4]                                                       4 messages`

      expect(terminal.getVisibleText()).toBe(expected)
    })
  })
})
