<template>
  <div class="sidebar" :style="`width: ${sidebarWidth}px`">
    <div class="toolbar">
      <form><div class="group search">
        <input v-model="filter" placeholder="Search…" @keyup="onFilterChange" />
        <BIconXCircleFill v-if="filter" class="clear-filter" @click="onClearFilter" />
      </div></form>
      <div class="icon-text" @click="onNewChat">
        <BIconPencilSquare />
      </div>
    </div>
    <ChatList :chat="chat" :filter="filter" />
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
import { store } from '../services/store'
import Chat from '../models/chat'
import ChatList from './ChatList.vue'

import useEventBus from '../composables/useEventBus'
const { emitEvent } = useEventBus()

const props = defineProps({
  chat: Chat
})

const sidebarWidth = ref('250')
const filter = ref('')

const onSettings = () => {
  emitEvent('openSettings')
}

const onNewChat = () => {
  onClearFilter()
  emitEvent('newChat')
}

const onFilterChange = () => {
  store.chatFilter = filter.value.trim()
}

const onClearFilter = () => {
  filter.value = ''
  store.chatFilter = null
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
@import '../../css/form.css';
</style>

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
  display: flex;
  justify-content: flex-end;
}

.macos .toolbar {
  padding-left: 80px;
}

.toolbar form {
  flex: 1;
  margin-top: -12px;
  -webkit-app-region: no-drag;
}

.toolbar .search input {
  background-color: #ccc;
  border-radius: 6px;
  padding-right: 24px;
}

.toolbar .search input:focus {
  background-color: white;
}

.toolbar .clear-filter {
  position: relative;
  left: -20px;
  font-size: 9pt;
  color: #888;
}

.toolbar .icon-text {
  -webkit-app-region: no-drag;
}

.icon-text {
  color: #5b5a59;
  cursor: pointer;
  display: inline-block;
  margin: 0px 8px;
}

.icon-text:last-child {
  margin-right: 0px;
}

.icon-text span {
  position: relative;
  top: -2px;
}

.resizer {
  position: absolute;
  width: 10px;
  height: 100%;
  cursor: ew-resize;
}

.footer {
  padding: 16px;
  font-size: 11pt;
}

</style>
