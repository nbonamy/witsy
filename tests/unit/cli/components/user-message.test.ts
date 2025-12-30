import { expect, test, describe } from 'vitest'
import { UserMessage } from '../../../../src/cli/components/user-message'

describe('UserMessage', () => {

  describe('constructor', () => {
    test('stores content', () => {
      const msg = new UserMessage('Hello world')
      expect(msg.getContent()).toBe('Hello world')
    })

    test('custom id', () => {
      const msg = new UserMessage('Hello', 'msg-1')
      expect(msg.id).toBe('msg-1')
    })
  })

  describe('content management', () => {
    test('setContent updates content', () => {
      const msg = new UserMessage('initial')
      msg.setContent('updated')
      expect(msg.getContent()).toBe('updated')
    })
  })

  describe('height calculation', () => {
    test('single line content + blank line = 2', () => {
      const msg = new UserMessage('Short message')
      expect(msg.calculateHeight(80)).toBe(2)
    })

    test('multi-line content adds extra height', () => {
      const msg = new UserMessage('Line 1\nLine 2\nLine 3')
      // 3 lines + 1 blank = 4
      expect(msg.calculateHeight(80)).toBe(4)
    })
  })

  describe('rendering', () => {
    test('renders with user style prefix', () => {
      const msg = new UserMessage('Hello')
      const lines = msg.render(80)

      // First line should have ">" prefix
      expect(lines[0]).toContain('>')
    })

    test('renders blank line after content', () => {
      const msg = new UserMessage('Hello')
      const lines = msg.render(80)

      // Last line should be blank
      expect(lines[lines.length - 1]).toBe('')
    })
  })
})
