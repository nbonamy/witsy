<template>
  <div class="header">
    <div class="button-group">
      <button :class="{active: displayMode == 'timeline'}" @click="setDisplayMode('timeline')">Timeline</button>
      <button :class="{active: displayMode == 'folder'}" @click="setDisplayMode('folder')">Folders</button>
    </div>
  </div>
  <div class="chats" ref="divChats">
    <ChatListTimeline v-if="displayMode == 'timeline'" :chats="visibleChats" :selection="selection" :active="chat" :selectMode="selectMode" @select="onSelectChat" @menu="showContextMenu"/>
    <ChatListFolder v-if="displayMode == 'folder'" :filtered="filter != ''" :chats="visibleChats" :selection="selection" :active="chat" :selectMode="selectMode" @select="onSelectChat" @menu="showContextMenu"/>
  </div>
  <ContextMenu v-if="showMenu" :on-close="closeContextMenu" :actions="contextMenuActions()" @action-clicked="handleActionClick" :x="menuX" :y="menuY" />
</template>

<script setup lang="ts">

import { ChatListMode } from '../types/config'
import { type Ref, ref, computed, onMounted, PropType } from 'vue'
import { store } from '../services/store'
import ContextMenu from './ContextMenu.vue'
import ChatListTimeline from './ChatListTimeline.vue'
import ChatListFolder from './ChatListFolder.vue'
import Chat from '../models/chat'

import useEventBus from '../composables/event_bus'
const { emitEvent } = useEventBus()

const props = defineProps({
  displayMode: {
    type: String as PropType<ChatListMode>,
    required: true,
  },
  chat: {
    type: Chat,
    default: null,
    // required: true,
  },
  filter: {
    type: String,
    default: '',
  },
  selectMode: {
    type: Boolean,
    default: false,
  }
})

const selection: Ref<string[]> = ref([])
const divChats: Ref<HTMLElement|null> = ref(null)

defineExpose({
  getSelection: () => selection.value,
  clearSelection: () => { selection.value = [] },
})

const visibleChats = computed(() => store.history.chats.filter((c: Chat) => {
  if (props.filter === null || props.filter.length === 0) return true
  if (c.title?.toLowerCase().includes(props.filter.toLowerCase())) return true
  if (c.messages.some(m => m.content?.toLowerCase().includes(props.filter.toLowerCase()))) return true
  return false
}).toSorted((a: Chat, b: Chat) => b.lastModified - a.lastModified))

const showMenu = ref(false)
const menuX = ref(0)
const menuY = ref(0)
const targetRow: Ref<Chat|null> = ref(null)

const contextMenuActions = () => [
  { label: 'Rename', action: 'rename' },
  ...(props.displayMode === 'folder' ? [ { label: 'Move', action: 'move' } ] : []),
  { label: 'Delete', action: 'delete' },
]

let scrollEndTimeout: NodeJS.Timeout|null = null
onMounted(() => {
  divChats.value?.addEventListener('scroll', (ev: Event) => {
    const target = ev.target as HTMLElement
    target.classList.add('scrolling')
    clearTimeout(scrollEndTimeout!)
    scrollEndTimeout = setTimeout(() => {
      target.classList.remove('scrolling')
    }, 500)
  })
})

const setDisplayMode = (mode: ChatListMode) => {
  emitEvent('chat-list-mode', mode)
}

const onSelectChat = (chat: Chat) => {
  if (props.selectMode) {
    if (selection.value.includes(chat.uuid)) {
      selection.value = selection.value.filter((uuid) => uuid !== chat.uuid)
    } else {
      selection.value = [...selection.value, chat.uuid]
    }
  } else {
    emitEvent('select-chat', chat)
  }
}

const showContextMenu = (event: MouseEvent, chat: Chat) => {
  showMenu.value = true
  targetRow.value = chat
  menuX.value = event.clientX
  menuY.value = event.clientY
}

const closeContextMenu = () => {
  showMenu.value = false;
}

const handleActionClick = async (action: string) => {

  // close
  closeContextMenu()

  // init
  let chat = targetRow.value
  if (!chat) return

  // process
  if (action === 'rename') {
    emitEvent('rename-chat', chat)
  } else if (action === 'move') {
    emitEvent('move-chat', chat.uuid)
  } else if (action === 'delete') {
    emitEvent('delete-chat', chat.uuid)
  }

}

</script>

<style scoped>

.header {
  margin-bottom: 1rem;
  display: flex;
  justify-content: center;
  align-items: center;
}

.chats {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow-y: auto;
  width: calc(100% - 3px);
  padding-right: 0px;
  scrollbar-color: var(--sidebar-scroll-thumb-color) var(--sidebar-bg-color);
}

.chats.scrolling {
  padding-right: 0px;
}

</style>
