
import { ElectronShortcut, NativeShortcut, Shortcut } from 'types/index'

/**
 * Check if a shortcut is a native shortcut
 */
export const isNativeShortcut = (shortcut: Shortcut | undefined): shortcut is NativeShortcut => {
  return shortcut?.type === 'native'
}

/**
 * Check if a shortcut is an electron shortcut
 */
export const isElectronShortcut = (shortcut: Shortcut | undefined): shortcut is ElectronShortcut => {
  return shortcut?.type !== 'native'
}

/**
 * Check if a native shortcut has a key (not modifier-only)
 */
export const nativeShortcutHasKey = (shortcut: NativeShortcut): boolean => {
  return !!shortcut.key && shortcut.key !== '' && shortcut.key !== 'none'
}

/**
 * Convert a native shortcut to an electron shortcut.
 * Only works if the native shortcut has a key.
 * Returns null if conversion is not possible.
 */
export const nativeToElectron = (shortcut: NativeShortcut): ElectronShortcut | null => {
  if (!nativeShortcutHasKey(shortcut)) {
    return null
  }

  const electron: ElectronShortcut = {
    type: 'electron',
    key: shortcut.key!
  }

  // Map native modifiers to electron modifiers
  // Both left and right variants map to the same electron modifier
  if (shortcut.leftCommand || shortcut.rightCommand) {
    electron.meta = true
  }
  if (shortcut.leftOption || shortcut.rightOption) {
    electron.alt = true
  }
  if (shortcut.leftShift || shortcut.rightShift) {
    electron.shift = true
  }
  if (shortcut.leftControl || shortcut.rightControl) {
    electron.ctrl = true
  }

  return electron
}

/**
 * Convert an electron shortcut to a native shortcut.
 * Uses left-side modifiers by default since that's what Electron represents.
 */
export const electronToNative = (shortcut: ElectronShortcut): NativeShortcut => {
  const native: NativeShortcut = {
    type: 'native'
  }

  // Map electron modifiers to left-side native modifiers
  if (shortcut.meta) {
    native.leftCommand = true
  }
  if (shortcut.alt) {
    native.leftOption = true
  }
  if (shortcut.shift) {
    native.leftShift = true
  }
  if (shortcut.ctrl) {
    native.leftControl = true
  }

  // Copy the key if present
  if (shortcut.key && shortcut.key !== '' && shortcut.key !== 'none') {
    native.key = shortcut.key
  }

  return native
}

/**
 * Convert shortcut to electron if possible (has key), otherwise keep as native.
 * Use when switching to 'tap' activation mode.
 */
export const toElectronIfPossible = (shortcut: Shortcut | undefined): Shortcut | undefined => {
  if (!shortcut) return undefined

  if (isNativeShortcut(shortcut)) {
    const electron = nativeToElectron(shortcut)
    return electron ?? shortcut // Keep native if no key
  }

  return shortcut // Already electron
}

/**
 * Convert shortcut to native and validate.
 * Use when switching to 'doubleTap' or 'hold' activation mode.
 * Returns undefined if the converted shortcut is invalid.
 */
export const toNative = (shortcut: Shortcut | undefined): NativeShortcut | undefined => {
  if (!shortcut) return undefined

  let native: NativeShortcut
  if (isNativeShortcut(shortcut)) {
    native = shortcut
  } else {
    native = electronToNative(shortcut)
  }

  // Validate the native shortcut
  if (!window.api.shortcuts.isValidNativeShortcut(JSON.parse(JSON.stringify(native)))) {
    return undefined
  }

  return native
}
