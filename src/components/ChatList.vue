<template>
  <div class="chat-list">
    <div class="header">
      <div class="form"><div class="form-field search">
        <input id="filter" v-model="filter" :placeholder="t('common.search')" @keyup="onFilterChange">
        </input>
        <BIconSearch class="search-icon" />
        <BIconXCircleFill v-if="filter" class="clear-filter" @click="onClearFilter" />
      </div></div>
    </div>
    <div class="display-mode button-group" v-if="store.isFeatureEnabled('chat.folders')">
      <button :class="{active: displayMode == 'timeline'}" @click="setDisplayMode('timeline')">{{ t('chatList.displayMode.timeline') }}</button>
      <button :class="{active: displayMode == 'folder'}" @click="setDisplayMode('folder')">{{ t('chatList.displayMode.folders') }}</button>
    </div>
    <div class="chats" ref="divChats">
      <ChatListTimeline v-if="displayMode == 'timeline'" :chats="visibleChats" :selection="selection" :active="chat" :selectMode="selectMode" @select="onSelectChat" @menu="showContextMenu"/>
      <ChatListFolder v-if="displayMode == 'folder'" :filtered="filter != ''" :chats="visibleChats" :selection="selection" :active="chat" :selectMode="selectMode" @select="onSelectChat" @menu="showContextMenu"/>
    </div>
    <ContextMenu v-if="showMenu" @close="closeContextMenu" :actions="contextMenuActions()" @action-clicked="handleActionClick" :x="menuX" :y="menuY" />
  </div>
</template>

<script setup lang="ts">

import { ChatListMode } from '../types/config'
import { ref, computed, onMounted, PropType } from 'vue'
import { store, kMediaChatId } from '../services/store'
import { t } from '../services/i18n'
import ContextMenu from './ContextMenu.vue'
import ChatListTimeline from './ChatListTimeline.vue'
import ChatListFolder from './ChatListFolder.vue'
import Chat from '../models/chat'

import useEventBus from '../composables/event_bus'
import { BIconSearch } from 'bootstrap-icons-vue'
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
  }
})

defineExpose({
  getSelection: () => selection.value,
  clearSelection: () => { selection.value = [] },
})

const visibleChats = computed(() => store.history.chats.filter((c: Chat) => {
  if (c.uuid === kMediaChatId) return false
  if (filter.value.trim().length === 0) return true
  if (c.title?.toLowerCase().includes(filter.value.trim().toLowerCase())) return true
  if (c.messages.some(m => m.content?.toLowerCase().includes(filter.value.trim().toLowerCase()))) return true
  return false
}).toSorted((a: Chat, b: Chat) => b.lastModified - a.lastModified))

const selection = ref<string[]>([])
const divChats = ref<HTMLElement|null>(null)
const showMenu = ref(false)
const menuX = ref(0)
const menuY = ref(0)
const targetRow = ref<Chat|null>(null)
const filter = ref('')

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

const onFilterChange = () => {
  store.chatState.filter = filter.value.trim()
}

const onClearFilter = () => {
  filter.value = ''
  store.chatState.filter = null
}

</script>

<style scoped>

.chat-list {

  padding: 1rem;
  padding-top: 0rem;
  display: flex;
  flex-direction: column;
  overflow-y: auto;

  .header {
    margin-bottom: 1rem;
    display: flex;
    justify-content: center;
    align-items: center;

    .form {
      flex: 1;

      input {
        padding: 1rem;
        font-size: 11pt;
        padding-left: 3rem;
      }

      .search-icon {
        position: absolute;
        left: 2.5rem;
        width: 1.25rem;
        height: 1.25rem;
      }

      .clear-filter {
        position: relative;
        cursor: pointer;
        left: -2rem;
        width: 1.25rem;
        height: 1.25rem;
        opacity: 0.5;
      }

    }
  }

  .display-mode {
    margin-bottom: 2rem;
    align-self: center;
    button {
      padding: 0.5rem 1rem;
    }
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

}

</style>
