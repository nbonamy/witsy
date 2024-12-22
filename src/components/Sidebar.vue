<template>
  <div class="sidebar" :style="`width: ${sidebarWidth}px`">
    <div class="toolbar">
      <form><div class="group search">
        <input id="filter" v-model="filter" placeholder="Search…" @keyup="onFilterChange" />
        <BIconXCircleFill v-if="filter" class="clear-filter" @click="onClearFilter" />
      </div></form>
      <div id="new-chat" class="icon-text" @click="onNewChat">
        <BIconPencilSquare />
      </div>
    </div>
    <ChatList :displayMode="chatListDisplayMode" :chat="chat" :filter="filter" :select-mode="selectMode" ref="chatList" />
    <div class="footer actions" v-if="selectMode">
      <button id="cancel-delete" @click="onCancelSelect">Cancel</button>
      <button id="move" @click="onMove" v-if="chatListDisplayMode == 'folder'">Move</button>
      <button id="delete" @click="onDelete" class="destructive">Delete</button>
    </div>
    <div class="footer" v-else>
      <div class="icon-text" id="open-settings" @click="onSettings">
        <BIconGearFill />
        <span>Settings</span>
      </div>
      <div id="new-folder" class="icon-text" @click="onNewFolder" v-if="chatListDisplayMode == 'folder'">
        <BIconFolderPlus />
      </div>
      <div id="select" class="icon-text" v-if="store.history.chats.length" @click="onSelect">
        <BIconCheckSquare />
      </div>
    </div>
  </div>
  <div class="resizer" :style="`left: ${sidebarWidth-5}px`" @mousedown="onResizeSidebarStart">&nbsp;</div>
</template>

<script setup lang="ts">

import { ChatListMode } from '../types/config'
import { ref, onMounted, type Ref } from 'vue'
import { store } from '../services/store'
import { v4 as uuidv4 } from 'uuid'
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

const chatListDisplayMode: Ref<ChatListMode> = ref('timeline')
const chatList: Ref<typeof ChatList|null> = ref(null)
const sidebarWidth: Ref<number> = ref(0)
const filter: Ref<string> = ref('')
const selectMode: Ref<boolean> = ref(false)


onMounted(() => {
  sidebarWidth.value = window.api.store.get('sidebarWidth', 250)
  chatListDisplayMode.value = store.config.appearance.chatList.mode
  onEvent('chat-list-mode', setChatListMode)
})

const setChatListMode = (mode: ChatListMode) => {
  tipsManager.showTip('folderList')
  chatListDisplayMode.value = mode
  store.config.appearance.chatList.mode = mode
  store.saveSettings()
}

const onSettings = () => {
  emitEvent('open-settings', { initialTab: 'general' })
}

const onNewChat = () => {
  onClearFilter()
  onCancelSelect()
  emitEvent('new-chat', null)
}

const onFilterChange = () => {
  store.chatFilter = filter.value.trim()
}

const onClearFilter = () => {
  filter.value = ''
  store.chatFilter = null
}

const onNewFolder = async () => {
  const { value: name } = await Dialog.show({
    title: 'New Folder',
    input: 'text',
    inputValue: '',
    inputPlaceholder: 'New Folder Name',
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

const onResizeSidebarStart = () => {
  window.addEventListener('mousemove', onResizeSidebarMove)
  window.addEventListener('mouseup', onResizeSidebarEnd)
}

const onResizeSidebarMove = (event: MouseEvent) => {
  let width = Math.max(150, Math.min(400, event.clientX))
  sidebarWidth.value = width
}

const onResizeSidebarEnd = () => {
  window.removeEventListener('mousemove', onResizeSidebarMove)
  window.removeEventListener('mouseup', onResizeSidebarEnd)
  window.api.store.set('sidebarWidth', sidebarWidth.value)
}

defineExpose({
  cancelSelectMode: onCancelSelect
})

</script>

<style scoped>
@import '../../css/form.css';
</style>

<style scoped>
.sidebar {
  width: var(--sidebar-width);
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  height: 100vh;
  background-color: var(--sidebar-bg-color);
  color: var(--sidebar-text-color);
  border-right: 1px solid #d0cfce;
  overflow-x: hidden;
  position: relative;
}

.sidebar .icon-text {
  color: var(--sidebar-icon-color);
  cursor: pointer;
  display: inline-block;
  margin: 0px 8px;
}

.sidebar .icon-text:has(span) svg {
  margin-right: 4px;
}

.toolbar {
  padding: 1rem;
  padding-bottom: 0.5rem;
  text-align: right;
  -webkit-app-region: drag;
  display: flex;
  justify-content: flex-end;
}

.macos .toolbar {
  padding-left: 80px;
}

.toolbar form {
  flex: 1;
  margin-top: -12px;
  -webkit-app-region: no-drag;
}

.toolbar .search input {
  background-color: var(--sidebar-search-bg-color);
  border: 0.5px solid var(--sidebar-search-border-color);
  border-radius: 6px;
  padding-right: 24px;
}

.toolbar .clear-filter {
  position: relative;
  left: -20px;
  font-size: 9pt;
  color: var(--sidebar-search-icon-color);
}

.toolbar .icon-text {
  -webkit-app-region: no-drag;
}

.toolbar .icon-text:last-child {
  margin-right: 0px;
}

.icon-text span {
  position: relative;
  top: -2px;
}

.resizer {
  position: absolute;
  width: 6px;
  height: 100%;
  cursor: ew-resize;
  background-color: var(--sidebar-bg-color);
  z-index: 2;
}

.footer {
  padding: 16px;
  font-size: 11pt;
  display: flex;
  flex-direction: row;
}

.footer.actions {
  justify-content: flex-end;
}

.footer #open-settings {
  flex: 1;
}

</style>
