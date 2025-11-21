
import { expect, test, describe, beforeEach } from 'vitest'
import Splitter from '@main/rag/splitter'
import { Configuration } from '@/types/config'

const mockConfig: Configuration = {
  rag: {
    chunkSize: 100,
    chunkOverlap: 20,
  }
} as Configuration

describe('Splitter', () => {

  let splitter: Splitter

  beforeEach(() => {
    splitter = new Splitter(mockConfig)
  })

  describe('Basic splitting', () => {

    test('splits text on double newlines', async () => {
      const text = 'First paragraph.\n\nSecond paragraph.\n\nThird paragraph.'
      const chunks = await splitter.split(text)

      expect(chunks.length).toBeGreaterThan(0)
      expect(chunks.join('')).toContain('First paragraph')
      expect(chunks.join('')).toContain('Second paragraph')
      expect(chunks.join('')).toContain('Third paragraph')
    })

    test('splits text on single newlines when no double newlines', async () => {
      const text = 'Line one.\nLine two.\nLine three.'
      const chunks = await splitter.split(text)

      expect(chunks.length).toBeGreaterThan(0)
      expect(chunks.join('')).toContain('Line one')
      expect(chunks.join('')).toContain('Line two')
      expect(chunks.join('')).toContain('Line three')
    })

    test('splits text on spaces when no newlines', async () => {
      const text = 'word1 word2 word3 word4 word5 word6 word7 word8 word9 word10 word11 word12 word13 word14 word15'
      const chunks = await splitter.split(text)

      expect(chunks.length).toBeGreaterThan(0)
      expect(chunks.some(chunk => chunk.includes('word1'))).toBe(true)
    })

    test('splits character by character when text has no separators', async () => {
      const text = 'a'.repeat(150) // 150 characters, no separators
      const chunks = await splitter.split(text)

      expect(chunks.length).toBeGreaterThan(1)
      expect(chunks.every(chunk => chunk.length <= 100)).toBe(true)
    })

  })

  describe('Edge cases', () => {

    test('handles empty string', async () => {
      const chunks = await splitter.split('')
      expect(chunks).toEqual([])
    })

    test('handles text shorter than chunk size', async () => {
      const text = 'Short text.'
      const chunks = await splitter.split(text)

      expect(chunks.length).toBe(1)
      // Note: splitter keeps separators, so result might have spaces preserved
      expect(chunks[0].replace(/\s+/g, ' ').trim()).toBe(text.replace(/\s+/g, ' ').trim())
    })

    test('handles text exactly at chunk size', async () => {
      const text = 'a'.repeat(100)
      const chunks = await splitter.split(text)

      expect(chunks.length).toBeGreaterThanOrEqual(1)
      expect(chunks[0].length).toBeLessThanOrEqual(100)
    })

    test('handles single character', async () => {
      const chunks = await splitter.split('a')
      expect(chunks).toEqual(['a'])
    })

    test('handles text with only separators', async () => {
      const chunks = await splitter.split('\n\n\n\n')
      // Should filter out empty strings
      expect(chunks.every(chunk => chunk.length > 0)).toBe(true)
    })

  })

  describe('Chunk size and overlap', () => {

    test('respects maximum chunk size', async () => {
      const text = 'a'.repeat(500) + '\n\n' + 'b'.repeat(500)
      const chunks = await splitter.split(text)

      // Allow some tolerance for separators
      expect(chunks.every(chunk => chunk.length <= 110)).toBe(true)
    })

    test('maintains overlap between chunks', async () => {
      // Create text that will definitely split
      const text = 'Line1\n'.repeat(50) // Will create multiple chunks
      const chunks = await splitter.split(text)

      if (chunks.length > 1) {
        // Check that consecutive chunks have some overlap
        for (let i = 0; i < chunks.length - 1; i++) {
          const currentChunk = chunks[i]
          const nextChunk = chunks[i + 1]

          // Get the end of current chunk
          const currentEnd = currentChunk.slice(-30) // Look at last 30 chars

          // Check if any part of it appears in next chunk
          const hasOverlap = nextChunk.includes(currentEnd.trim()) ||
                            currentEnd.split('\n').some(line =>
                              line.length > 0 && nextChunk.includes(line)
                            )

          // At least some overlap should exist
          expect(hasOverlap).toBe(true)
        }
      }
    })

    test('uses configured chunk size', async () => {
      const customConfig: Configuration = {
        rag: {
          chunkSize: 50,
          chunkOverlap: 10,
        }
      } as Configuration

      const customSplitter = new Splitter(customConfig)
      const text = 'a'.repeat(200)
      const chunks = await customSplitter.split(text)

      expect(chunks.every(chunk => chunk.length <= 60)).toBe(true)
    })

  })

  describe('Separator hierarchy', () => {

    test('prefers double newlines over single newlines', async () => {
      const text = 'Part1\n\nPart2\nLine2\n\nPart3'
      const chunks = await splitter.split(text)

      // Should split primarily on \n\n
      expect(chunks.some(chunk => chunk.includes('Part1'))).toBe(true)
      expect(chunks.some(chunk => chunk.includes('Part2'))).toBe(true)
    })

    test('falls back to spaces when no newlines available', async () => {
      const text = 'word '.repeat(100)
      const chunks = await splitter.split(text)

      expect(chunks.length).toBeGreaterThan(1)
    })

    test('keeps separators at start of chunks', async () => {
      const text = 'First\n\nSecond\n\nThird'
      const chunks = await splitter.split(text)

      // Check that separators are preserved
      const rejoined = chunks.join('')
      expect(rejoined).toContain('\n\n')
    })

  })

  describe('Large documents', () => {

    test('handles 1MB document without blocking', async () => {
      // Create a 1MB text document
      const paragraph = 'This is a test paragraph that will be repeated many times to create a large document.\n\n'
      const text = paragraph.repeat(1024 * 10) // ~1MB

      const startTime = Date.now()
      const chunks = await splitter.split(text)
      const endTime = Date.now()

      expect(chunks.length).toBeGreaterThan(0)
      expect(endTime - startTime).toBeLessThan(10000) // Should complete within 10 seconds
    })

    test('handles JSON-like structure', async () => {
      // Simulate JSON content
      const json = JSON.stringify({
        data: Array(1000).fill(null).map((_, i) => ({
          id: i,
          name: `Item ${i}`,
          description: 'A'.repeat(100),
        }))
      }, null, 2)

      const chunks = await splitter.split(json)

      expect(chunks.length).toBeGreaterThan(1)
      expect(chunks.every(chunk => chunk.length <= 110)).toBe(true)
    })

  })

  describe('Real-world scenarios', () => {

    test('handles code with various indentation', async () => {
      const code = `
function example() {
  const x = 1;

  if (x > 0) {
    console.log('positive');
  }

  return x;
}

class MyClass {
  constructor() {
    this.value = 0;
  }

  method() {
    return this.value;
  }
}
`.repeat(5)

      const chunks = await splitter.split(code)

      expect(chunks.length).toBeGreaterThan(0)
      expect(chunks.every(chunk => chunk.length <= 110)).toBe(true)
    })

    test('handles markdown document', async () => {
      const markdown = `
# Heading 1

This is a paragraph.

## Heading 2

Another paragraph with some content.

- List item 1
- List item 2
- List item 3

### Heading 3

More content here.
`.repeat(10)

      const chunks = await splitter.split(markdown)

      expect(chunks.length).toBeGreaterThan(1)
      expect(chunks.some(chunk => chunk.includes('# Heading 1'))).toBe(true)
    })

    test('handles text with mixed line endings', async () => {
      const text = 'Line1\n\nLine2\nLine3\n\nLine4'
      const chunks = await splitter.split(text)

      expect(chunks.length).toBeGreaterThan(0)
      expect(chunks.join('')).toContain('Line1')
      expect(chunks.join('')).toContain('Line4')
    })

  })

  describe('Non-blocking behavior', () => {

    test('completes async operation', async () => {
      const text = 'a'.repeat(10000)

      // Should return a promise and complete
      const promise = splitter.split(text)
      expect(promise).toBeInstanceOf(Promise)

      const chunks = await promise
      expect(chunks.length).toBeGreaterThan(0)
    })

    test('handles multiple concurrent splits', async () => {
      const text1 = 'First document\n\n'.repeat(100)
      const text2 = 'Second document\n\n'.repeat(100)
      const text3 = 'Third document\n\n'.repeat(100)

      const [chunks1, chunks2, chunks3] = await Promise.all([
        splitter.split(text1),
        splitter.split(text2),
        splitter.split(text3),
      ])

      expect(chunks1.length).toBeGreaterThan(0)
      expect(chunks2.length).toBeGreaterThan(0)
      expect(chunks3.length).toBeGreaterThan(0)
    })

  })

})
