/**
 * Tests for cursor movement helper functions (word/line navigation)
 *
 * These test the helper functions used by witsyInputField for cursor movement shortcuts.
 * The actual keybindings (ALT_B, ALT_F, CTRL_A, CTRL_E) trigger these functions.
 */

import { describe, it, expect } from 'vitest'

// Helper functions from witsyInputField.ts
// We replicate them here for testing since they are internal to the closure

function isWordBoundary(char: string | undefined): boolean {
  if (!char) return true
  return /[\s,.:;!?()[\]{}<>"'`~@#$%^&*+=|\\/-]/.test(char)
}

function findLineStart(input: string[], offset: number): number {
  while (offset > 0 && input[offset - 1] !== '\n') {
    offset--
  }
  return offset
}

function findLineEnd(input: string[], offset: number): number {
  while (offset < input.length && input[offset] !== '\n') {
    offset++
  }
  return offset
}

function findPrevWordStart(input: string[], offset: number): number {
  if (offset === 0) return 0

  offset--

  // Skip any word boundaries (whitespace/punctuation)
  while (offset > 0 && isWordBoundary(input[offset])) {
    offset--
  }

  // Now skip back to the start of the word
  while (offset > 0 && !isWordBoundary(input[offset - 1])) {
    offset--
  }

  return offset
}

function findNextWordStart(input: string[], offset: number): number {
  if (offset >= input.length) return input.length

  // Skip current word (non-boundaries)
  while (offset < input.length && !isWordBoundary(input[offset])) {
    offset++
  }

  // Skip any word boundaries (whitespace/punctuation)
  while (offset < input.length && isWordBoundary(input[offset])) {
    offset++
  }

  return offset
}

// Helper to convert string to char array (like terminal-kit does)
function toCharArray(str: string): string[] {
  return str.split('')
}

describe('Cursor Movement Helpers', () => {

  describe('isWordBoundary', () => {
    it('should treat whitespace as boundary', () => {
      expect(isWordBoundary(' ')).toBe(true)
      expect(isWordBoundary('\t')).toBe(true)
      expect(isWordBoundary('\n')).toBe(true)
    })

    it('should treat punctuation as boundary', () => {
      expect(isWordBoundary(',')).toBe(true)
      expect(isWordBoundary('.')).toBe(true)
      expect(isWordBoundary(':')).toBe(true)
      expect(isWordBoundary(';')).toBe(true)
      expect(isWordBoundary('!')).toBe(true)
      expect(isWordBoundary('?')).toBe(true)
      expect(isWordBoundary('(')).toBe(true)
      expect(isWordBoundary(')')).toBe(true)
      expect(isWordBoundary('/')).toBe(true)
      expect(isWordBoundary('-')).toBe(true)
    })

    it('should not treat alphanumeric as boundary', () => {
      expect(isWordBoundary('a')).toBe(false)
      expect(isWordBoundary('Z')).toBe(false)
      expect(isWordBoundary('0')).toBe(false)
      expect(isWordBoundary('9')).toBe(false)
      expect(isWordBoundary('_')).toBe(false)
    })

    it('should treat undefined as boundary', () => {
      expect(isWordBoundary(undefined)).toBe(true)
    })
  })

  describe('findLineStart', () => {
    it('should find start of single line', () => {
      const input = toCharArray('hello world')
      expect(findLineStart(input, 6)).toBe(0)
      expect(findLineStart(input, 11)).toBe(0)
    })

    it('should find start of current logical line in multi-line', () => {
      const input = toCharArray('line1\nline2\nline3')
      // Position 12 is at start of "line3"
      expect(findLineStart(input, 12)).toBe(12) // Start of "line3"
      // Position 8 is in middle of "line2"
      expect(findLineStart(input, 8)).toBe(6) // Start of "line2"
    })

    it('should stay at start when already there', () => {
      const input = toCharArray('hello world')
      expect(findLineStart(input, 0)).toBe(0)
    })

    it('should handle position right after newline', () => {
      const input = toCharArray('line1\nline2')
      expect(findLineStart(input, 6)).toBe(6) // Position at start of "line2"
    })
  })

  describe('findLineEnd', () => {
    it('should find end of single line', () => {
      const input = toCharArray('hello world')
      expect(findLineEnd(input, 0)).toBe(11)
      expect(findLineEnd(input, 6)).toBe(11)
    })

    it('should find end of current logical line in multi-line', () => {
      const input = toCharArray('line1\nline2\nline3')
      // Position: "l|ine1" → should stop at newline (position 5)
      expect(findLineEnd(input, 1)).toBe(5)
    })

    it('should stay at end when already there', () => {
      const input = toCharArray('hello world')
      expect(findLineEnd(input, 11)).toBe(11)
    })

    it('should handle position at newline', () => {
      const input = toCharArray('line1\nline2')
      expect(findLineEnd(input, 5)).toBe(5) // At the '\n'
    })
  })

  describe('findPrevWordStart', () => {
    it('should move to previous word start', () => {
      const input = toCharArray('hello world test')
      //                         0123456789...
      // From position 16 (end), should move to 12 (start of "test")
      expect(findPrevWordStart(input, 16)).toBe(12)
      // From position 12, should move to 6 (start of "world")
      expect(findPrevWordStart(input, 12)).toBe(6)
      // From position 6, should move to 0 (start of "hello")
      expect(findPrevWordStart(input, 6)).toBe(0)
    })

    it('should skip punctuation', () => {
      const input = toCharArray('hello,world')
      // From position 11 (end), should move to 6 (start of "world")
      expect(findPrevWordStart(input, 11)).toBe(6)
      // From position 6, should move to 0 (start of "hello")
      expect(findPrevWordStart(input, 6)).toBe(0)
    })

    it('should handle consecutive spaces', () => {
      const input = toCharArray('hello   world')
      // From position 13 (end), should move to 8 (start of "world")
      expect(findPrevWordStart(input, 13)).toBe(8)
    })

    it('should stay at start when at beginning', () => {
      const input = toCharArray('hello world')
      expect(findPrevWordStart(input, 0)).toBe(0)
    })

    it('should handle position in middle of word', () => {
      const input = toCharArray('hello world')
      //                         0123456789...
      // From position 8 (middle of "world"), should move to 6 (start of "world")
      expect(findPrevWordStart(input, 8)).toBe(6)
    })
  })

  describe('findNextWordStart', () => {
    it('should move to next word start', () => {
      const input = toCharArray('hello world test')
      // From position 0 (start), should move to 6 (start of "world")
      expect(findNextWordStart(input, 0)).toBe(6)
      // From position 6, should move to 12 (start of "test")
      expect(findNextWordStart(input, 6)).toBe(12)
      // From position 12, should move to 16 (end)
      expect(findNextWordStart(input, 12)).toBe(16)
    })

    it('should skip punctuation', () => {
      const input = toCharArray('hello,world')
      // From position 0, should move to 6 (start of "world")
      expect(findNextWordStart(input, 0)).toBe(6)
    })

    it('should handle consecutive spaces', () => {
      const input = toCharArray('hello   world')
      // From position 0, should move to 8 (start of "world")
      expect(findNextWordStart(input, 0)).toBe(8)
    })

    it('should stay at end when already there', () => {
      const input = toCharArray('hello world')
      expect(findNextWordStart(input, 11)).toBe(11)
    })

    it('should handle position in middle of word', () => {
      const input = toCharArray('hello world')
      // From position 2 (middle of "hello"), should move to 6 (start of "world")
      expect(findNextWordStart(input, 2)).toBe(6)
    })
  })

  describe('Word Navigation Edge Cases', () => {
    it('should handle text with only punctuation', () => {
      const input = toCharArray(',,,...')
      expect(findNextWordStart(input, 0)).toBe(6) // Skip all punctuation to end
      expect(findPrevWordStart(input, 6)).toBe(0) // Skip back to start
    })

    it('should handle text with newlines', () => {
      const input = toCharArray('hello\nworld')
      // Newlines are treated as word boundaries
      expect(findNextWordStart(input, 0)).toBe(6) // From "hello" to "world"
      expect(findPrevWordStart(input, 11)).toBe(6) // From end back to "world"
    })

    it('should handle single character words', () => {
      const input = toCharArray('a b c')
      expect(findNextWordStart(input, 0)).toBe(2) // From "a" to "b"
      expect(findNextWordStart(input, 2)).toBe(4) // From "b" to "c"
      expect(findPrevWordStart(input, 4)).toBe(2) // From "c" to "b"
      expect(findPrevWordStart(input, 2)).toBe(0) // From "b" to "a"
    })

    it('should handle mixed punctuation and spaces', () => {
      const input = toCharArray('hello, world! test')
      // Position 0 → "hello"
      // Position 7 → "world"
      // Position 14 → "test"
      expect(findNextWordStart(input, 0)).toBe(7)
      expect(findNextWordStart(input, 7)).toBe(14)
      expect(findPrevWordStart(input, 14)).toBe(7)
      expect(findPrevWordStart(input, 7)).toBe(0)
    })
  })

  describe('Line Navigation with Multi-line', () => {
    it('should handle multiple lines', () => {
      const input = toCharArray('line1\nline2\nline3')
      //                         012345 678901 234567
      //                               6      12

      // Line 1: positions 0-4, newline at 5
      expect(findLineStart(input, 3)).toBe(0)
      expect(findLineEnd(input, 3)).toBe(5)

      // Line 2: positions 6-10, newline at 11
      expect(findLineStart(input, 8)).toBe(6)
      expect(findLineEnd(input, 8)).toBe(11)

      // Line 3: positions 12-16
      expect(findLineStart(input, 14)).toBe(12)
      expect(findLineEnd(input, 14)).toBe(17)
    })

    it('should handle empty lines', () => {
      const input = toCharArray('line1\n\nline3')
      //                         012345 6 789012

      // Empty line is position 6 to 6 (just the newline)
      expect(findLineStart(input, 6)).toBe(6)
      expect(findLineEnd(input, 6)).toBe(6)
    })
  })
})
