/**
 * CLI Integration Tests
 *
 * These tests verify the full chunk processing flow through handleMessage,
 * using real display functions and capturing actual terminal output.
 */

import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { VirtualTerminal } from './VirtualTerminal'
import { state } from '@/cli/state'
import { ChatCli } from '@/cli/models'
import { resetAnimationIndex, clearToolsDisplay } from '@/cli/display'

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

  beforeEach(() => {
    // Create virtual terminal
    terminal = new VirtualTerminal(80, 24)

    // Save original functions
    originalLog = console.log
    originalWrite = process.stdout.write
    originalColumns = process.stdout.columns

    // Mock to use virtual terminal
    console.log = (...args: any[]) => terminal.log(...args)
    process.stdout.write = ((text: any) => {
      terminal.write(text)
      return true
    }) as any

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

    // Reset animation index for predictable output
    resetAnimationIndex()

    vi.clearAllMocks()
  })

  afterEach(() => {
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

  test('tools only - no content before or after', async () => {
    const { handleMessage } = await import('@/cli/commands')

    const chunks = [
      JSON.stringify({ type: 'tool', id: 'tool-1', status: 'Running', done: false }),
      JSON.stringify({ type: 'tool', id: 'tool-1', status: 'Done', done: true }),
    ]

    vi.mocked(fetch).mockResolvedValueOnce(createMockStreamResponse(chunks))
    await handleMessage('test')

    // Expected: just the tool output (last line padded to 80 chars)
    const expected = '⏺ Done' + ' '.repeat(80 - 6)
    expect(terminal.getVisibleText()).toBe(expected)
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
