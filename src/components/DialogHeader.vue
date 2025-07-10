<template>
  <header @mousedown="onMoveStart" ref="header" :class="{ movable: movable === 'drag' }">
    <div class="macos">
      <div class="close" @click="onClose"><BIconX/></div>
      <div class="minimize"></div>
      <div class="zoom"></div>
    </div>
    <div class="title">{{ title }}</div>
    <div class="windows" @click="onClose">
      <BIconXLg class="close" />
    </div>
  </header>
</template>

<script setup lang="ts">

import { ref, PropType } from 'vue'

export type MovableType = 'none' | 'drag' | 'position'

const props = defineProps({
  title: { type: String, default: '' },
  movable: { type: String as PropType<MovableType>, default: 'position' },
})

const emit = defineEmits(['close'])

const header= ref<HTMLElement|null>(null)

const onClose = () => {
  emit('close')
}

let lastX = 0
let lastY = 0

const onMoveStart = (event: MouseEvent) => {
  if (props.movable !== 'position') return
  window.addEventListener('mousemove', onMove)
  window.addEventListener('mouseup', onMoveEnd)
  const dialog = header.value!.closest<HTMLElement>('.dialog')
  dialog!.style.position = 'absolute'
  lastX = event.clientX
  lastY = event.clientY
}

const onMove = (event: MouseEvent) => {
  const dialog = header.value!.closest<HTMLElement>('.dialog')
  const left = parseInt(dialog!.style.left) || 0
  const top = parseInt(dialog!.style.top) || 0
  dialog!.style.left = `${left + (event.clientX - lastX)}px`
  dialog!.style.top = `${top + (event.clientY - lastY)}px`
  lastX = event.clientX
  lastY = event.clientY
}

const onMoveEnd = () => {
  window.removeEventListener('mousemove', onMove)
  window.removeEventListener('mouseup', onMoveEnd)
}


</script>

<style scoped>

.dialog header {
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  align-items: center;
}

.dialog header.movable {
  -webkit-app-region: drag;
}

.dialog header :not(.title) {
  -webkit-app-region: no-drag;
}

.dialog header .macos {
  display: flex;
  flex-direction: row;
  align-items: center;
  margin-left: 3px;
}

.dialog header .macos > * {
  width: 12px;
  height: 12px;
  margin-right: 8px;
  border-radius: 6px;
  background-color: #D5D4D3;
  border: 0.5px solid #B2B3B0;
}

.dialog header .macos svg {
  font-weight: bold;
  font-size: 10pt;
  position: relative;
  top: -1px;
  left: -1px;
}

.dialog header .macos .close {
  color: #FF5F56;
  background-color: #FF5F56;
  border-color: #E14138;
}

.dialog header .macos:hover .close {
  color: #730000;
}

.windows .dialog header .macos {
  display: none;
}

.dialog header .windows {
  margin-right: 4px;
}

.macos .dialog header .windows {
  display: none;
}

.dialog header .windows .close {
  cursor: pointer;
}

.dialog header .title {
  flex: 1;
}

.macos .dialog header .title {
  padding-right: 64px;
}

.windows .dialog header .title {
  padding-left: 16px;
}

.windows .dialog header .close {
  color: black;
}

@media (prefers-color-scheme: dark) {
  .windows .dialog header .close {
    color: white;
  }
}

</style>