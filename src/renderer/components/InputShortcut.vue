
<template>
  <div class="form-subgroup">
    <input type="text" v-model="display" spellcheck="false" @keydown.prevent="onKeyDown" />
    <button class="clear" :class="{ disabled: !display }" @click.prevent="onDelete"><XCircleIcon /></button>
  </div>
</template>

<script setup lang="ts">

import { XCircleIcon } from 'lucide-vue-next';
import { ModelRef, computed } from 'vue';
import { Shortcut, disabledShortcutKey } from 'types/index';

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
  if (value.value != null && value.value.key !== disabledShortcutKey) {
    for (const modifier of Object.keys(modifiers)) {
      if (value.value[modifier]) {
        display = display + modifiers[modifier]
      }
    }
    display = display + value.value.key
  }
  return display
})

const onDelete = () => {
  value.value = { key: disabledShortcutKey }
  emit('change')
}

const onKeyDown = (event: KeyboardEvent) => {

  // delete
  if (event.key === 'Backspace' || event.key === 'Delete') {
    value.value = { key: disabledShortcutKey }
    emit('change')
    return
  }

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
  white-space: nowrap;
}

input {
  width: auto !important;
  text-align: center;
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