
import { expect, test } from 'vitest'
import { shortcutAccelerator } from '../../src/main/shortcuts'

test('Shortcuts Keys', async () => {
  expect(shortcutAccelerator(null)).toBeNull()
  expect(shortcutAccelerator({key: 'Space'})).toBe('Space')
  expect(shortcutAccelerator({key: 'A'})).toBe('A')
  expect(shortcutAccelerator({key: '+'})).toBe('Plus')
  expect(shortcutAccelerator({key: '↑'})).toBe('Up')
  expect(shortcutAccelerator({key: '↓'})).toBe('Down')
  expect(shortcutAccelerator({key: '←'})).toBe('Left')
  expect(shortcutAccelerator({key: '→'})).toBe('Right')
})

test('Shortcuts Modifiers', async () => {
  expect(shortcutAccelerator({key: 'A', alt: true})).toBe('Alt+A')
  expect(shortcutAccelerator({key: 'A', ctrl: true})).toBe('Control+A')
  expect(shortcutAccelerator({key: 'A', shift: true})).toBe('Shift+A')
  expect(shortcutAccelerator({key: 'A', meta: true})).toBe('Command+A')

  expect(shortcutAccelerator({key: 'A', alt: true, ctrl: true})).toBe('Alt+Control+A')
  expect(shortcutAccelerator({key: 'A', alt: true, shift: true})).toBe('Alt+Shift+A')
  expect(shortcutAccelerator({key: 'A', alt: true, meta: true})).toBe('Alt+Command+A')
  expect(shortcutAccelerator({key: 'A', ctrl: true, shift: true})).toBe('Control+Shift+A')
  expect(shortcutAccelerator({key: 'A', ctrl: true, meta: true})).toBe('Control+Command+A')
  expect(shortcutAccelerator({key: 'A', shift: true, meta: true})).toBe('Shift+Command+A')

  expect(shortcutAccelerator({key: 'A', alt: true, ctrl: true, shift: true})).toBe('Alt+Control+Shift+A')
  expect(shortcutAccelerator({key: 'A', alt: true, ctrl: true, meta: true})).toBe('Alt+Control+Command+A')
  expect(shortcutAccelerator({key: 'A', alt: true, shift: true, meta: true})).toBe('Alt+Shift+Command+A')
  expect(shortcutAccelerator({key: 'A', ctrl: true, shift: true, meta: true})).toBe('Control+Shift+Command+A')

  expect(shortcutAccelerator({key: 'A', alt: true, ctrl: true, shift: true, meta: true})).toBe('Alt+Control+Shift+Command+A')
})
