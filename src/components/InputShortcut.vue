
<template>
  <div class="wrapper">
    <input type="text" v-model="display" @focus="onFocus" @blur="onBlur" @keydown="onKeyDown" />
    <BIconXCircleFill class="icon" @click="onDelete" />
  </div>
</template>

<script setup>

import { ipcRenderer } from 'electron'
import { computed } from 'vue'
import { store } from '../services/store'

const value = defineModel()

const display = computed(() => {
  let display = ''
  if (value.value != null) {
    display = value.value.key
    if (value.value.meta) {
      display = '⌘' + display
    }
    if (value.value.shift) {
      display = '⇧' + display
    }
    if (value.value.alt) {
      display = '⌥' + display
    }
    if (value.value.ctrl) {
      display = '⌃' + display
    }
  }
  return display
})

const onFocus = () => {
  ipcRenderer.send('unregister-shortcuts')
}

const onBlur = () => {
  ipcRenderer.send('register-shortcuts', JSON.stringify(store.config.shortcuts))
}

const onDelete = () => {
  value.value = null
}

const onKeyDown = (event) => {
  // default
  console.log('keydown', event)
  event.preventDefault()

  // delete
  if (event.key === 'Backspace' || event.key === 'Delete') {
    value.value = null
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

  // seems ok
  value.value = {
    key: event.code.replace('Key', '').replace('Digit', ''),
    alt: event.altKey,
    shift: event.shiftKey,
    ctrl: event.ctrlKey,
    meta: event.metaKey
  }

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