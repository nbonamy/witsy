<template>
  <div class="chat-list">
    <div class="chats" ref="divChats">
      <ChatListTimeline v-if="displayMode == 'timeline'" :chats="visibleChats" :selection="selection" :active="chat" :selectMode="selectMode" @select="onSelectChat" @menu="showContextMenu"/>
      <ChatListFolder v-if="displayMode == 'folder'" :filtered="filter != ''" :chats="visibleChats" :selection="selection" :active="chat" :selectMode="selectMode" @select="onSelectChat" @menu="showContextMenu"/>
    </div>
    <ContextMenuPlus v-if="showMenu" @close="closeContextMenu" :mouseX="menuX" :mouseY="menuY">
      <div class="item" @click="handleActionClick('rename')">{{ t('common.rename') }}</div>
      <div v-if="displayMode === 'folder'" class="item" @click="handleActionClick('move')">{{ t('common.move') }}</div>
      <div class="item" @click="handleActionClick('delete')">{{ t('common.delete') }}</div>
    </ContextMenuPlus>
  </div>
</template>

<script setup lang="ts">

import { computed, onMounted, PropType, ref } from 'vue'
import Chat from '@models/chat'
import { t } from '@services/i18n'
import { kMediaChatId, store } from '@services/store'
import { ChatListMode } from 'types/config'
import ChatListFolder from './ChatListFolder.vue'
import ChatListTimeline from './ChatListTimeline.vue'
import ContextMenuPlus from './ContextMenuPlus.vue'
import useEventBus from '@composables/event_bus'

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

const visibleChats = computed(() => {
  const query = props.filter.trim()

  if (query.length === 0) {
    return store.history.chats
      .filter((c: Chat) => c.uuid !== kMediaChatId)
      .toSorted((a: Chat, b: Chat) => b.lastModified - a.lastModified)
  }

  // Search in titles first
  const matchingByTitle = new Set<string>()
  store.history.chats.forEach((c: Chat) => {
    if (c.uuid === kMediaChatId) return
    if (c.title?.toLowerCase().includes(query.toLowerCase())) {
      matchingByTitle.add(c.uuid)
    }
  })

  // Search in message content across all chat files
  const matchingInMessages = window.api.history.searchMessages(store.config.workspaceId, query)

  // Combine results
  const allMatchingIds = new Set([...matchingByTitle, ...matchingInMessages])

  return store.history.chats
    .filter((c: Chat) => allMatchingIds.has(c.uuid))
    .toSorted((a: Chat, b: Chat) => b.lastModified - a.lastModified)
})

const selection = ref<string[]>([])
const divChats = ref<HTMLElement|null>(null)
const showMenu = ref(false)
const menuX = ref(0)
const menuY = ref(0)
const targetRow = ref<Chat|null>(null)

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
