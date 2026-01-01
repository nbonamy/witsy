import { expect, test, describe } from 'vitest'
import { Prompt } from '../../../../src/cli/components/prompt'

describe('Prompt', () => {

  describe('constructor', () => {
    test('id starts empty', () => {
      const prompt = new Prompt()
      expect(prompt.id).toBe('')
    })

    test('default prompt text is "> "', () => {
      const prompt = new Prompt()
      expect(prompt.getPromptText()).toBe('> ')
    })

    test('custom prompt text', () => {
      const prompt = new Prompt('>>> ')
      expect(prompt.getPromptText()).toBe('>>> ')
    })

    test('default line count is 1', () => {
      const prompt = new Prompt()
      expect(prompt.getLineCount()).toBe(1)
    })
  })

  describe('prompt text', () => {
    test('setPromptText updates text', () => {
      const prompt = new Prompt('> ')
      prompt.setPromptText('>>> ')
      expect(prompt.getPromptText()).toBe('>>> ')
    })

    test('setPromptText marks dirty', () => {
      const prompt = new Prompt()
      prompt.clearDirty()

      prompt.setPromptText('>>> ')

      expect(prompt.isDirty()).toBe(true)
    })
  })

  describe('line count via onInputChange', () => {
    test('onInputChange updates line count based on text', () => {
      const prompt = new Prompt('> ')
      // Long text that wraps to multiple lines
      prompt.onInputChange('a'.repeat(80), 80)
      expect(prompt.getLineCount()).toBe(2)
    })

    test('onInputChange returns true when height changed', () => {
      const prompt = new Prompt('> ')
      const changed = prompt.onInputChange('a'.repeat(80), 80)
      expect(changed).toBe(true)
    })

    test('onInputChange returns false when height unchanged', () => {
      const prompt = new Prompt('> ')
      // First call sets it
      prompt.onInputChange('hello', 80)
      // Second call with same line count
      const changed = prompt.onInputChange('world', 80)
      expect(changed).toBe(false)
    })
  })

  describe('onInputChange line calculation', () => {
    test('single line without wrapping', () => {
      const prompt = new Prompt('> ')
      prompt.onInputChange('hello', 80)
      expect(prompt.getLineCount()).toBe(1)
    })

    test('accounts for prompt length', () => {
      const prompt = new Prompt('>>> ')
      // ">>> " (4) + 75 chars = 79, should fit on one line
      prompt.onInputChange('a'.repeat(75), 80)
      expect(prompt.getLineCount()).toBe(1)
    })

    test('wraps when exceeding width', () => {
      const prompt = new Prompt('> ')
      // "> " (2) + 80 chars = 82, should wrap to 2 lines
      prompt.onInputChange('a'.repeat(80), 80)
      expect(prompt.getLineCount()).toBe(2)
    })

    test('handles explicit newlines', () => {
      const prompt = new Prompt('> ')
      prompt.onInputChange('line1\nline2\nline3', 80)
      expect(prompt.getLineCount()).toBe(3)
    })

    test('handles empty input', () => {
      const prompt = new Prompt('> ')
      prompt.onInputChange('', 80)
      expect(prompt.getLineCount()).toBe(1)
    })
  })

  describe('height calculation', () => {
    test('returns current line count', () => {
      const prompt = new Prompt('> ')
      // Set line count via onInputChange
      prompt.onInputChange('line1\nline2\nline3\nline4\nline5', 80)
      expect(prompt.calculateHeight(80)).toBe(5)
    })
  })

  describe('rendering', () => {
    test('renders prompt text on first line', () => {
      const prompt = new Prompt('>>> ')
      const lines = prompt.render(80)
      expect(lines[0]).toBe('>>> ')
    })

    test('renders empty lines for additional rows', () => {
      const prompt = new Prompt('> ')
      // Set line count via onInputChange
      prompt.onInputChange('line1\nline2\nline3', 80)
      const lines = prompt.render(80)

      expect(lines.length).toBe(3)
      expect(lines[0]).toBe('> ')
      expect(lines[1]).toBe('')
      expect(lines[2]).toBe('')
    })
  })
})
