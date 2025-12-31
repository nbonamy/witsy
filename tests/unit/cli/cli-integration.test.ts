/**
 * CLI Integration Tests
 *
 * These tests verify the full chunk processing flow through handleMessage,
 * using real display functions and capturing actual terminal output.
 *
 * Note: With the component tree architecture, output includes the full tree
 * structure (header, spacer, messages, prompt, footer). Tests verify the
 * message content appears correctly within this structure.
 */

import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { VirtualTerminal } from './VirtualTerminal'
import { state } from '@/cli/state'
import { ChatCli } from '@/cli/models'
import { resetAnimationIndex, clearToolsDisplay } from '@/cli/display'
import { initializeTree, clearMessages } from '@/cli/tree'

// Mock terminal-kit (needed for key handling)
vi.mock('terminal-kit', () => ({
  default: {
    terminal: {
      grabInput: vi.fn(),
      on: vi.fn(() => null),
      removeListener: vi.fn(),
    }
  }
}))

// Mock chalk to pass through text (avoid ANSI codes in output)
vi.mock('chalk', () => ({
  default: {
    yellow: (s: string) => s,
    dim: (s: string) => s,
    red: (s: string) => s,
    white: (s: string) => s,
    rgb: () => (s: string) => s,
    italic: { dim: (s: string) => s },
    greenBright: (s: string) => s,
    redBright: (s: string) => s,
    blueBright: (s: string) => s,
  },
}))

// Setup fetch mock
global.fetch = vi.fn()

describe('CLI Integration - Chunk Processing', () => {
  let terminal: VirtualTerminal
  let originalLog: typeof console.log
  let originalWrite: typeof process.stdout.write
  let originalColumns: number | undefined
  let originalRows: number | undefined

  beforeEach(() => {
    // Create virtual terminal
    terminal = new VirtualTerminal(80, 24)

    // Save original functions
    originalLog = console.log
    originalWrite = process.stdout.write
    originalColumns = process.stdout.columns
    originalRows = process.stdout.rows

    // Mock to use virtual terminal
    console.log = (...args: any[]) => terminal.log(...args)
    process.stdout.write = ((text: any) => {
      terminal.write(text)
      return true
    }) as any

    // Set terminal dimensions
    Object.defineProperty(process.stdout, 'columns', {
      value: 80,
      writable: true,
      configurable: true
    })
    Object.defineProperty(process.stdout, 'rows', {
      value: 24,
      writable: true,
      configurable: true
    })

    // Reset state
    state.port = 8090
    state.engine = { id: 'openai', name: 'OpenAI' }
    state.model = { id: 'gpt-4', name: 'GPT-4' }
    state.chat = new ChatCli('CLI Session')

    // Initialize component tree
    initializeTree()

    // Reset animation index for predictable output
    resetAnimationIndex()

    vi.clearAllMocks()
  })

  afterEach(() => {
    // Clear messages from tree
    clearMessages()

    // Restore
    console.log = originalLog
    process.stdout.write = originalWrite
    if (originalColumns !== undefined) {
      Object.defineProperty(process.stdout, 'columns', {
        value: originalColumns,
        writable: true,
        configurable: true
      })
    }
    if (originalRows !== undefined) {
      Object.defineProperty(process.stdout, 'rows', {
        value: originalRows,
        writable: true,
        configurable: true
      })
    }
    clearToolsDisplay()
  })

  /**
   * Helper to create a mock fetch response that streams chunks
   */
  function createMockStreamResponse(chunks: string[]) {
    const encoder = new TextEncoder()
    let chunkIndex = 0

    const mockReader = {
      read: vi.fn().mockImplementation(() => {
        if (chunkIndex < chunks.length) {
          const chunk = chunks[chunkIndex++]
          return Promise.resolve({
            value: encoder.encode(`data: ${chunk}\n`),
            done: false
          })
        }
        if (chunkIndex === chunks.length) {
          chunkIndex++
          return Promise.resolve({
            value: encoder.encode('data: [DONE]\n'),
            done: false
          })
        }
        return Promise.resolve({ value: undefined, done: true })
      })
    }

    return {
      ok: true,
      body: { getReader: () => mockReader }
    } as unknown as Response
  }

  test('content → tools → content with reasoning produces correct newlines', async () => {
    // Import handleMessage here to get fresh module with our mocks
    const { handleMessage } = await import('@/cli/commands')

    // Chunks: reasoning → content → empty → reasoning → tool1 → tool2 → reasoning → empty → content
    // Reasoning chunks should be ignored and not affect output
    const chunks = [
      JSON.stringify({ type: 'reasoning', text: 'Let me think...', done: false }),
      JSON.stringify({ type: 'reasoning', text: 'Still thinking...', done: false }),
      JSON.stringify({ type: 'content', text: 'Hello', done: false }),
      JSON.stringify({ type: 'content', text: '   ', done: false }), // skipped
      JSON.stringify({ type: 'reasoning', text: 'About to use tools', done: false }),
      JSON.stringify({ type: 'tool', id: 'tool-1', status: 'Running 1', done: false }),
      JSON.stringify({ type: 'tool', id: 'tool-2', status: 'Running 2', done: false }),
      JSON.stringify({ type: 'tool', id: 'tool-1', status: 'Done 1', done: true }),
      JSON.stringify({ type: 'tool', id: 'tool-2', status: 'Done 2', done: true }),
      JSON.stringify({ type: 'reasoning', text: 'Tools done, writing response', done: false }),
      JSON.stringify({ type: 'content', text: '', done: false }), // skipped
      JSON.stringify({ type: 'content', text: 'World', done: false }),
    ]

    vi.mocked(fetch).mockResolvedValueOnce(createMockStreamResponse(chunks))
    await handleMessage('test')

    // Expected output (reasoning chunks don't affect output):
    // "⏺ Hello  " (padded content with prefix on first line)
    // "" (blank - content→tool transition)
    // "⏺ Done 1"
    // "" (blank between tools)
    // "⏺ Done 2"
    // "" (blank - tool→content transition)
    // "⏺ World  " (padded content with prefix on first line, last line padded to 80 chars)
    const expected = `⏺ Hello

⏺ Done 1

⏺ Done 2

` + '⏺ World  ' + ' '.repeat(80 - 9)
    expect(terminal.getVisibleText()).toBe(expected)
  })

  test('Footer component renders separator and status', async () => {
    // Direct test of Footer component rendering
    const { Footer } = await import('@/cli/components/footer')
    const footer = new Footer()
    const lines = footer.render(80)

    // Footer should render 2 lines: separator and status
    expect(lines.length).toBe(2)

    // First line should be separator (80 dashes)
    expect(lines[0]).toContain('─')
    expect(lines[0].replace(/[^─]/g, '').length).toBe(80) // 80 dash chars

    // Second line should contain model info
    expect(lines[1]).toContain('OpenAI')
    expect(lines[1]).toContain('GPT-4')
  })

  test('VirtualTerminal handles cursorTo correctly', async () => {
    const ansiEscapes = await import('ansi-escapes')

    // Write text at specific positions
    terminal.write(ansiEscapes.default.cursorTo(0, 0))
    terminal.write('Line 0')
    terminal.write(ansiEscapes.default.cursorTo(0, 1))
    terminal.write('Line 1')
    terminal.write(ansiEscapes.default.cursorTo(0, 2))
    terminal.write('Line 2')

    expect(terminal.getLine(0)).toBe('Line 0')
    expect(terminal.getLine(1)).toBe('Line 1')
    expect(terminal.getLine(2)).toBe('Line 2')
  })

  test('VirtualTerminal handles separator character', async () => {
    const separator = '─'.repeat(80)
    terminal.write(separator)

    expect(terminal.getLine(0)).toBe(separator)
  })

  test('renderFromComponent writes footer correctly', async () => {
    const ansiEscapes = await import('ansi-escapes')
    const { Footer } = await import('@/cli/components/footer')

    // Simulate what renderFromComponent does for footer
    const footer = new Footer()
    const lines = footer.render(80)
    const startRow = 5 // Simulated footer position

    // Save cursor
    terminal.write(ansiEscapes.default.cursorSavePosition)

    // Erase from startRow down
    terminal.write(ansiEscapes.default.cursorTo(0, startRow))
    terminal.write(ansiEscapes.default.eraseDown)

    // Write footer lines
    let currentRow = startRow
    for (const line of lines) {
      terminal.write(ansiEscapes.default.cursorTo(0, currentRow))
      terminal.write(line)
      currentRow++
    }

    // Restore cursor
    terminal.write(ansiEscapes.default.cursorRestorePosition)

    // Verify footer is at correct position
    expect(terminal.getLine(5)).toContain('─')  // Separator
    expect(terminal.getLine(6)).toContain('OpenAI')  // Status
  })

  test('tools only - no content before or after', async () => {
    const { handleMessage } = await import('@/cli/commands')

    const chunks = [
      JSON.stringify({ type: 'tool', id: 'tool-1', status: 'Running', done: false }),
      JSON.stringify({ type: 'tool', id: 'tool-1', status: 'Done', done: true }),
    ]

    vi.mocked(fetch).mockResolvedValueOnce(createMockStreamResponse(chunks))
    await handleMessage('test')

    // With the component tree, output includes the full structure
    // Verify message content is present
    expect(terminal.contains('⏺ Done')).toBe(true)
    expect(terminal.contains('OpenAI · GPT-4')).toBe(true)
    expect(terminal.contains('1 messages')).toBe(true)
  })

  test('failed tool shows error state', async () => {
    const { handleMessage } = await import('@/cli/commands')

    const chunks = [
      JSON.stringify({ type: 'tool', id: 'tool-1', status: 'Running', done: false }),
      JSON.stringify({ type: 'tool', id: 'tool-1', status: 'Command failed with exit code 127', done: true }),
    ]

    vi.mocked(fetch).mockResolvedValueOnce(createMockStreamResponse(chunks))
    await handleMessage('test')

    // Expected: tool with error state (status contains "failed")
    // The finalState should be overridden to 'error' because status contains "failed"
    const expected = '⏺ Command failed with exit code 127' + ' '.repeat(80 - 35)
    expect(terminal.getVisibleText()).toBe(expected)
  })

  test('mixed success and failed tools', async () => {
    const { handleMessage } = await import('@/cli/commands')

    const chunks = [
      JSON.stringify({ type: 'tool', id: 'tool-1', status: 'Running 1', done: false }),
      JSON.stringify({ type: 'tool', id: 'tool-2', status: 'Running 2', done: false }),
      JSON.stringify({ type: 'tool', id: 'tool-1', status: 'Done 1', done: true }),
      JSON.stringify({ type: 'tool', id: 'tool-2', status: 'Command failed', done: true }),
    ]

    vi.mocked(fetch).mockResolvedValueOnce(createMockStreamResponse(chunks))
    await handleMessage('test')

    // Expected: tool-1 success (green), tool-2 error (red - status contains "failed")
    const expected = `⏺ Done 1

⏺ Command failed` + ' '.repeat(80 - 16)
    expect(terminal.getVisibleText()).toBe(expected)
  })
})
