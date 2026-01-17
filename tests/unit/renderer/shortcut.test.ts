
import { describe, it, expect, beforeAll } from 'vitest'
import { useWindowMock } from '@tests/mocks/window'
import {
  isNativeShortcut,
  isElectronShortcut,
  nativeShortcutHasKey,
  nativeToElectron,
  electronToNative,
  toElectronIfPossible,
  toNative
} from '@renderer/utils/shortcut'
import { ElectronShortcut, NativeShortcut } from 'types/index'

describe('shortcut utils', () => {

  beforeAll(() => {
    useWindowMock()
  })

  describe('isNativeShortcut', () => {

    it('returns true for native shortcuts', () => {
      const shortcut: NativeShortcut = { type: 'native', rightCommand: true }
      expect(isNativeShortcut(shortcut)).toBe(true)
    })

    it('returns false for electron shortcuts', () => {
      const shortcut: ElectronShortcut = { type: 'electron', meta: true, key: 'D' }
      expect(isNativeShortcut(shortcut)).toBe(false)
    })

    it('returns false for undefined', () => {
      expect(isNativeShortcut(undefined)).toBe(false)
    })

  })

  describe('isElectronShortcut', () => {

    it('returns true for electron shortcuts', () => {
      const shortcut: ElectronShortcut = { type: 'electron', meta: true, key: 'D' }
      expect(isElectronShortcut(shortcut)).toBe(true)
    })

    it('returns true for electron shortcuts with explicit type', () => {
      const shortcut: ElectronShortcut = { type: 'electron', meta: true, key: 'D' }
      expect(isElectronShortcut(shortcut)).toBe(true)
    })

    it('returns false for native shortcuts', () => {
      const shortcut: NativeShortcut = { type: 'native', rightCommand: true }
      expect(isElectronShortcut(shortcut)).toBe(false)
    })

    it('returns true for undefined', () => {
      expect(isElectronShortcut(undefined)).toBe(true)
    })

  })

  describe('nativeShortcutHasKey', () => {

    it('returns true when key is present', () => {
      const shortcut: NativeShortcut = { type: 'native', leftCommand: true, key: 'D' }
      expect(nativeShortcutHasKey(shortcut)).toBe(true)
    })

    it('returns false when key is missing', () => {
      const shortcut: NativeShortcut = { type: 'native', rightCommand: true }
      expect(nativeShortcutHasKey(shortcut)).toBe(false)
    })

    it('returns false when key is empty string', () => {
      const shortcut: NativeShortcut = { type: 'native', rightCommand: true, key: '' }
      expect(nativeShortcutHasKey(shortcut)).toBe(false)
    })

    it('returns false when key is "none"', () => {
      const shortcut: NativeShortcut = { type: 'native', rightCommand: true, key: 'none' }
      expect(nativeShortcutHasKey(shortcut)).toBe(false)
    })

  })

  describe('nativeToElectron', () => {

    it('converts native shortcut with key to electron', () => {
      const native: NativeShortcut = {
        type: 'native',
        leftCommand: true,
        leftOption: true,
        key: 'D'
      }
      const electron = nativeToElectron(native)
      expect(electron).toEqual({
        type: 'electron', 
        meta: true,
        alt: true,
        key: 'D'
      })
    })

    it('converts right-side modifiers to electron modifiers', () => {
      const native: NativeShortcut = {
        type: 'native',
        rightCommand: true,
        rightShift: true,
        key: 'X'
      }
      const electron = nativeToElectron(native)
      expect(electron).toEqual({
        type: 'electron', 
        meta: true,
        shift: true,
        key: 'X'
      })
    })

    it('converts all modifier types', () => {
      const native: NativeShortcut = {
        type: 'native',
        leftCommand: true,
        leftOption: true,
        leftShift: true,
        leftControl: true,
        key: 'A'
      }
      const electron = nativeToElectron(native)
      expect(electron).toEqual({
        type: 'electron',
        meta: true,
        alt: true,
        shift: true,
        ctrl: true,
        key: 'A'
      })
    })

    it('returns null for modifier-only shortcut', () => {
      const native: NativeShortcut = { type: 'native', rightCommand: true }
      expect(nativeToElectron(native)).toBeNull()
    })

    it('returns null when key is "none"', () => {
      const native: NativeShortcut = { type: 'native', rightCommand: true, key: 'none' }
      expect(nativeToElectron(native)).toBeNull()
    })

  })

  describe('electronToNative', () => {

    it('converts electron shortcut to native with left-side modifiers', () => {
      const electron: ElectronShortcut = {
        type: 'electron',
        meta: true,
        alt: true,
        key: 'D'
      }
      const native = electronToNative(electron)
      expect(native).toEqual({
        type: 'native',
        leftCommand: true,
        leftOption: true,
        key: 'D'
      })
    })

    it('converts all modifier types', () => {
      const electron: ElectronShortcut = {
        type: 'electron',
        meta: true,
        alt: true,
        shift: true,
        ctrl: true,
        key: 'A'
      }
      const native = electronToNative(electron)
      expect(native).toEqual({
        type: 'native',
        leftCommand: true,
        leftOption: true,
        leftShift: true,
        leftControl: true,
        key: 'A'
      })
    })

    it('omits key when empty', () => {
      const electron: ElectronShortcut = { type: 'electron', meta: true, key: '' }
      const native = electronToNative(electron)
      expect(native).toEqual({
        type: 'native',
        leftCommand: true
      })
    })

    it('omits key when "none"', () => {
      const electron: ElectronShortcut = { type: 'electron', meta: true, key: 'none' }
      const native = electronToNative(electron)
      expect(native).toEqual({
        type: 'native',
        leftCommand: true
      })
    })

  })

  describe('toElectronIfPossible', () => {

    it('returns undefined for undefined input', () => {
      expect(toElectronIfPossible(undefined)).toBeUndefined()
    })

    it('converts native shortcut with key to electron', () => {
      const native: NativeShortcut = {
        type: 'native',
        leftCommand: true,
        key: 'D'
      }
      const result = toElectronIfPossible(native)
      expect(result).toEqual({
        type: 'electron',
        meta: true,
        key: 'D'
      })
    })

    it('keeps native shortcut if modifier-only', () => {
      const native: NativeShortcut = { type: 'native', rightCommand: true }
      const result = toElectronIfPossible(native)
      expect(result).toBe(native)
    })

    it('returns electron shortcut unchanged', () => {
      const electron: ElectronShortcut = {  type: 'electron', meta: true, key: 'D' }
      const result = toElectronIfPossible(electron)
      expect(result).toBe(electron)
    })

  })

  describe('toNative', () => {

    it('returns undefined for undefined input', () => {
      expect(toNative(undefined)).toBeUndefined()
    })

    it('returns native shortcut unchanged', () => {
      const native: NativeShortcut = { type: 'native', rightCommand: true }
      const result = toNative(native)
      expect(result).toBe(native)
    })

    it('converts electron shortcut to native', () => {
      const electron: ElectronShortcut = {
        type: 'electron',
        meta: true,
        alt: true,
        key: 'D'
      }
      const result = toNative(electron)
      expect(result).toEqual({
        type: 'native',
        leftCommand: true,
        leftOption: true,
        key: 'D'
      })
    })

  })

})
