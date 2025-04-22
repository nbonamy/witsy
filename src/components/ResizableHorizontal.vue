
<template>
  <div class="resizable-horizontal" ref="container">
    <slot></slot>
    <div class="handle" @mousedown="startResize"></div>
  </div>
</template>

<script setup lang="ts">

import { ref, type Ref } from 'vue'

const props = defineProps({
  minWidth: Number,
  resizeElems: {
    type: Boolean,
    default: true
  }
})

const container: Ref<HTMLElement|null> = ref(null)

let child: HTMLElement|null = null
let lastX: number|null = null

const emit = defineEmits(['resize'])

const startResize = (ev: MouseEvent) => {
  window.addEventListener('mousemove', onResizing)
  window.addEventListener('mouseup', stopResizing)
  child = container.value!.querySelector(':not(.handle)')
  lastX = ev.clientX
}

const onResizing = (ev: MouseEvent) => {
  if (lastX === null) return
  const deltaX = ev.clientX - lastX
  if (adjustWidth(deltaX)) {
    emit('resize', deltaX)
    lastX = ev.clientX
  }
}

const stopResizing = () => {
  document.removeEventListener('mousemove', onResizing)
  document.removeEventListener('mouseup', stopResizing)
  lastX = null
}

/* v8 ignore start */
const setElWidth = (el: HTMLElement, width: number) => {
  try {
    const pl = parseInt(window.getComputedStyle(el, null).getPropertyValue('padding-left')) || 0
    const pr = parseInt(window.getComputedStyle(el, null).getPropertyValue('padding-right')) || 0
    el.style.width = `${width-pl-pr}px`
  } catch (e) {
    if (!process.env.TEST) {
      console.error('Error setting element width:', e)
    }
  }
}

const adjustWidth = (deltaX: number): boolean => {
  if (!child) return false
  const targetWidth = child.offsetWidth + deltaX
  if (props.minWidth && targetWidth < props.minWidth) return false
  if (props.resizeElems) {
    setElWidth(child, child.offsetWidth + deltaX)
    setElWidth(container.value!, container.value!.offsetWidth + deltaX)
  }
  return true
}
/* v8 ignore stop */

defineExpose({
  adjustWidth
})

</script>

<style scoped>

.resizable-horizontal {
  position: relative;
}

.handle {
  -webkit-app-region: no-drag;
  position: absolute;
  top: 0;
  bottom: 0;
  right: 0;
  width: 4px;
  cursor: ew-resize;
}

</style>
