<template>
  <div class="chats" ref="divChats" :set="currDay = null">
    <div v-for="c in visibleChats" :key="c.uuid" :set="chatDay=getDay(c)">
      <div v-if="chatDay != currDay" :set="currDay = chatDay" class="day">{{ currDay }}</div> 
      <div class="chat" :class="c.uuid == chat?.uuid ? 'selected': ''" @click="onSelectChat(c)" @contextmenu.prevent="showContextMenu($event, c)" :data-day="chatDay">
        <EngineLogo :engine="engine(c)" :background="true" />
        <div class="info">
          <div class="title">{{ c.title }}</div>
          <div class="subtitle">{{ c.subtitle() }}</div>
        </div>
        <div v-if="selectMode" class="select">
          <BIconCheckCircleFill v-if="selection.includes(c.uuid)" class="selected"/>
          <BIconCircle v-else />
        </div>
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
import EngineLogo from './EngineLogo.vue'
import ContextMenu from './ContextMenu.vue'
import useEventBus from '../composables/useEventBus'
const { emitEvent } = useEventBus()

const props = defineProps({
  chat: Chat,
  filter: String,
  selectMode: Boolean,
})

const engine = (chat) => chat.engine || store.config.llm.engine

const divChats = ref(null)
const selection = ref([])

defineExpose({
  getSelection: () => selection.value,
  clearSelection: () => selection.value = [],
})

const visibleChats = computed(() => store.chats.filter((c) => {
  if (c.title.toLowerCase().includes(props.filter.toLowerCase())) return true
  if (c.messages.some(m => m.content?.toLowerCase().includes(props.filter.toLowerCase()))) return true
  return false
}).toSorted((a,b) => b.lastModified - a.lastModified))

const getDay = (chat) => {
  const now = new Date()
  const oneDay = 24 * 60 * 60 * 1000
  const diff = Date.now() - chat.lastModified
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const yesterdayStart = todayStart - 86400000;
  if (chat.lastModified >= todayStart) return 'Today'
  if (chat.lastModified >= yesterdayStart) return 'Yesterday'
  if (diff < 7 * oneDay) return 'Last 7 days'
  if (diff < 14 * oneDay) return 'Last 14 days'
  if (diff < 30 * oneDay) return 'Last 30 days'
  // if (diff < 60 * oneDay) return 'Last Month'
  // if (diff < 365 * oneDay) return 'This Year'
  return 'Earlier'
}

const showMenu = ref(false)
const menuX = ref(0)
const menuY = ref(0)
const targetRow = ref({})
const contextMenuActions = [
  { label: 'Rename Chat', action: 'rename' },
  { label: 'Delete', action: 'delete' },
]

let scrollEndTimeout = null
onMounted(() => {
  divChats.value?.addEventListener('scroll', (ev) => {
    ev.target.classList.add('scrolling')
    clearTimeout(scrollEndTimeout)
    scrollEndTimeout = setTimeout(() => {
      ev.target.classList.remove('scrolling')
    }, 500)
  })
})

const onSelectChat = (chat) => {
  if (props.selectMode) {
    if (selection.value.includes(chat.uuid)) {
      selection.value = selection.value.filter((uuid) => uuid !== chat.uuid)
    } else {
      selection.value = [...selection.value, chat.uuid]
    }
  } else {
    emitEvent('selectChat', chat)
  }
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

const handleActionClick = async (action) => {

  // init
  closeContextMenu()
  let chat = targetRow.value

  if (action === 'rename') {
    emitEvent('renameChat', chat)
  } else if (action === 'delete') {
    emitEvent('deleteChat', chat.uuid)
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

.chats .day {
  margin: 12px 0 8px;
  padding: 0 12px;
  font-size: 9pt;
  font-weight: bold;
  text-transform: uppercase;
  color: #888;
}

.chats > div:first-child > .day {
  margin-top: 0;
}

.chat {
  margin: 2px 8px;
  padding: 12px;
  display: flex;
  flex-direction: row;
  align-items: center;
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

.chat .title {
  font-weight: bold;
  font-size: 10.5pt;
}

.chat .subtitle {
  font-size: 9pt;
}

.chat .select {
  margin-left: 16px;
  text-align: right;
  flex: 1;
}

</style>
