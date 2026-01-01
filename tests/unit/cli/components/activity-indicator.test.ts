import { expect, test, describe } from 'vitest'
import { ActivityIndicator } from '../../../../src/cli/components/activity-indicator'

describe('ActivityIndicator', () => {

  describe('constructor', () => {
    test('id starts empty', () => {
      const indicator = new ActivityIndicator()
      expect(indicator.id).toBe('')
    })

    test('id is set via setId', () => {
      const indicator = new ActivityIndicator('loading')
      indicator.setId('custom-id')
      expect(indicator.id).toBe('custom-id')
    })

    test('default text is empty', () => {
      const indicator = new ActivityIndicator()
      expect(indicator.getText()).toBe('')
    })

    test('custom text', () => {
      const indicator = new ActivityIndicator('Loading...')
      expect(indicator.getText()).toBe('Loading...')
    })
  })

  describe('text management', () => {
    test('setText changes text', () => {
      const indicator = new ActivityIndicator('initial')
      indicator.setText('updated')
      expect(indicator.getText()).toBe('updated')
    })

    test('setText marks dirty', () => {
      const indicator = new ActivityIndicator('initial')
      indicator.clearDirty()

      indicator.setText('updated')

      expect(indicator.isDirty()).toBe(true)
    })

    test('setText same value does not mark dirty', () => {
      const indicator = new ActivityIndicator('same')
      indicator.clearDirty()

      indicator.setText('same')

      expect(indicator.isDirty()).toBe(false)
    })
  })

  describe('animation', () => {
    test('advanceAnimation marks dirty', () => {
      const indicator = new ActivityIndicator()
      indicator.clearDirty()

      indicator.advanceAnimation()

      expect(indicator.isDirty()).toBe(true)
    })
  })

  describe('height', () => {
    test('always returns 1', () => {
      const indicator = new ActivityIndicator('some text')
      expect(indicator.calculateHeight(80)).toBe(1)
    })
  })

  describe('rendering', () => {
    test('renders single line', () => {
      const indicator = new ActivityIndicator()
      const lines = indicator.render(80)
      expect(lines.length).toBe(1)
    })

    test('renders text with animation frame', () => {
      const indicator = new ActivityIndicator('Loading...')
      const lines = indicator.render(80)

      expect(lines[0]).toContain('Loading...')
    })

    test('renders just animation frame when no text', () => {
      const indicator = new ActivityIndicator('')
      const lines = indicator.render(80)

      // Should just be the animation frame character
      expect(lines[0].length).toBeGreaterThan(0)
    })

    test('animation changes after advance', () => {
      const indicator = new ActivityIndicator('test')
      const lines1 = indicator.render(80)

      indicator.advanceAnimation()
      const lines2 = indicator.render(80)

      // The animation frame should have changed
      // (may or may not be visible depending on chalk)
      expect(lines1[0]).not.toBe(lines2[0])
    })
  })
})
