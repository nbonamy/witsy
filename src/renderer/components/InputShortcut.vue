
<template>
  <div class="form-subgroup">
    <input type="text" v-model="display" spellcheck="false" @keydown.prevent="onKeyDown" />
    <button class="clear" :class="{ disabled: !display }" @click.prevent="onDelete"><XCircleIcon /></button>
  </div>
</template>

<script setup lang="ts">

import { XCircleIcon } from 'lucide-vue-next';
import { computed } from 'vue';
import { ElectronShortcut, NativeShortcut, Shortcut, disabledShortcutKey } from 'types/index';
import { isNativeShortcut } from '@renderer/utils/shortcut';

const props = defineProps<{
  acceptNative?: boolean
}>()

const value = defineModel<Shortcut|undefined>()

const emit = defineEmits(['change']);

const modifierSymbols = {
  ctrl: window.api.platform === 'darwin' ? '⌃' : 'Ctrl+',
  alt: window.api.platform === 'darwin' ? '⌥' : 'Alt+',
  shift: window.api.platform === 'darwin' ? '⇧' : 'Shift+',
  meta: window.api.platform === 'darwin' ? '⌘' : 'Win+',
}

const nativeModifierSymbols = {
  // Right-side (single modifiers)
  rightCommand: window.api.platform === 'darwin' ? 'Right ⌘' : 'Right Win',
  rightOption: window.api.platform === 'darwin' ? 'Right ⌥' : 'Right Alt',
  rightShift: window.api.platform === 'darwin' ? 'Right ⇧' : 'Right Shift',
  rightControl: window.api.platform === 'darwin' ? 'Right ⌃' : 'Right Ctrl',
  // Left-side (for combos, shown without "Left" prefix)
  leftCommand: window.api.platform === 'darwin' ? '⌘' : 'Win',
  leftOption: window.api.platform === 'darwin' ? '⌥' : 'Alt',
  leftShift: window.api.platform === 'darwin' ? '⇧' : 'Shift',
  leftControl: window.api.platform === 'darwin' ? '⌃' : 'Ctrl',
}

const display = computed(() => {
  if (value.value == null) return ''

  // Native shortcut display
  if (isNativeShortcut(value.value)) {
    const parts: string[] = []
    // Right-side modifiers
    if (value.value.rightCommand) parts.push(nativeModifierSymbols.rightCommand)
    if (value.value.rightOption) parts.push(nativeModifierSymbols.rightOption)
    if (value.value.rightShift) parts.push(nativeModifierSymbols.rightShift)
    if (value.value.rightControl) parts.push(nativeModifierSymbols.rightControl)
    // Left-side modifiers (for combos)
    if (value.value.leftControl) parts.push(nativeModifierSymbols.leftControl)
    if (value.value.leftOption) parts.push(nativeModifierSymbols.leftOption)
    if (value.value.leftShift) parts.push(nativeModifierSymbols.leftShift)
    if (value.value.leftCommand) parts.push(nativeModifierSymbols.leftCommand)
    if (value.value.key && value.value.key !== disabledShortcutKey) {
      parts.push(value.value.key)
    }
    return parts.join(window.api.platform === 'darwin' ? '' : '+')
  }

  // Electron shortcut display
  const electronShortcut = value.value as ElectronShortcut
  if (electronShortcut.key === disabledShortcutKey) return ''

  let display = ''
  if (electronShortcut.ctrl) display += modifierSymbols.ctrl
  if (electronShortcut.alt) display += modifierSymbols.alt
  if (electronShortcut.shift) display += modifierSymbols.shift
  if (electronShortcut.meta) display += modifierSymbols.meta
  display += electronShortcut.key
  return display
})

const onDelete = () => {
  if (props.acceptNative) {
    value.value = { type: 'native' }
  } else {
    value.value = { type: 'electron', key: disabledShortcutKey }
  }
  emit('change')
}

// Right-side native modifier keys only
type NativeModifierKey = 'rightCommand' | 'rightShift' | 'rightOption' | 'rightControl'

// Map event.code to native shortcut modifier (right-side only)
const codeToNativeModifier: Record<string, NativeModifierKey> = {
  'MetaRight': 'rightCommand',
  'ShiftRight': 'rightShift',
  'AltRight': 'rightOption',
  'ControlRight': 'rightControl',
}

const onKeyDown = (event: KeyboardEvent) => {

  // delete
  if (event.key === 'Backspace' || event.key === 'Delete') {
    onDelete()
    return
  }

  // Check for native modifier-only shortcut when acceptNative is true
  if (props.acceptNative) {
    // Right-side single modifier
    const rightModifierKey = codeToNativeModifier[event.code]
    if (rightModifierKey) {
      const shortcut: NativeShortcut = { type: 'native' }
      shortcut[rightModifierKey] = true
      value.value = shortcut
      emit('change')
      return
    }

    // Left-side modifier combinations (need 2 modifiers held)
    const leftModifiers: Record<string, keyof NativeShortcut> = {
      'MetaLeft': 'leftCommand',
      'AltLeft': 'leftOption',
      'ShiftLeft': 'leftShift',
      'ControlLeft': 'leftControl',
    }
    const leftModifierKey = leftModifiers[event.code]
    if (leftModifierKey) {
      // Count how many modifiers are held
      const heldCount = [event.metaKey, event.altKey, event.shiftKey, event.ctrlKey].filter(Boolean).length
      if (heldCount >= 2) {
        // Two or more left modifiers - create combo shortcut
        const shortcut: NativeShortcut = { type: 'native' }
        if (event.metaKey) shortcut.leftCommand = true
        if (event.altKey) shortcut.leftOption = true
        if (event.shiftKey) shortcut.leftShift = true
        if (event.ctrlKey) shortcut.leftControl = true
        value.value = shortcut
        emit('change')
      }
      // Single left modifier alone - ignore (wait for second)
      return
    }
  }

  // Electron shortcut mode (modifier + key)
  onKeyDownElectron(event)
}

const onKeyDownElectron = (event: KeyboardEvent) => {

  // must have at least one modifier
  if (!event.altKey && !event.shiftKey && !event.ctrlKey && !event.metaKey) {
    return
  }

  // can't be a modifier or escape
  if ([16, 17, 18, 20, 27, 91, 92, 93, 224, 225].includes(event.keyCode)) {
    return
  }

  // skip some shift and meta stuff
  if (event.code.startsWith('Shift') || event.code.startsWith('Meta')) {
    return
  }

  // build key
  let key = event.code.replace('Key', '').replace('Digit', '')
  if (key === 'Minus')  key = '-'
  if (key === 'Equal')  key = '='
  if (key === 'BracketLeft')  key = '['
  if (key === 'BracketRight')  key = ']'
  if (key === 'Backslash')  key = '\\'
  if (key === 'Semicolon')  key = ';'
  if (key === 'Quote')  key = "'"
  if (key === 'Comma')  key = ','
  if (key === 'Period')  key = '.'
  if (key === 'Slash')  key = '/'
  if (key === 'Backquote')  key = '`'
  if (key === 'ArrowUp')  key = '↑'
  if (key === 'ArrowDown')  key = '↓'
  if (key === 'ArrowLeft')  key = '←'
  if (key === 'ArrowRight')  key = '→'

  // seems ok
  value.value = {
    type: 'electron',
    key: key,
    alt: event.altKey,
    shift: event.shiftKey,
    ctrl: event.ctrlKey,
    meta: event.metaKey
  }

  // notify
  emit('change')

}

</script>


<style scoped>

.form-subgroup {
  display: flex;
  align-items: center;
  white-space: nowrap;
}

input {
  flex: 0;
  width: auto !important;
  text-align: center;
}

button {
  height: 32px;
}

.clear {
  cursor: pointer;
  margin-left: 0.5rem;
  svg {
    opacity: 0.4;
    position: relative;
    top: 1px;
  }

  &.disabled {
    pointer-events: none;
    svg {
      opacity: 0.1;
    }
  }
}

</style>