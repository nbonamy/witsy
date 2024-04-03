<template>
  <div class="sidebar">
    <div class="toolbar">
      <div class="icon-text" @click="onNewChat">
        <BIconPencilSquare />
      </div>
    </div>
    <ChatList :chat="chat" />
    <div class="footer">
      <div class="icon-text" @click="onSetup">
        <BIconGearFill />
        <span>Setup</span>
      </div>
    </div>
    <Settings id="settings"/>
  </div>
</template>

<script setup>

import { ref } from 'vue'
import Chat from '../models/chat'
import ChatList from './ChatList.vue'
import Settings from './Settings.vue'

import useEventBus from '../composables/useEventBus'
const { emitEvent } = useEventBus()

const props = defineProps({
  chat: Chat
})

const onSetup = () => {
  document.querySelector('#settings').showModal()
}

const onNewChat = () => {
  emitEvent('newChat')
}

</script>

<style scoped>
.sidebar {
  width: 300px;
  display: flex;
  flex-direction: column;
  height: 100vh;
  background-color: #e1e0df;
  border-right: 1px solid #d0cfce;
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
