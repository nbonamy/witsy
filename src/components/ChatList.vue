<template>
  <div class="chats" ref="divChats">
    <div v-for="c in chatsReversed" :key="c.uuid" class="chat" :class="c.uuid == chat.uuid ? 'selected': ''" @click="onSelectChat(c)" @contextmenu.prevent="showContextMenu($event, c)">
      <img :src="'/assets/'+engine(c)+'.svg'" class="logo" :class="engine(c)" />
      <div class="info">
        <div class="title">{{ c.title }}</div>
        <div class="subtitle">{{ c.subtitle() }}</div>
      </div>
    </div>
    <Overlay v-if="showMenu" @click="closeContextMenu" />
    <ContextMenu v-if="showMenu" :actions="contextMenuActions" @action-clicked="handleActionClick" :x="menuX" :y="menuY" />
    </div>
</template>

<script setup>

import { ref, computed, onMounted } from 'vue'
import { store } from '../services/store'
import Chat from '../models/chat'
import Overlay from './Overlay.vue'
import ContextMenu from './ContextMenu.vue'
import useEventBus from '../composables/useEventBus'
const { emitEvent } = useEventBus()

const props = defineProps({
  chat: Chat
})

const engine = (chat) => chat.engine || store.config.llm.engine

const divChats = ref(null)
const chatsReversed = computed(() => store.chats.toSorted((a,b) => b.lastModified - a.lastModified))

const showMenu = ref(false)
const menuX = ref(0)
const menuY = ref(0)
const targetRow = ref({})
const contextMenuActions = [
  { label: 'Delete', action: 'delete' },
]

let scrollEndTimeout = null
onMounted(() => {
  divChats.value.addEventListener('scroll', (ev) => {
    ev.target.classList.add('scrolling')
    clearTimeout(scrollEndTimeout)
    scrollEndTimeout = setTimeout(() => {
      ev.target.classList.remove('scrolling')
    }, 500)
  })
})

const onSelectChat = (chat) => {
  emitEvent('selectChat', chat)
}

const showContextMenu = (event, user) => {
  showMenu.value = true
  targetRow.value = user
  menuX.value = event.clientX
  menuY.value = event.clientY
}

const closeContextMenu = () => {
  showMenu.value = false;
}

const handleActionClick = (action) => {
  closeContextMenu()
  if (action === 'delete') {

    // fist remove
    let index = store.chats.indexOf(targetRow.value)
    store.chats[index].delete()
    store.chats.splice(index, 1)
    store.save()

    // if current chat
    if (props.chat.uuid === targetRow.value.uuid) {
      emitEvent('newChat')
    }
  }
}

</script>

<style scoped>

.chats {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow-y: auto;
  width: 100%;
  padding-right: 20px;
  scrollbar-color: #888 var(--sidebar-bg-color);
}

.chats.scrolling {
  padding-right: 0px;
}

.chat {
  margin: 4px 8px;
  padding: 12px;
  display: flex;
  flex-direction: row;
  border-radius: 8px;
}

.chat.selected {
  background-color: var(--sidebar-selected-color);
}

.chat .info {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.chat .info * {
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.chat .logo {
  width: var(--sidebar-logo-size);
  height: var(--sidebar-logo-size);
  margin-right: 8px;
}

.chat .logo.openai {
  background-color: #865563;
  border-radius: 4px;
  filter: invert(1);
  padding: 4px;
}

.chat .logo.ollama {
  object-fit: cover;
  background-color: white;
  border-radius: 4px;
  padding: 4px;
}

.chat .title {
  font-weight: bold;
  font-size: 10.5pt;
}

.chat .subtitle {
  font-size: 9pt;
}

</style>
