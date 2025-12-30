import { expect, test, describe } from 'vitest'
import { Prompt } from '../../../../src/cli/components/prompt'

describe('Prompt', () => {

  describe('constructor', () => {
    test('has id "prompt"', () => {
      const prompt = new Prompt()
      expect(prompt.id).toBe('prompt')
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

  describe('line count', () => {
    test('setLineCount updates count', () => {
      const prompt = new Prompt()
      prompt.setLineCount(3)
      expect(prompt.getLineCount()).toBe(3)
    })

    test('setLineCount marks dirty when changed', () => {
      const prompt = new Prompt()
      prompt.clearDirty()

      prompt.setLineCount(2)

      expect(prompt.isDirty()).toBe(true)
    })

    test('setLineCount same value does not mark dirty', () => {
      const prompt = new Prompt()
      prompt.clearDirty()

      prompt.setLineCount(1)

      expect(prompt.isDirty()).toBe(false)
    })
  })

  describe('calculateInputLineCount', () => {
    test('single line without wrapping', () => {
      const prompt = new Prompt('> ')
      const count = prompt.calculateInputLineCount('hello', 80)
      expect(count).toBe(1)
    })

    test('accounts for prompt length', () => {
      const prompt = new Prompt('>>> ')
      // ">>> " (4) + 76 chars = 80, should fit on one line
      const count = prompt.calculateInputLineCount('a'.repeat(75), 80)
      expect(count).toBe(1)
    })

    test('wraps when exceeding width', () => {
      const prompt = new Prompt('> ')
      // "> " (2) + 80 chars = 82, should wrap to 2 lines
      const count = prompt.calculateInputLineCount('a'.repeat(80), 80)
      expect(count).toBe(2)
    })

    test('handles explicit newlines', () => {
      const prompt = new Prompt('> ')
      const count = prompt.calculateInputLineCount('line1\nline2\nline3', 80)
      expect(count).toBe(3)
    })

    test('handles empty input', () => {
      const prompt = new Prompt('> ')
      const count = prompt.calculateInputLineCount('', 80)
      expect(count).toBe(1)
    })
  })

  describe('height calculation', () => {
    test('returns current line count', () => {
      const prompt = new Prompt()
      prompt.setLineCount(5)
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
      prompt.setLineCount(3)
      const lines = prompt.render(80)

      expect(lines.length).toBe(3)
      expect(lines[0]).toBe('> ')
      expect(lines[1]).toBe('')
      expect(lines[2]).toBe('')
    })
  })
})
