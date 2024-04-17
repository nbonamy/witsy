
<template>
  <div class="content" :class="{ standalone: standalone }">
    <div class="toolbar">
      <div class="title">{{ chat?.title }}</div>
      <div class="menu" @click="onMenu" v-if="chat"></div>
    </div>
    <MessageList :chat="chat" v-if="chat?.messages.length > 1"/>
    <EmptyChat v-else />
    <Prompt :chat="chat" class="prompt" />
    <Overlay v-if="showChatMenu" @click="closeChatMenu" />
    <ContextMenu v-if="showChatMenu" :actions="chatMenuActions" @action-clicked="handleActionClick" :x="menuX" :y="menuY" :align="chatMenuAlign"/>
  </div>
</template>

<script setup>

import { ref, computed } from 'vue'
import { store } from '../services/store'
import ContextMenu from './ContextMenu.vue'
import Overlay from './Overlay.vue'
import Chat from '../models/chat'
import MessageList from './MessageList.vue'
import Prompt from './Prompt.vue'
import useEventBus from '../composables/useEventBus'
import EmptyChat from './EmptyChat.vue'
const { emitEvent } = useEventBus()

const props = defineProps({
  chat: Chat,
  standalone: Boolean,
})

const chatMenuAlign = computed(() => {
  return window.platform == 'windows' ? 'left' : 'right'
})

const chatMenuActions = computed(() => {
  return [
    props.chat.engine ? { label: `${props.chat.engine} ${props.chat.model}`, disabled: true } : null,
    props.standalone ? { label: 'Save', action: 'save', disabled: saved.value } : null,
    { label: 'Rename Chat', action: 'rename' },
    { label: 'Delete', action: 'delete', disabled: props.standalone && !saved.value },
  ].filter((a) => a != null)
})

const showChatMenu = ref(false)
const menuX = ref(0)
const menuY = ref(0)
const saved = ref(false)

const onMenu = () => {
  showChatMenu.value = true
  menuX.value = 16 + (chatMenuAlign.value == 'left' ? document.querySelector('.sidebar').offsetWidth : 0) 
  menuY.value = 32
}

const closeChatMenu = () => {
  showChatMenu.value = false
}

const handleActionClick = async (action) => {
  closeChatMenu()
  if (action === 'rename') {
    emitEvent('renameChat', props.chat)
  } else if (action === 'delete') {
    emitEvent('deleteChat', props.chat)
  } else if (action == 'save') {
    onSave()
  }
}

const onSave = () => {
  if (saved.value) return
  store.chats.push(props.chat)
  store.saveHistory()
  saved.value = true
}

</script>

<style scoped>

.content {
  display: flex;
  flex-direction: column;
  height: 100vh;
  width: 100%;
}

.toolbar {
  padding: 15px 16px 24px;
  -webkit-app-region: drag;
  display: grid;
  grid-template-columns: auto 16px;
}

.toolbar .title {
  grid-column: 1;
  font-weight: bold;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.toolbar .menu {
  -webkit-app-region: no-drag;
  grid-column: 2;
  cursor: pointer;
  text-align: right;
  width: 16px;
  height: 16px;
  background-image: url('data:image/svg+xml;base64,PD94bWwgdmVyc2lvbj0iMS4wIiA/PjwhRE9DVFlQRSBzdmcgIFBVQkxJQyAnLS8vVzNDLy9EVEQgU1ZHIDEuMS8vRU4nICAnaHR0cDovL3d3dy53My5vcmcvR3JhcGhpY3MvU1ZHLzEuMS9EVEQvc3ZnMTEuZHRkJz48c3ZnIGhlaWdodD0iMzJweCIgaWQ9IkxheWVyXzEiIHN0eWxlPSJlbmFibGUtYmFja2dyb3VuZDpuZXcgMCAwIDMyIDMyOyIgdmVyc2lvbj0iMS4xIiB2aWV3Qm94PSIwIDAgMzIgMzIiIHdpZHRoPSIzMnB4IiB4bWw6c3BhY2U9InByZXNlcnZlIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHhtbG5zOnhsaW5rPSJodHRwOi8vd3d3LnczLm9yZy8xOTk5L3hsaW5rIj48cGF0aCBkPSJNNCwxMGgyNGMxLjEwNCwwLDItMC44OTYsMi0ycy0wLjg5Ni0yLTItMkg0QzIuODk2LDYsMiw2Ljg5NiwyLDhTMi44OTYsMTAsNCwxMHogTTI4LDE0SDRjLTEuMTA0LDAtMiwwLjg5Ni0yLDIgIHMwLjg5NiwyLDIsMmgyNGMxLjEwNCwwLDItMC44OTYsMi0yUzI5LjEwNCwxNCwyOCwxNHogTTI4LDIySDRjLTEuMTA0LDAtMiwwLjg5Ni0yLDJzMC44OTYsMiwyLDJoMjRjMS4xMDQsMCwyLTAuODk2LDItMiAgUzI5LjEwNCwyMiwyOCwyMnoiLz48L3N2Zz4=');
  background-position: 0px -1px;
  background-size: 16px;
}

.windows .toolbar {
  grid-template-columns: 16px auto;
}

.windows .toolbar .title {
  margin-left: 8px;
  grid-column: 2;
  order: 2;
}

.windows .toolbar .menu {
  margin-top: 4px;
  grid-column: 1;
  order: 1;
}

.macos .content.standalone .toolbar {
  padding-left: 80px;
}

</style>
