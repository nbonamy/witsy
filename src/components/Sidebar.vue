<template>
  <div class="sidebar">
    <div class="toolbar">
      <div class="icon-text" @click="onNewChat">
        <BIconPencilSquare />
      </div>
    </div>
    <ChatList :chat="chat" />
    <div class="footer">
      <div class="icon-text" @click="onSettings">
        <BIconGearFill />
        <span>Settings</span>
      </div>
    </div>
  </div>
</template>

<script setup>

import Chat from '../models/chat'
import ChatList from './ChatList.vue'

import useEventBus from '../composables/useEventBus'
const { emitEvent } = useEventBus()

const props = defineProps({
  chat: Chat
})

const onSettings = () => {
  emitEvent('openSettings')
}

const onNewChat = () => {
  emitEvent('newChat')
}

</script>

<style scoped>
.sidebar {
  width: var(--sidebar-width);
  display: flex;
  flex-direction: column;
  height: 100vh;
  background-color: var(--sidebar-bg-color);
  border-right: 1px solid #d0cfce;
  overflow-x: hidden;
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
}

.icon-text span {
  position: relative;
  margin-left: 4px;
  top: -2px;
}


</style>
