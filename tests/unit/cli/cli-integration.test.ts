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

  test('content → tools → content produces correct newlines', async () => {
    // Import handleMessage here to get fresh module with our mocks
    const { handleMessage } = await import('@/cli/commands')

    // Define chunks to simulate:
    // 1. Content "Hello"
    // 2. Empty content (should be skipped)
    // 3. Tool 1 start
    // 4. Tool 2 start
    // 5. Tool 1 complete
    // 6. Tool 2 complete
    // 7. Empty content (should be skipped)
    // 8. Content "World"
    const chunks = [
      JSON.stringify({ type: 'content', text: 'Hello', done: false }),
      JSON.stringify({ type: 'content', text: '   ', done: false }), // empty/whitespace
      JSON.stringify({ type: 'tool', id: 'tool-1', status: 'Running tool 1', done: false }),
      JSON.stringify({ type: 'tool', id: 'tool-2', status: 'Running tool 2', done: false }),
      JSON.stringify({ type: 'tool', id: 'tool-1', status: 'Tool 1 done', done: true }),
      JSON.stringify({ type: 'tool', id: 'tool-2', status: 'Tool 2 done', done: true }),
      JSON.stringify({ type: 'content', text: '', done: false }), // empty
      JSON.stringify({ type: 'content', text: 'World', done: false }),
    ]

    vi.mocked(fetch).mockResolvedValueOnce(createMockStreamResponse(chunks))

    await handleMessage('test')

    // Get the output and verify structure
    const output = terminal.getVisibleText()

    // Should have:
    // - "Hello" (content, padded)
    // - blank line (content → tool transition)
    // - "✓ Tool 1 done"
    // - blank line (between tools)
    // - "✓ Tool 2 done"
    // - blank line (tool → content transition)
    // - "World" (content, padded)
    // - blank lines after response

    // Verify key structural elements
    expect(output).toContain('Hello')
    expect(output).toContain('✓ Tool 1 done')
    expect(output).toContain('✓ Tool 2 done')
    expect(output).toContain('World')

    // Verify the newline structure by checking line positions
    const lines = output.split('\n')

    // Find the lines with our content
    const helloLineIdx = lines.findIndex(l => l.includes('Hello'))
    const tool1LineIdx = lines.findIndex(l => l.includes('Tool 1 done'))
    const tool2LineIdx = lines.findIndex(l => l.includes('Tool 2 done'))
    const worldLineIdx = lines.findIndex(l => l.includes('World'))

    expect(helloLineIdx).toBeGreaterThanOrEqual(0)
    expect(tool1LineIdx).toBeGreaterThan(helloLineIdx)
    expect(tool2LineIdx).toBeGreaterThan(tool1LineIdx)
    expect(worldLineIdx).toBeGreaterThan(tool2LineIdx)

    // Verify blank line between Hello and first tool (content → tool transition)
    expect(tool1LineIdx - helloLineIdx).toBeGreaterThanOrEqual(2) // at least 1 blank line

    // Verify blank line between tools
    expect(tool2LineIdx - tool1LineIdx).toBe(2) // exactly 1 blank line between

    // Verify blank line between last tool and World (tool → content transition)
    expect(worldLineIdx - tool2LineIdx).toBeGreaterThanOrEqual(2) // at least 1 blank line
  })

  test('multiple tool batches have correct spacing', async () => {
    const { handleMessage } = await import('@/cli/commands')

    // Simulate: tool batch 1 → content → tool batch 2
    const chunks = [
      JSON.stringify({ type: 'tool', id: 'tool-1', status: 'Batch 1 tool', done: false }),
      JSON.stringify({ type: 'tool', id: 'tool-1', status: 'Batch 1 done', done: true }),
      JSON.stringify({ type: 'content', text: 'Middle content', done: false }),
      JSON.stringify({ type: 'tool', id: 'tool-2', status: 'Batch 2 tool', done: false }),
      JSON.stringify({ type: 'tool', id: 'tool-2', status: 'Batch 2 done', done: true }),
    ]

    vi.mocked(fetch).mockResolvedValueOnce(createMockStreamResponse(chunks))

    await handleMessage('test')

    const output = terminal.getVisibleText()

    expect(output).toContain('Batch 1 done')
    expect(output).toContain('Middle content')
    expect(output).toContain('Batch 2 done')

    const lines = output.split('\n')
    const batch1Idx = lines.findIndex(l => l.includes('Batch 1 done'))
    const middleIdx = lines.findIndex(l => l.includes('Middle content'))
    const batch2Idx = lines.findIndex(l => l.includes('Batch 2 done'))

    // Verify spacing: batch1 → blank → content → blank → batch2
    expect(middleIdx - batch1Idx).toBeGreaterThanOrEqual(2)
    expect(batch2Idx - middleIdx).toBeGreaterThanOrEqual(2)
  })
})
