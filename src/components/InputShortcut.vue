
<template>
  <div class="wrapper">
    <input type="text" v-model="display" @focus="onFocus" @blur="onBlur" @keydown.prevent="onKeyDown" />
    <BIconXCircleFill class="icon" @click="onDelete" />
  </div>
</template>

<script setup lang="ts">

import { type ModelRef, computed } from 'vue'
import { type Shortcut } from '../types/index'

const value: ModelRef<Shortcut|undefined> = defineModel()

const emit = defineEmits(['change']);

const modifiers: { [key: string]: string } = {
  'ctrl': window.api.platform === 'darwin' ? '⌃' : 'Ctrl+',
  'alt': window.api.platform === 'darwin' ? '⌥' : 'Alt+',
  'shift': window.api.platform === 'darwin' ? '⇧' : 'Shift+',
  'meta': window.api.platform === 'darwin' ? '⌘' : 'Win+',
}

const display = computed(() => {
  let display = ''
  if (value.value != null) {
    for (const modifier of Object.keys(modifiers)) {
      if (value.value[modifier]) {
        display = display + modifiers[modifier]
      }
    }
    display = display + value.value.key
  }
  return display
})

const onFocus = () => {
  window.api.shortcuts.unregister()
}

const onBlur = () => {
  window.api.shortcuts.register()
}

const onDelete = () => {
  value.value = undefined
  emit('change')
}

const onKeyDown = (event: KeyboardEvent) => {

  // delete
  if (event.key === 'Backspace' || event.key === 'Delete') {
    value.value = undefined
    emit('change')
    return
  }

  // must have at least one modifier
  if (!event.altKey && !event.shiftKey && !event.ctrlKey && !event.metaKey) {
    return
  }

  // must be a normal character
  if (event.keyCode < 32) {
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
@import '../../css/form.css';
</style>

<style scoped>

.wrapper {
  flex: 1;
  position: relative;
}

input {
  width: 100%;
  text-align: center;
  font-weight: bold;
}

.icon {
  cursor: pointer;
  position: absolute;
  top: 4px;
  right: 4px;
}

</style>