<template>
  <div class="sp-sidebar chat-sidebar" :class="{ 'manual-resize': manualResize }" :style="`flex-basis: ${visible ? width : 0}px`">
    <header>
      <div class="form"><div class="form-field search">
        <input id="filter" v-model="filter" :placeholder="t('common.search')" @keyup="onFilterChange" />
        <BIconXCircleFill v-if="filter" class="clear-filter" @click="onClearFilter" />
      </div></div>
      <div class="icon run-agent" v-tooltip="{ text: t('common.runAgent'), position: 'bottom-left' }" @click="onRunAgent" v-if="store.config.features?.agents">
        <IconRunAgent class="scale120"  />
      </div>
      <div class="icon new-chat" v-tooltip="{ text: t('common.newChat'), position: 'bottom-left' }" @click="onNewChat" >
        <IconNewChat />
      </div>
    </header>
    <main>
      <ChatList :displayMode="chatListDisplayMode" :chat="chat" :filter="filter" :select-mode="selectMode" ref="chatList" />
    </main>
    <footer class="actions" v-if="selectMode">
      <button id="cancel-delete" @click="onCancelSelect">{{ t('common.cancel') }}</button>
      <button id="move" @click="onMove" v-if="chatListDisplayMode == 'folder'">{{ t('common.move') }}</button>
      <button id="delete" @click="onDelete" class="destructive">{{ t('common.delete') }}</button>
    </footer>
    <footer v-else>
      <div id="new-folder" class="icon" @click="onNewFolder" v-if="chatListDisplayMode == 'folder'">
        <BIconFolderPlus />
      </div>
      <div id="select" class="icon" v-if="store.history.chats.length" @click="onSelect">
        <BIconCheck2Square />
      </div>
    </footer>
    <div class="resizer" :style="`left: ${width-5}px`" @mousedown="onResizeSidebarStart" v-if="visible">&nbsp;</div>
  </div>
</template>

<script setup lang="ts">

import { ChatListMode } from '../types/config'
import { ref, onMounted, nextTick } from 'vue'
import { store } from '../services/store'
import { t } from '../services/i18n'
import { v4 as uuidv4 } from 'uuid'
import IconNewChat from './IconNewChat.vue'
import IconRunAgent from '../../assets/robot_run.svg?component'
import Dialog from '../composables/dialog'
import ChatList from './ChatList.vue'
import Chat from '../models/chat'

import useTipsManager from '../composables/tips_manager'
const tipsManager = useTipsManager(store)

import useEventBus from '../composables/event_bus'
const { emitEvent, onEvent } = useEventBus()

defineProps({
  chat: {
    type: Chat,
  },
})

const visible= ref<boolean>(true)
const width= ref<number>(0)
const manualResize = ref(true)
const chatListDisplayMode= ref<ChatListMode>('timeline')
const chatList= ref<typeof ChatList|null>(null)
const filter= ref<string>('')
const selectMode= ref<boolean>(false)

const emit = defineEmits(['new-chat', 'run-agent'])

let panelOffet = 0

onMounted(async () => {
  visible.value = window.api.store.get('sidebarVisible', true)
  width.value = window.api.store.get('sidebarWidth', 250)
  chatListDisplayMode.value = store.config.appearance.chatList.mode
  onEvent('chat-list-mode', setChatListMode)

  const sidebar = document.querySelector('.chat-sidebar') as HTMLElement
  const rect = sidebar?.getBoundingClientRect()
  panelOffet = rect?.left || 0

  // we don't want animations when mounting
  // so init manualResize to true
  // and set it to false after the first render
  await nextTick()
  manualResize.value = false

})

const setChatListMode = (mode: ChatListMode) => {
  tipsManager.showTip('folderList')
  chatListDisplayMode.value = mode
  store.config.appearance.chatList.mode = mode
  store.saveSettings()
}

const onNewChat = () => {
  onClearFilter()
  onCancelSelect()
  emit('new-chat')
}

const onRunAgent = () => {
  onClearFilter()
  onCancelSelect()
  emit('run-agent')
}

const onFilterChange = () => {
  store.chatState.filter = filter.value.trim()
}

const onClearFilter = () => {
  filter.value = ''
  store.chatState.filter = null
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

const onResizeSidebarStart = async () => {
  manualResize.value = true
  await nextTick()
  window.addEventListener('mousemove', onResizeSidebarMove)
  window.addEventListener('mouseup', onResizeSidebarEnd)
}

const onResizeSidebarMove = (event: MouseEvent) => {
  width.value = Math.max(200, Math.min(400, event.clientX - panelOffet))
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

    /* resizing animation except when dragging */
    transition: flex-basis 0.15s ease-in-out;
    &.manual-resize {
      transition: none;
    }

    header {
      
      .form {
        .search input {
          background-color: var(--sidebar-search-bg-color);
          border: 0.5px solid var(--sidebar-search-border-color);
          border-radius: 6px;
          padding: 5px 24px 5px 8px;
        }
        .clear-filter {
          position: relative;
          cursor: pointer;
          left: -20px;
          font-size: 9pt;
          color: var(--sidebar-search-icon-color);
        }
      }

      .icon {
        color: var(--chatarea-toolbar-icon-color);
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
