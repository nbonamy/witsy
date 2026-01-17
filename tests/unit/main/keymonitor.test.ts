
import { expect, test, describe, vi } from 'vitest'
import { NativeShortcut } from '../../../src/types/index'
import KeyMonitor from '../../../src/main/keymonitor'

// Mock autolib
vi.mock('autolib', () => ({
  default: {
    startKeyMonitor: vi.fn(() => 0),
    stopKeyMonitor: vi.fn(() => 0),
    isKeyMonitorRunning: vi.fn(() => false),
  }
}))

// Mock config
vi.mock('../../../src/main/config', () => ({
  loadSettings: vi.fn(() => ({
    shortcuts: {}
  }))
}))

// Mock Monitor
vi.mock('../../../src/main/monitor', () => ({
  default: class MockMonitor {
    start() {}
    stop() {}
  }
}))

// macOS key codes for assertions (same as in keymonitor.ts for darwin)
const MODIFIER_KEY_CODES: Record<string, number> = {
  rightCommand: 54,
  leftCommand: 55,
  rightShift: 60,
  leftShift: 56,
  rightOption: 61,
  leftOption: 58,
  rightControl: 62,
  leftControl: 59,
}

const KEY_CODES: Record<string, number> = {
  // Letters
  A: 0, B: 11, C: 8, D: 2, E: 14, F: 3, G: 5, H: 4, I: 34, J: 38,
  K: 40, L: 37, M: 46, N: 45, O: 31, P: 35, Q: 12, R: 15, S: 1, T: 17,
  U: 32, V: 9, W: 13, X: 7, Y: 16, Z: 6,
  // Numbers
  '0': 29, '1': 18, '2': 19, '3': 20, '4': 21,
  '5': 23, '6': 22, '7': 26, '8': 28, '9': 25,
  // Special keys
  Space: 49,
  Return: 36,
}

describe('KeyMonitor parseNativeShortcut', () => {

  describe('disabled shortcuts', () => {
    test('should return null for key: "none" without modifiers', () => {
      const shortcut: NativeShortcut = { type: 'native', key: 'none' }
      expect(KeyMonitor.parseNativeShortcut(shortcut)).toBeNull()
    })

    // Note: key: "none" WITH modifiers is handled as modifier-only (see that section)
  })

  describe('modifier-only shortcuts (no key, single modifier)', () => {
    test('should parse rightCommand modifier-only', () => {
      const shortcut: NativeShortcut = { type: 'native', rightCommand: true }
      const result = KeyMonitor.parseNativeShortcut(shortcut)
      expect(result).not.toBeNull()
      expect(result!.modifierKeyCode).toBe(MODIFIER_KEY_CODES.rightCommand)
      expect(result!.requiredModifiers).toEqual([])
    })

    test('should parse rightCommand with key: "none" as modifier-only (merged from defaults)', () => {
      // This happens when user config { type: "native", rightCommand: true }
      // gets merged with default { key: "none" }
      const shortcut: NativeShortcut = { type: 'native', key: 'none', rightCommand: true }
      const result = KeyMonitor.parseNativeShortcut(shortcut)
      expect(result).not.toBeNull()
      expect(result!.modifierKeyCode).toBe(MODIFIER_KEY_CODES.rightCommand)
      expect(result!.requiredModifiers).toEqual([])
    })

    test('should parse leftCommand modifier-only', () => {
      const shortcut: NativeShortcut = { type: 'native', leftCommand: true }
      const result = KeyMonitor.parseNativeShortcut(shortcut)
      expect(result).not.toBeNull()
      expect(result!.modifierKeyCode).toBe(MODIFIER_KEY_CODES.leftCommand)
    })

    test('should parse rightShift modifier-only', () => {
      const shortcut: NativeShortcut = { type: 'native', rightShift: true }
      const result = KeyMonitor.parseNativeShortcut(shortcut)
      expect(result).not.toBeNull()
      expect(result!.modifierKeyCode).toBe(MODIFIER_KEY_CODES.rightShift)
    })

    test('should parse with empty string key', () => {
      const shortcut: NativeShortcut = { type: 'native', key: '', rightCommand: true }
      const result = KeyMonitor.parseNativeShortcut(shortcut)
      expect(result).not.toBeNull()
      expect(result!.modifierKeyCode).toBe(MODIFIER_KEY_CODES.rightCommand)
    })
  })

  describe('modifier-only shortcuts (key is modifier name)', () => {
    test('should parse key: "rightCommand"', () => {
      const shortcut: NativeShortcut = { type: 'native', key: 'rightCommand' }
      const result = KeyMonitor.parseNativeShortcut(shortcut)
      expect(result).not.toBeNull()
      expect(result!.modifierKeyCode).toBe(MODIFIER_KEY_CODES.rightCommand)
      expect(result!.requiredModifiers).toEqual([])
    })

    test('should parse key: "leftShift"', () => {
      const shortcut: NativeShortcut = { type: 'native', key: 'leftShift' }
      const result = KeyMonitor.parseNativeShortcut(shortcut)
      expect(result).not.toBeNull()
      expect(result!.modifierKeyCode).toBe(MODIFIER_KEY_CODES.leftShift)
    })
  })

  describe('modifier + key combos', () => {
    test('should parse rightCommand + Space', () => {
      const shortcut: NativeShortcut = { type: 'native', rightCommand: true, key: 'Space' }
      const result = KeyMonitor.parseNativeShortcut(shortcut)
      expect(result).not.toBeNull()
      expect(result!.keyCode).toBe(KEY_CODES.Space)
      expect(result!.requiredModifiers).toEqual([MODIFIER_KEY_CODES.rightCommand])
      expect(result!.modifierKeyCode).toBeUndefined()
    })

    test('should parse leftCommand + Return', () => {
      const shortcut: NativeShortcut = { type: 'native', leftCommand: true, key: 'Return' }
      const result = KeyMonitor.parseNativeShortcut(shortcut)
      expect(result).not.toBeNull()
      expect(result!.keyCode).toBe(KEY_CODES.Return)
      expect(result!.requiredModifiers).toEqual([MODIFIER_KEY_CODES.leftCommand])
    })

    test('should parse multiple modifiers + key', () => {
      const shortcut: NativeShortcut = { type: 'native', rightCommand: true, rightShift: true, key: 'Space' }
      const result = KeyMonitor.parseNativeShortcut(shortcut)
      expect(result).not.toBeNull()
      expect(result!.keyCode).toBe(KEY_CODES.Space)
      expect(result!.requiredModifiers).toContain(MODIFIER_KEY_CODES.rightCommand)
      expect(result!.requiredModifiers).toContain(MODIFIER_KEY_CODES.rightShift)
    })

    test('should parse leftCommand + leftShift + letter key B', () => {
      const shortcut: NativeShortcut = { type: 'native', leftCommand: true, leftShift: true, key: 'B' }
      const result = KeyMonitor.parseNativeShortcut(shortcut)
      expect(result).not.toBeNull()
      expect(result!.keyCode).toBe(KEY_CODES.B)
      expect(result!.requiredModifiers).toContain(MODIFIER_KEY_CODES.leftCommand)
      expect(result!.requiredModifiers).toContain(MODIFIER_KEY_CODES.leftShift)
    })

    test('should parse modifier + number key', () => {
      const shortcut: NativeShortcut = { type: 'native', leftCommand: true, key: '1' }
      const result = KeyMonitor.parseNativeShortcut(shortcut)
      expect(result).not.toBeNull()
      expect(result!.keyCode).toBe(KEY_CODES['1'])
      expect(result!.requiredModifiers).toEqual([MODIFIER_KEY_CODES.leftCommand])
    })
  })

  describe('multi-modifier combos (no key, multiple modifiers)', () => {
    test('should parse rightCommand + rightOption combo', () => {
      const shortcut: NativeShortcut = { type: 'native', rightCommand: true, rightOption: true }
      const result = KeyMonitor.parseNativeShortcut(shortcut)
      expect(result).not.toBeNull()
      expect(result!.modifierKeyCode).toBeUndefined()
      expect(result!.keyCode).toBeUndefined()
      expect(result!.requiredModifiers).toContain(MODIFIER_KEY_CODES.rightCommand)
      expect(result!.requiredModifiers).toContain(MODIFIER_KEY_CODES.rightOption)
      expect(result!.requiredModifiers.length).toBe(2)
    })

    test('should parse rightControl + rightShift combo', () => {
      const shortcut: NativeShortcut = { type: 'native', rightControl: true, rightShift: true }
      const result = KeyMonitor.parseNativeShortcut(shortcut)
      expect(result).not.toBeNull()
      expect(result!.requiredModifiers).toContain(MODIFIER_KEY_CODES.rightControl)
      expect(result!.requiredModifiers).toContain(MODIFIER_KEY_CODES.rightShift)
    })

    test('should parse three modifiers combo', () => {
      const shortcut: NativeShortcut = { type: 'native', rightCommand: true, rightOption: true, rightShift: true }
      const result = KeyMonitor.parseNativeShortcut(shortcut)
      expect(result).not.toBeNull()
      expect(result!.requiredModifiers.length).toBe(3)
    })

    test('should parse combo with key: "none" (merged from defaults)', () => {
      const shortcut: NativeShortcut = { type: 'native', key: 'none', rightCommand: true, rightOption: true }
      const result = KeyMonitor.parseNativeShortcut(shortcut)
      expect(result).not.toBeNull()
      expect(result!.requiredModifiers).toContain(MODIFIER_KEY_CODES.rightCommand)
      expect(result!.requiredModifiers).toContain(MODIFIER_KEY_CODES.rightOption)
    })
  })

  describe('invalid shortcuts', () => {
    test('should return null for unknown key without modifiers', () => {
      const shortcut: NativeShortcut = { type: 'native', key: 'UnknownKey' }
      expect(KeyMonitor.parseNativeShortcut(shortcut)).toBeNull()
    })

    test('should return null for unknown key with modifiers', () => {
      const shortcut: NativeShortcut = { type: 'native', rightCommand: true, key: 'UnknownKey' }
      expect(KeyMonitor.parseNativeShortcut(shortcut)).toBeNull()
    })

    test('should return null for known key without modifiers', () => {
      const shortcut: NativeShortcut = { type: 'native', key: 'Space' }
      expect(KeyMonitor.parseNativeShortcut(shortcut)).toBeNull()
    })
  })

})
