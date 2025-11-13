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
      <div class="form search" v-if="filtering"><div class="form-field">
        <input name="filter" v-model="filter" :placeholder="t('common.search')" @keyup="onFilterChange" />
        <CircleXIcon class="clear-filter" @click="onClearFilter" v-if="filter" />
      </div></div>
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
      <ChatList :displayMode="displayMode" :chat="chat" :select-mode="selectMode" :filter="filter" ref="chatList" />
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

import { CircleXIcon, FolderIcon, FolderInputIcon, FolderPlusIcon, MessageCirclePlusIcon, MessagesSquareIcon, SearchIcon, Trash2Icon } from 'lucide-vue-next'
import { v4 as uuidv4 } from 'uuid'
import { nextTick, onMounted, ref } from 'vue'
import Dialog from '../utils/dialog'
import Chat from '../../models/chat'
import { t } from '../services/i18n'
import { store } from '../services/store'
import { ChatListMode } from 'types/config'
import ChatList from './ChatList.vue'

import useTipsManager from '../utils/tips_manager'
const tipsManager = useTipsManager(store)

import useEventBus from '../composables/event_bus'
const { emitEvent, onEvent } = useEventBus()

defineProps({
  chat: {
    type: Chat,
  },
})

const visible = ref<boolean>(true)
const width = ref<number>(0)
const manualResize = ref(true)
const displayMode = ref<ChatListMode>('timeline')
const chatList = ref<typeof ChatList|null>(null)
const selectMode = ref<boolean>(false)
const filtering = ref(false)
const filter = ref('')

const emit = defineEmits(['new-chat', 'run-agent'])

let panelOffset = 0

onMounted(async () => {
  visible.value = window.api.store.get('sidebarVisible', true)
  width.value = window.api.store.get('sidebarWidth', 400)
  onEvent('chat-list-mode', setChatListMode)

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

})

const setChatListMode = (mode: ChatListMode) => {
  tipsManager.showTip('folderList')
  displayMode.value = mode
  store.config.appearance.chatList.mode = mode
  store.saveSettings()
}

const onToggleFilter = () => {
  filter.value = ''
  store.chatState.filter = null
  filtering.value = !filtering.value
}

const onFilterChange = () => {
  store.chatState.filter = filter.value.trim()
}

const onClearFilter = () => {
  filter.value = ''
  store.chatState.filter = null
}

const onNewChat = () => {
  onCancelSelect()
  emit('new-chat')
}

const onRunAgent = () => {
  onCancelSelect()
  emit('run-agent')
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

const onSelect = () => {
  selectMode.value = true
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
    emitEvent('delete-chat', selection)
  } else {
    selectMode.value = false
  }
}

const onMove = () => {
  const selection = chatList.value!.getSelection()
  if (selection.length) {
    emitEvent('move-chat', selection)
  } else {
    selectMode.value = false
  }
}

const onResizeSidebarStart = async (event: MouseEvent) => {
  manualResize.value = true
  await nextTick()
  // Calculate offset based on where user clicked vs current width
  panelOffset = event.clientX - width.value
  window.addEventListener('mousemove', onResizeSidebarMove)
  window.addEventListener('mouseup', onResizeSidebarEnd)
}

const onResizeSidebarMove = (event: MouseEvent) => {
  width.value = Math.max(300, Math.min(500, event.clientX - panelOffset))
}

const onResizeSidebarEnd = () => {
  window.removeEventListener('mousemove', onResizeSidebarMove)
  window.removeEventListener('mouseup', onResizeSidebarEnd)
  manualResize.value = false
  saveSidebarState()
}

const saveSidebarState = () => {
  window.api.store.set('sidebarVisible', visible.value)
  window.api.store.set('sidebarWidth', width.value)
}

defineExpose({
  cancelSelectMode: onCancelSelect,
  isVisible: () => visible.value,
  hide: () => { visible.value = false; saveSidebarState() },
  show: () => { visible.value = true; saveSidebarState() },
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
        color: var(--color-error);
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
