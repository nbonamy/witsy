
<template>
  <div class="resizable-horizontal" ref="container">
    <slot></slot>
    <div class="handle" @mousedown="startResize"></div>
  </div>
</template>

<script setup lang="ts">

import { ref, onMounted } from 'vue'

const props = defineProps({
  minWidth: Number,
  onResize: Function,
  resizeElems: {
    type: Boolean,
    default: true
  }
})

const container = ref(null)

let child = null
let lastX = null

onMounted(() => {
  child = container.value.querySelector(':not(.handle)')
})

const startResize = (ev: MouseEvent) => {
  window.addEventListener('mousemove', onResizing)
  window.addEventListener('mouseup', stopResizing)
  lastX = ev.clientX
}

const onResizing = (ev: MouseEvent) => {
  if (lastX === null) return
  const deltaX = ev.clientX - lastX
  if (adjustWidth(deltaX)) {
    props.onResize?.(deltaX)
    lastX = ev.clientX
  }
}

const stopResizing = () => {
  document.removeEventListener('mousemove', onResizing)
  document.removeEventListener('mouseup', stopResizing)
  lastX = null
}

const setElWidth = (el: HTMLElement, width: number) => {
  const pl = parseInt(window.getComputedStyle(el, null).getPropertyValue('padding-left')) || 0
  const pr = parseInt(window.getComputedStyle(el, null).getPropertyValue('padding-right')) || 0
  el.style.width = `${width-pl-pr}px`
}

const adjustWidth = (deltaX: number): boolean => {
  const targetWidth = child.offsetWidth + deltaX
  if (props.minWidth && targetWidth < props.minWidth) return false
  if (props.resizeElems) {
    setElWidth(child, child.offsetWidth + deltaX)
    setElWidth(container.value, container.value.offsetWidth + deltaX)
  }
  return true
}

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
