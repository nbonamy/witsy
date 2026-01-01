import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { getDefaultFooterRightText, padContent, initToolsDisplay, addTool, completeTool, startToolsAnimation, stopToolsAnimation, clearToolsDisplay, resetAnimationIndex } from '@/cli/display'
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

  describe('Requirement: getDefaultFooterRightText', () => {
    test('should return "? for shortcuts" when no messages', () => {
      // Arrange: Empty chat
      state.chat.messages = []

      // Act
      const result = getDefaultFooterRightText()

      // Assert
      expect(result).toBe('? for shortcuts')
    })

    test('should return message count when messages exist', () => {
      // Arrange: Chat with 2 messages
      state.chat.addMessage(new MessageCli('user', 'hello'))
      state.chat.addMessage(new MessageCli('assistant', 'hi'))

      // Act
      const result = getDefaultFooterRightText()

      // Assert
      expect(result).toBe('2 messages')
    })

    test('should return empty string when no messages but input is not empty', () => {
      // Arrange: Empty chat with user typing
      state.chat.messages = []

      // Act
      const result = getDefaultFooterRightText('hello')

      // Assert
      expect(result).toBe('')
    })

    test('should return "? for shortcuts" when no messages and input is empty', () => {
      // Arrange: Empty chat with no input
      state.chat.messages = []

      // Act
      const result = getDefaultFooterRightText('')

      // Assert
      expect(result).toBe('? for shortcuts')
    })

    test('should return empty string when input contains only whitespace', () => {
      // Arrange: Empty chat with whitespace input
      state.chat.messages = []

      // Act
      const result = getDefaultFooterRightText('   ')

      // Assert
      expect(result).toBe('')
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
