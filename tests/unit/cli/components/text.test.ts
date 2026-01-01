import { expect, test, describe } from 'vitest'
import { Text } from '../../../../src/cli/components/text'

describe('Text', () => {

  describe('basic rendering', () => {
    test('renders empty content as single line plus trailing blank', () => {
      const text = new Text('')
      // 1 content line + 1 trailing blank for spacing
      expect(text.calculateHeight(80)).toBe(2)
      expect(text.render(80)).toEqual(['    ', ''])
    })

    test('renders short content on one line plus trailing blank', () => {
      const text = new Text('Hello world')
      // 1 content line + 1 trailing blank for spacing
      expect(text.calculateHeight(80)).toBe(2)
      const lines = text.render(80)
      expect(lines[0]).toContain('Hello world')
    })

    test('adds padding to content', () => {
      const text = new Text('Test')
      const lines = text.render(80)
      expect(lines[0]).toMatch(/^ {2}.* {2}$/)
    })
  })

  describe('word wrapping', () => {
    test('wraps long text', () => {
      const longText = 'This is a very long line that should wrap because it exceeds the width'
      const text = new Text(longText)
      // With width 40, this should wrap
      const height = text.calculateHeight(40)
      expect(height).toBeGreaterThan(1)
    })

    test('preserves newlines', () => {
      const text = new Text('Line 1\nLine 2\nLine 3')
      // 3 content lines + 1 trailing blank
      expect(text.calculateHeight(80)).toBe(4)
    })

    test('handles empty paragraphs', () => {
      const text = new Text('Para 1\n\nPara 2')
      // 3 content lines (including empty paragraph) + 1 trailing blank
      expect(text.calculateHeight(80)).toBe(4)
    })

    test('breaks very long words', () => {
      const longWord = 'a'.repeat(100)
      const text = new Text(longWord)
      const height = text.calculateHeight(40)
      expect(height).toBeGreaterThan(2)
    })
  })

  describe('content management', () => {
    test('setContent updates content', () => {
      const text = new Text('Initial')
      text.setContent('Updated')
      expect(text.getContent()).toBe('Updated')
    })

    test('setContent marks dirty', () => {
      const text = new Text('Initial')
      text.clearDirty()

      text.setContent('Updated')

      expect(text.isDirty()).toBe(true)
    })

    test('setContent same value does not mark dirty', () => {
      const text = new Text('Same')
      text.clearDirty()

      text.setContent('Same')

      expect(text.isDirty()).toBe(false)
    })

    test('appendContent adds to content', () => {
      const text = new Text('Hello')
      text.appendContent(' World')
      expect(text.getContent()).toBe('Hello World')
    })

    test('appendContent marks dirty', () => {
      const text = new Text('Hello')
      text.clearDirty()

      text.appendContent(' World')

      expect(text.isDirty()).toBe(true)
    })
  })

  describe('styles', () => {
    test('default style renders without transformation', () => {
      const text = new Text('Test', 'default')
      const lines = text.render(80)
      // Should contain the text without gray styling
      expect(lines[0]).toContain('Test')
    })

    test('user style adds prefix', () => {
      const text = new Text('User message', 'user')
      const lines = text.render(80)
      // User style should have "> " prefix
      expect(lines[0]).toContain('>')
    })

    test('setStyle updates and marks dirty', () => {
      const text = new Text('Test', 'default')
      text.clearDirty()

      text.setStyle('user')

      expect(text.isDirty()).toBe(true)
    })

    test('setStyle same value does not mark dirty', () => {
      const text = new Text('Test', 'user')
      text.clearDirty()

      text.setStyle('user')

      expect(text.isDirty()).toBe(false)
    })
  })

  describe('caching', () => {
    test('caches wrapped lines for same width', () => {
      const text = new Text('Test content')

      // First call calculates
      text.calculateHeight(80)
      // Second call with same width uses cache
      const height = text.calculateHeight(80)

      // 1 content line + 1 trailing blank
      expect(height).toBe(2)
    })

    test('recalculates for different width', () => {
      const longText = 'This is a long line that will wrap differently at different widths'
      const text = new Text(longText)

      const height80 = text.calculateHeight(80)
      const height40 = text.calculateHeight(40)

      expect(height40).toBeGreaterThan(height80)
    })
  })
})
