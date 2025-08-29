<template>
  <div class="chat-list">
    <div class="chats" ref="divChats">
      <ChatListTimeline v-if="displayMode == 'timeline'" :chats="visibleChats" :selection="selection" :active="chat" :selectMode="selectMode" @select="onSelectChat" @menu="showContextMenu"/>
      <ChatListFolder v-if="displayMode == 'folder'" :filtered="filter != ''" :chats="visibleChats" :selection="selection" :active="chat" :selectMode="selectMode" @select="onSelectChat" @menu="showContextMenu"/>
    </div>
    <ContextMenu v-if="showMenu" @close="closeContextMenu" :actions="contextMenuActions()" @action-clicked="handleActionClick" :x="menuX" :y="menuY" />
  </div>
</template>

<script setup lang="ts">

import { computed, onMounted, PropType, ref } from 'vue'
import Chat from '../models/chat'
import { t } from '../services/i18n'
import { kMediaChatId, store } from '../services/store'
import { ChatListMode } from '../types/config'
import ChatListFolder from './ChatListFolder.vue'
import ChatListTimeline from './ChatListTimeline.vue'
import ContextMenu from './ContextMenu.vue'

import useEventBus from '../composables/event_bus'
import { filter } from 'minimatch'
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
  selectMode: {
    type: Boolean,
    default: false,
  },
  filter: {
    type: String,
    default: '',
  },
})

defineExpose({
  getSelection: () => selection.value,
  clearSelection: () => { selection.value = [] },
  selectAll: () => { selection.value = visibleChats.value.map(chat => chat.uuid) },
  unselectAll: () => { selection.value = [] },
})

const visibleChats = computed(() => store.history.chats.filter((c: Chat) => {
  if (c.uuid === kMediaChatId) return false
  if (props.filter.trim().length === 0) return true
  if (c.title?.toLowerCase().includes(props.filter.trim().toLowerCase())) return true
  if (c.messages.some(m => m.content?.toLowerCase().includes(props.filter.trim().toLowerCase()))) return true
  return false
}).toSorted((a: Chat, b: Chat) => b.lastModified - a.lastModified))

const selection = ref<string[]>([])
const divChats = ref<HTMLElement|null>(null)
const showMenu = ref(false)
const menuX = ref(0)
const menuY = ref(0)
const targetRow = ref<Chat|null>(null)

const contextMenuActions = () => [
  { label: t('common.rename'), action: 'rename' },
  ...(props.displayMode === 'folder' ? [ { label: t('common.move'), action: 'move' } ] : []),
  { label: t('common.delete'), action: 'delete' },
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

.chat-list {

  padding: 1rem;
  padding-top: 0rem;
  display: flex;
  flex-direction: column;
  overflow-y: auto;

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

}

</style>
