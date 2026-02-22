<template>
  <div class="sp-sidebar chat-sidebar" :class="{ 'manual-resize': manualResize }" :style="`flex-basis: ${width}px; display: ${visible ? 'inherit' : 'none'}`">
    <header>
      <!-- <div class="icon run-agent" v-tooltip="{ text: t('common.runAgent'), position: 'bottom-left' }" @click="onRunAgent">
        <IconRunAgent />
      </div>
      <div class="icon new-chat" v-tooltip="{ text: t('common.newChat'), position: 'bottom-left' }" @click="onNewChat" >
        <IconNewChat />
      </div> -->
      <div class="title">{{ t('chatList.title') }}</div>
    </header>
    <div class="chat-list-tools">
      <div class="form search" v-if="filtering">
        <div class="form-field">
          <input ref="inputFilter" name="filter" v-model="filter" :placeholder="t('common.search')" @keyup="onFilterChange" @keydown.enter.prevent="onFilterNavigate" @keydown.escape.prevent="onToggleFilter" />
          <CircleXIcon class="clear-filter" @click="onClearFilter" v-if="filtering" />
        </div>
      </div>
      <div class="display-mode button-group" v-if="!filtering && store.isFeatureEnabled('chat.folders')">
        <button name="timeline" :class="{active: displayMode == 'timeline'}" @click="displayMode = 'timeline'">
          <MessagesSquareIcon />
          {{ t('chatList.displayMode.timeline') }}
        </button>
        <button name="folders" :class="{active: displayMode == 'folder'}" @click="displayMode = 'folder'">
          <FolderIcon />
          {{ t('chatList.displayMode.folders') }}
        </button>
      </div>
      <div class="toolbar">
        <button name="select" @click="selectMode = !selectMode">{{ selectMode ? t('common.done') : t('common.select') }}</button>
        <button name="create-folder" @click="onNewFolder" v-if="displayMode === 'folder'"><FolderPlusIcon /> {{ t('sidebar.newFolder.title') }}</button>
        <div class="flex-push"></div>
        <!-- <button name="sort" :disabled="selectMode">{{ t('common.sortBy') }} <ChevronDownIcon /></button> -->
        <button name="search" :disabled="selectMode" @click="onToggleFilter"><SearchIcon /></button>
      </div>
    </div>
    <main>
      <ChatList :displayMode="displayMode" :chat="chat" :select-mode="selectMode" :filter="filter" :generating-chat-ids="generatingChatIds" ref="chatList" />
    </main>
    <footer v-if="!selectMode">
      <!-- <button class="run-agent cta" @click="onRunAgent"><MessageCircleMoreIcon /> {{ t('common.runAgent') }}</button> -->
      <button class="new-chat cta" @click="onNewChat"><MessageCirclePlusIcon /> {{ t('common.newChat') }}</button>
    </footer>
    <footer v-else class="select-actions">
      <button name="select-all" @click="onSelectAll">{{ t('common.selectAllShort') }}</button>
      <button name="unselect-all" @click="onUnselectAll">{{ t('common.unselectAllShort') }}</button>
      <div class="flex-push"/>
      <button name="move" @click="onMove" v-if="displayMode === 'folder'"><FolderInputIcon /> {{ t('common.move') }}</button>
      <button name="delete" @click="onDelete"><Trash2Icon /></button>
    </footer>
    <div class="resizer" :style="`left: ${width-5}px`" @mousedown="onResizeSidebarStart" v-if="visible">&nbsp;</div>
  </div>
</template>

<script setup lang="ts">

import useEventListener from '@composables/event_listener'
import useIpcListener from '@composables/ipc_listener'
import Chat from '@models/chat'
import Dialog from '@renderer/utils/dialog'
import type { ChatCallbacks, SearchState } from '@screens/Chat.vue'
import { t } from '@services/i18n'
import { store } from '@services/store'
import { CircleXIcon, FolderIcon, FolderInputIcon, FolderPlusIcon, MessageCirclePlusIcon, MessagesSquareIcon, SearchIcon, Trash2Icon } from 'lucide-vue-next'
import { ChatListMode } from 'types/config'
import { v4 as uuidv4 } from 'uuid'
import { inject, nextTick, onMounted, ref, watch } from 'vue'
import ChatList from './ChatList.vue'

const { onIpcEvent } = useIpcListener()
const { onDomEvent, offDomEvent } = useEventListener()
const chatCallbacks = inject<ChatCallbacks>('chat-callbacks')
const searchState = inject<SearchState>('searchState')

defineProps({
  chat: {
    type: Chat,
  },
  generatingChatIds: {
    type: Array as () => string[],
    default: (): string[] => [],
  },
})

const visible = ref<boolean>(true)
const width = ref<number>(0)
const manualResize = ref(true)
const displayMode = ref<ChatListMode>('timeline')
const chatList = ref<typeof ChatList|null>(null)
const selectMode = ref<boolean>(false)
const inputFilter = ref<HTMLInputElement|null>(null)
const filtering = ref(false)
const filter = ref('')


let panelOffset = 0

onMounted(async () => {
  visible.value = window.api.store.get('sidebarVisible', true)
  width.value = window.api.store.get('sidebarWidth', 400)

  // depends on feature activation
  if (store.isFeatureEnabled('chat.folders')) {
    displayMode.value = store.config.appearance.chatList.mode
  } else {
    displayMode.value = 'timeline'
  }

  const sidebar = document.querySelector('.chat-sidebar') as HTMLElement
  const rect = sidebar?.getBoundingClientRect()
  panelOffset = rect?.left || 0

  // we don't want animations when mounting
  // so init manualResize to true
  // and set it to false after the first render
  await nextTick()
  manualResize.value = false

  // search
  onIpcEvent('search-chats', () => {
    onToggleFilter()
  })

})

if (searchState) {
  watch(searchState.filter, (value) => {
    if (value === null && filtering.value) {
      filter.value = ''
      filtering.value = false
    }
  })
}

const onToggleFilter = async () => {
  if (!searchState) return
  filter.value = ''
  searchState.filter.value = null
  filtering.value = !filtering.value
  await nextTick()
  if (filtering.value && inputFilter.value) {
    inputFilter.value.focus()
  }
}

const onFilterChange = () => {
  if (!searchState) return
  searchState.localSearch.value = false
  searchState.filter.value = filter.value.trim()
}

const onFilterNavigate = (event: KeyboardEvent) => {
  if (!searchState) return
  searchState.navigate.value = event.shiftKey ? -1 : 1
}

const onClearFilter = () => {
  if (!searchState) return
  if (filter.value === '') {
    searchState.filter.value = null
    filtering.value = false
  } else {
    filter.value = ''
    searchState.filter.value = ''
  }
}

const onNewChat = () => {
  onCancelSelect()
  chatCallbacks?.onNewChat()
}

const onNewFolder = async () => {
  const { value: name } = await Dialog.show({
    title: t('sidebar.newFolder.title'),
    input: 'text',
    inputValue: '',
    inputPlaceholder: t('sidebar.newFolder.placeholder'),
    showCancelButton: true,
  });
  if (name) {
    store.history.folders.push({ id: uuidv4(), name, chats: [] })
    store.saveHistory()
  }
}

const onSelectAll = () => {
  selectMode.value = true
  chatList.value!.selectAll()
}

const onUnselectAll = () => {
  selectMode.value = true
  chatList.value!.unselectAll()
}

const onCancelSelect = () => {
  selectMode.value = false
  chatList.value!.clearSelection()
}

const onDelete = () => {
  const selection = chatList.value!.getSelection()
  if (selection.length) {
    chatCallbacks?.onDeleteChat(selection)
  } else {
    selectMode.value = false
  }
}

const onMove = () => {
  const selection = chatList.value!.getSelection()
  if (selection.length) {
    chatCallbacks?.onMoveChat(selection)
  } else {
    selectMode.value = false
  }
}

const onResizeSidebarStart = async (event: MouseEvent) => {
  manualResize.value = true
  await nextTick()
  // Calculate offset based on where user clicked vs current width
  panelOffset = event.clientX - width.value
  onDomEvent(window, 'mousemove', onResizeSidebarMove)
  onDomEvent(window, 'mouseup', onResizeSidebarEnd)
}

const onResizeSidebarMove = (event: Event) => {
  const mouseEvent = event as MouseEvent
  width.value = Math.max(300, Math.min(500, mouseEvent.clientX - panelOffset))
}

const onResizeSidebarEnd = () => {
  offDomEvent(window, 'mousemove', onResizeSidebarMove)
  offDomEvent(window, 'mouseup', onResizeSidebarEnd)
  manualResize.value = false
  saveSidebarState()
}

const saveSidebarState = () => {
  window.api.store.set('sidebarVisible', visible.value)
  window.api.store.set('sidebarWidth', width.value)
}

const startFilter = async () => {
  filtering.value = true
  await nextTick()
  inputFilter.value?.focus()
}

const clearFilter = () => {
  filter.value = ''
  if (searchState) searchState.filter.value = null
  filtering.value = false
}

defineExpose({
  cancelSelectMode: onCancelSelect,
  isVisible: () => visible.value,
  hide: () => { visible.value = false; saveSidebarState() },
  show: () => { visible.value = true; saveSidebarState() },
  startFilter,
  clearFilter,
})

</script>


<style scoped>

.split-pane {
  
  .sp-sidebar {
    
    flex: 0 0 0px;
    position: relative;
    overflow: hidden;

    /* resizing animation except when dragging */
    transition: flex-basis 0.15s ease-in-out;
    &.manual-resize {
      transition: none;
    }

    .chat-list-tools {

      padding: 0rem 1rem;
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      gap: 1rem;

      .search {
      
        width: 100%;

        .form-field {
          margin: 0;
          position: relative;

          input {
            padding: 0.625rem 0.75rem;
            font-size: 14px;
          }

          .search-icon {
            position: absolute;
            right: 1rem;
            width: var(--icon-lg);
            height: var(--icon-lg);
            opacity: 0.5;
          }

          .clear-filter {
            position: absolute;
            cursor: pointer;
            right: 1em;
            width: var(--icon-lg);
            height: var(--icon-lg);
            opacity: 0.5;
          }

        }

      }

      .display-mode {
        width: 100%;
        align-self: center;
        display: flex;
        justify-content: space-between;


        button {
          flex: 1;
          padding: 0.5rem 1rem;
        }

      }

      .toolbar {
        width: 100%;
        display: flex;
        align-items: center;
        justify-content: flex-start;

        button {

          padding: 0.5rem;
          font-weight: 500;
          gap: 0.25rem;

          &[name=sort] svg {
            fill: var(--text-color);
          }

          &:first-child {
            margin-left: 0;
          }

          &:last-child {
            margin-right: 0;
          }
        }
      }
    }

    footer {
      flex-direction: row;
      align-items: center;

      &.select-actions {
        margin: 0rem 1rem;
        border: 1px solid var(--border-color);
        border-radius: 6px;
        padding: 10px 12px;
      }

      button[name=delete] svg {
        stroke: var(--color-error);
      }

    }

    .resizer {
      position: absolute;
      width: 8px;
      height: 100%;
      cursor: ew-resize;
      background-color: transparent;
      z-index: 2;
    }
  }

}

</style>
