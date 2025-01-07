
import { expect, test } from 'vitest'
import { shortcutAccelerator } from '../../src/main/shortcuts'

test('Shortcuts Keys', async () => {
  
  expect(shortcutAccelerator()).toBeNull()
  expect(shortcutAccelerator(null)).toBeNull()
  
  expect(shortcutAccelerator({key: 'none'})).toBeNull()
  
  expect(shortcutAccelerator({key: 'Space'})).toBe('Space')
  expect(shortcutAccelerator({key: 'A'})).toBe('A')
  expect(shortcutAccelerator({key: '+'})).toBe('Plus')
  expect(shortcutAccelerator({key: '↑'})).toBe('Up')
  expect(shortcutAccelerator({key: '↓'})).toBe('Down')
  expect(shortcutAccelerator({key: '←'})).toBe('Left')
  expect(shortcutAccelerator({key: '→'})).toBe('Right')

  expect(shortcutAccelerator({key: 'NumpadAdd'})).toBe('numadd')
  expect(shortcutAccelerator({key: 'NumpadSubtract'})).toBe('numsub')
  expect(shortcutAccelerator({key: 'NumpadMultiply'})).toBe('nummult')
  expect(shortcutAccelerator({key: 'NumpadDivide'})).toBe('numdiv')
  expect(shortcutAccelerator({key: 'NumpadDecimal'})).toBe('numdec')
  expect(shortcutAccelerator({key: 'Numpad0'})).toBe('num0')
  expect(shortcutAccelerator({key: 'Numpad1'})).toBe('num1')
  expect(shortcutAccelerator({key: 'Numpad2'})).toBe('num2')
  expect(shortcutAccelerator({key: 'Numpad3'})).toBe('num3')
  expect(shortcutAccelerator({key: 'Numpad4'})).toBe('num4')
  expect(shortcutAccelerator({key: 'Numpad5'})).toBe('num5')
  expect(shortcutAccelerator({key: 'Numpad6'})).toBe('num6')
  expect(shortcutAccelerator({key: 'Numpad7'})).toBe('num7')
  expect(shortcutAccelerator({key: 'Numpad8'})).toBe('num8')
  expect(shortcutAccelerator({key: 'Numpad9'})).toBe('num9')

})

test('Shortcuts Modifiers', async () => {

  expect(shortcutAccelerator({key: 'none', alt: true})).toBe(null)
  expect(shortcutAccelerator({key: 'none', ctrl: true})).toBe(null)
  expect(shortcutAccelerator({key: 'none', shift: true})).toBe(null)
  expect(shortcutAccelerator({key: 'none', meta: true})).toBe(null)

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
