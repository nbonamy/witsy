<template>
  <div class="sidebar" :style="`width: ${sidebarWidth}px`">
    <div class="toolbar">
      <div class="icon-text" @click="onNewChat">
        <BIconPencilSquare />
      </div>
    </div>
    <ChatList :chat="chat" />
    <div class="footer">
      <div class="icon-text" id="open-settings" @click="onSettings">
        <BIconGearFill />
        <span>Settings</span>
      </div>
    </div>
  </div>
  <div class="resizer" :style="`left: ${sidebarWidth-5}px`" @mousedown="onResizeSidebarStart">&nbsp;</div>
</template>

<script setup>

import { ref } from 'vue'
import Chat from '../models/chat'
import ChatList from './ChatList.vue'

import useEventBus from '../composables/useEventBus'
const { emitEvent } = useEventBus()

const props = defineProps({
  chat: Chat
})

const sidebarWidth = ref('250')

const onSettings = () => {
  emitEvent('openSettings')
}

const onNewChat = () => {
  emitEvent('newChat')
}

const onResizeSidebarStart = (event) => {
  window.addEventListener('mousemove', onResizeSidebarMove)
  window.addEventListener('mouseup', onResizeSidebarEnd)
}

const onResizeSidebarMove = (event) => {
  let width = Math.max(150, Math.min(400, event.clientX))
  sidebarWidth.value = width
}

const onResizeSidebarEnd = () => {
  window.removeEventListener('mousemove', onResizeSidebarMove)
  window.removeEventListener('mouseup', onResizeSidebarEnd)
  window.api.store.set('sidebarWidth', sidebarWidth.value)
}

</script>

<style scoped>
.sidebar {
  width: var(--sidebar-width);
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  height: 100vh;
  background-color: var(--sidebar-bg-color);
  border-right: 1px solid #d0cfce;
  overflow-x: hidden;
  position: relative;
}

.toolbar {
  padding: 16px;
  text-align: right;
  -webkit-app-region: drag;
}

.toolbar .icon-text {
  -webkit-app-region: no-drag;
}

.footer {
  padding: 16px;
  font-size: 11pt;
}

.icon-text {
  color: #5b5a59;
  cursor: pointer;
  display: inline-block;
}

.icon-text span {
  position: relative;
  margin-left: 4px;
  top: -2px;
}

.resizer {
  position: absolute;
  width: 10px;
  height: 100%;
  cursor: ew-resize;
  z-index: 1000;
}

</style>
