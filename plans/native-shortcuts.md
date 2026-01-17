# Native Shortcuts Implementation Plan

## Overview
Implement "character-less shortcuts" - the ability to trigger actions by pressing modifier keys alone (like right Command) or modifier combos (like Option+Command). Primary use case is push-to-talk dictation.

## Status: In Progress

## Completed Work

### Phase 1: Type System
- [x] Created discriminated union types for shortcuts
  - `ElectronShortcut` - traditional Electron accelerators
  - `NativeShortcut` - native modifier-only shortcuts
  - `Shortcut = ElectronShortcut | NativeShortcut`
- [x] Added `ShortcutActivation` type: `'tap' | 'doubleTap' | 'hold'`

### Phase 2: KeyMonitor Class (`src/main/keymonitor.ts`)
- [x] Native key event monitoring via autolib CGEventTap integration
- [x] Parses shortcuts config to find native shortcuts
- [x] Tracks held modifiers and "pressed alone" state
- [x] Supports:
  - Single modifier shortcuts (right-side: rightCommand, rightOption, etc.)
  - Multi-modifier combos (left-side: leftCommand+leftOption, etc.)
  - Modifier+key combinations
- [x] Fires onDown/onUp callbacks for activation logic
- [x] Unit tests: 18 passing

### Phase 3: Dictation Class (`src/main/automations/dictation.ts`)
- [x] Renamed from `transcriber.ts` via git mv
- [x] Handles activation mode logic:
  - `tap`: Toggle dictation on/off with single press
  - `doubleTap`: Start on double-tap within 400ms, single tap stops if open
  - `hold`: Push-to-talk - starts on down, stops on up
- [x] Unit tests: 13 passing (part of 31 total dictation tests)

### Phase 4: InputShortcut Component
- [x] Added `acceptNative` prop to accept native shortcuts
- [x] Filters keyboard events to only accept:
  - Right-side single modifiers (MetaRight, AltRight, ShiftRight, ControlRight)
  - Left-side modifier combos (2+ modifiers held together)
- [x] Renders native shortcuts with appropriate symbols/text

### Phase 5: Settings UI
- [x] Moved dictation shortcut from SettingsShortcuts to SettingsQuickDictation
- [x] Added:
  - Shortcut input with native support
  - Activation mode selector (tap/doubleTap/hold)
  - Platform-specific hint text showing supported native shortcuts
- [x] Updated SettingsShortcuts with link to Voice settings

### Phase 6: Integration
- [x] KeyMonitor instantiated in main.ts with callbacks
- [x] Added IPC method `areNativeShortcutsSupported()`
- [x] All lint checks pass
- [x] All tests pass (18 keymonitor + 31 dictation)

### Phase 7: Windows Support
- [x] Platform detection (`isMac = process.platform === 'darwin'`)
- [x] Windows VK codes for modifier keys (VK_LWIN, VK_RWIN, VK_LSHIFT, etc.)
- [x] Windows VK codes for regular keys (letters, numbers, punctuation, arrows)
- [x] Handle Windows modifier events (down/up instead of flagsChanged)
- [x] autolib already has SetWindowsHookEx integration
- [ ] Test on Windows (not yet tested)

### Phase 8: Shortcut Conversion
- [x] Auto-convert shortcuts based on activation mode
- [x] `toElectronIfPossible()` - converts native → electron if it has a key
- [x] `toNative()` - converts electron → native
- [x] When switching to tap: use electron if possible
- [x] When switching to doubleTap/hold: force native

## Remaining Work

### Phase 9: Additional Polish (Optional)
- [ ] Consider adding visual feedback when native shortcut is detected
- [ ] Add accessibility info/documentation
- [ ] Test on Windows

## Key Files Modified

| File | Changes |
|------|---------|
| `src/types/index.ts` | `ElectronShortcut`, `NativeShortcut`, `Shortcut` types |
| `src/types/config.ts` | `ShortcutActivation` type |
| `src/main/keymonitor.ts` | New file - native key monitoring |
| `src/main/automations/dictation.ts` | Renamed from transcriber.ts, activation modes |
| `src/renderer/components/InputShortcut.vue` | `acceptNative` prop, filtering |
| `src/renderer/settings/SettingsQuickDictation.vue` | Shortcut config, activation mode |
| `src/renderer/settings/SettingsShortcuts.vue` | Link to Voice settings |
| `src/main.ts` | KeyMonitor integration |
| `src/renderer/utils/shortcut.ts` | Shortcut conversion utilities |
| `tests/unit/main/keymonitor.test.ts` | New tests |
| `tests/unit/main/dictation.test.ts` | Renamed from transcriber.test.ts |
| `tests/unit/renderer/shortcut.test.ts` | Shortcut conversion tests |

## Commit Strategy

1. ~~Type definitions~~ (done)
2. ~~KeyMonitor implementation with tests~~ (done)
3. ~~Dictation activation modes with tests~~ (done)
4. ~~InputShortcut native support~~ (done)
5. ~~Settings UI changes~~ (done)
6. ~~Integration in main.ts~~ (done)
7. ~~Shortcut conversion utilities~~ (done)
8. ~~Windows key code support~~ (done)
9. Future: Additional polish

## Notes

- Native shortcuts work on macOS and Windows (Linux excluded)
- Right-side modifiers are used alone; left-side modifiers are used in combos
- This prevents conflicts with system shortcuts which typically use left-side modifiers
- Windows needs testing - key codes added but not verified on actual hardware
