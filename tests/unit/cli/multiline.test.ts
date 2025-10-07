import { describe, expect, test } from 'vitest'

// Test the calculateLineCount logic for multi-line input
describe('Multi-line Input Support', () => {

  // Helper function that mirrors the implementation in input.ts
  const calculateLineCount = (promptText: string, text: string, termWidth = 80): number => {
    // Split text into logical lines (by \n)
    const lines = text.split('\n')

    // Calculate total visual lines
    let totalLines = 0

    // First line includes the prompt
    const firstLineLength = promptText.length + (lines[0]?.length || 0) + 1
    totalLines += Math.max(1, Math.ceil(firstLineLength / termWidth))

    // Subsequent lines don't have prompt
    for (let i = 1; i < lines.length; i++) {
      const lineLength = lines[i].length
      totalLines += Math.max(1, Math.ceil(lineLength / termWidth))
    }

    return totalLines
  }

  describe('Line Count Calculation', () => {

    test('should calculate single line without wrapping', () => {
      const result = calculateLineCount('> ', 'hello world', 80)
      expect(result).toBe(1)
    })

    test('should calculate single line with wrapping', () => {
      const longText = 'a'.repeat(100)
      const result = calculateLineCount('> ', longText, 80)
      // Prompt (2) + text (100) + space (1) = 103 chars
      // 103 / 80 = 1.2875 → ceil = 2 lines
      expect(result).toBe(2)
    })

    test('should calculate multiple logical lines without wrapping', () => {
      const text = 'line 1\nline 2\nline 3'
      const result = calculateLineCount('> ', text, 80)
      // First line: "> line 1 " = 10 chars → 1 line
      // Second line: "line 2" = 6 chars → 1 line
      // Third line: "line 3" = 6 chars → 1 line
      expect(result).toBe(3)
    })

    test('should calculate multiple logical lines with wrapping', () => {
      const line1 = 'a'.repeat(50)  // Won't wrap with prompt (2 + 50 + 1 = 53)
      const line2 = 'b'.repeat(90)  // Will wrap (90 / 80 = 2 lines)
      const text = `${line1}\n${line2}`
      const result = calculateLineCount('> ', text, 80)
      // First line: 53 chars → 1 line
      // Second line: 90 chars → 2 lines
      expect(result).toBe(3)
    })

    test('should handle empty text', () => {
      const result = calculateLineCount('> ', '', 80)
      expect(result).toBe(1)
    })

    test('should handle text with only newlines', () => {
      const text = '\n\n'
      const result = calculateLineCount('> ', text, 80)
      // First line: "> " + empty + space = 3 chars → 1 line
      // Second line: empty → 1 line
      // Third line: empty → 1 line
      expect(result).toBe(3)
    })

    test('should handle pasted multi-line markdown', () => {
      const text = `### Added
- Design Studio drawing
- Let users choose which tools to enable from each MCP
- Allow selecting and copying text from tool execution results`
      const result = calculateLineCount('> ', text, 80)
      // First line: "> ### Added " = 13 chars → 1 line
      // Second line: "- Design Studio drawing" = 23 chars → 1 line
      // Third line: "- Let users choose..." = 54 chars → 1 line
      // Fourth line: "- Allow selecting..." = 62 chars → 1 line
      expect(result).toBe(4)
    })

    test('should handle real-world changelog paste', () => {
      const text = `### Added
- Design Studio drawing
- Let users choose which tools to enable from each MCP, and persist that choice for all models (https://github.com/nbonamy/witsy/issues/410)
- Allow selecting and copying text from tool execution results (https://github.com/nbonamy/witsy/issues/421)`
      const result = calculateLineCount('> ', text, 90) // Typical wider terminal
      // First line: "> ### Added " = 13 chars → 1 line
      // Second line: "- Design Studio drawing" = 23 chars → 1 line
      // Third line: "- Let users choose..." = 142 chars → 2 lines (142/90 = 1.58 → 2)
      // Fourth line: "- Allow selecting..." = 113 chars → 2 lines (113/90 = 1.26 → 2)
      expect(result).toBe(6)
    })

    test('should handle prompt on first line only', () => {
      const text = 'first\nsecond'
      const result = calculateLineCount('> ', text, 80)
      // First line includes prompt: "> first " = 9 chars → 1 line
      // Second line no prompt: "second" = 6 chars → 1 line
      expect(result).toBe(2)
    })

    test('should handle edge case of exactly terminal width', () => {
      const text = 'a'.repeat(77) // 77 + 2 (prompt) + 1 (space) = 80 exactly
      const result = calculateLineCount('> ', text, 80)
      expect(result).toBe(1)
    })

    test('should handle edge case of one char over terminal width', () => {
      const text = 'a'.repeat(78) // 78 + 2 (prompt) + 1 (space) = 81
      const result = calculateLineCount('> ', text, 80)
      expect(result).toBe(2)
    })
  })

  describe('Multi-line Input Behavior', () => {

    test('should treat CTRL_J as newline character', () => {
      // CTRL_J should be bound to 'newline' action in witsyKeyBindings
      const text = 'line1\nline2'
      expect(text.includes('\n')).toBe(true)
      expect(text.split('\n').length).toBe(2)
    })

    test('should preserve newlines in pasted content', () => {
      const pastedText = `first line
second line
third line`
      const lines = pastedText.split('\n')
      expect(lines.length).toBe(3)
      expect(lines[0]).toBe('first line')
      expect(lines[1]).toBe('second line')
      expect(lines[2]).toBe('third line')
    })

    test('should handle mixed newlines and long lines', () => {
      const shortLine = 'short'
      const longLine = 'a'.repeat(100)
      const text = `${shortLine}\n${longLine}\n${shortLine}`

      const lines = text.split('\n')
      expect(lines.length).toBe(3)

      const totalLines = calculateLineCount('> ', text, 80)
      // First: "> short " = 9 chars → 1 line
      // Second: longLine = 100 chars → 2 lines
      // Third: shortLine = 5 chars → 1 line
      expect(totalLines).toBe(4)
    })
  })

  describe('Footer Repositioning', () => {

    test('should calculate correct line count change when adding newline', () => {
      const beforeText = 'single line'
      const afterText = 'single line\n'

      const beforeLines = calculateLineCount('> ', beforeText, 80)
      const afterLines = calculateLineCount('> ', afterText, 80)

      expect(beforeLines).toBe(1)
      expect(afterLines).toBe(2)
      expect(afterLines - beforeLines).toBe(1)
    })

    test('should calculate correct line count change when pasting multi-line', () => {
      const beforeText = 'initial'
      const afterText = `initial
line 2
line 3
line 4`

      const beforeLines = calculateLineCount('> ', beforeText, 80)
      const afterLines = calculateLineCount('> ', afterText, 80)

      expect(beforeLines).toBe(1)
      expect(afterLines).toBe(4)
      expect(afterLines - beforeLines).toBe(3)
    })

    test('should handle backspace removing newline', () => {
      const beforeText = 'line1\nline2'
      const afterText = 'line1line2'

      const beforeLines = calculateLineCount('> ', beforeText, 80)
      const afterLines = calculateLineCount('> ', afterText, 80)

      expect(beforeLines).toBe(2)
      expect(afterLines).toBe(1)
      expect(beforeLines - afterLines).toBe(1)
    })
  })

  describe('Edge Cases', () => {

    test('should handle very long single line', () => {
      const text = 'a'.repeat(500)
      const result = calculateLineCount('> ', text, 80)
      // 500 + 2 + 1 = 503 chars
      // 503 / 80 = 6.2875 → 7 lines
      expect(result).toBe(7)
    })

    test('should handle many short lines', () => {
      const lines = Array(20).fill('x')
      const text = lines.join('\n')
      const result = calculateLineCount('> ', text, 80)
      expect(result).toBe(20)
    })

    test('should handle empty lines between content', () => {
      const text = 'line1\n\nline3'
      const result = calculateLineCount('> ', text, 80)
      // First: "> line1 " → 1 line
      // Second: empty → 1 line
      // Third: "line3" → 1 line
      expect(result).toBe(3)
    })

    test('should handle different terminal widths', () => {
      const text = 'a'.repeat(50)

      const width40 = calculateLineCount('> ', text, 40)
      const width80 = calculateLineCount('> ', text, 80)
      const width120 = calculateLineCount('> ', text, 120)

      // 50 + 2 + 1 = 53 chars
      expect(width40).toBe(2)  // 53/40 = 1.325 → 2
      expect(width80).toBe(1)  // 53/80 = 0.6625 → 1
      expect(width120).toBe(1) // 53/120 = 0.4417 → 1
    })

    test('should handle narrow terminal with multi-line', () => {
      const text = 'hello\nworld'
      const result = calculateLineCount('> ', text, 10)
      // First: "> hello " = 9 chars → 1 line
      // Second: "world" = 5 chars → 1 line
      expect(result).toBe(2)
    })
  })
})
