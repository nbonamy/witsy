<template>
  <div class="sidebar" :class="{ 'manual-resize': manualResize }" :style="`flex-basis: ${visible ? width : 0}px`">
    <div class="toolbar">
      <form><div class="group search">
        <input id="filter" v-model="filter" :placeholder="t('common.search')" @keyup="onFilterChange" />
        <BIconXCircleFill v-if="filter" class="clear-filter" @click="onClearFilter" />
      </div></form>
      <div id="new-chat" class="icon-text" @click="onNewChat">
        <BIconPencilSquare />
      </div>
    </div>
    <ChatList :displayMode="chatListDisplayMode" :chat="chat" :filter="filter" :select-mode="selectMode" ref="chatList" />
    <div class="footer actions" v-if="selectMode">
      <button id="cancel-delete" @click="onCancelSelect">{{ t('common.cancel') }}</button>
      <button id="move" @click="onMove" v-if="chatListDisplayMode == 'folder'">{{ t('common.move') }}</button>
      <button id="delete" @click="onDelete" class="destructive">{{ t('common.delete') }}</button>
    </div>
    <div class="footer" v-else>
      <div class="icon-text" id="open-settings" @click="onSettings">
        <BIconGearFill />
        <span>{{ t('common.settings') }}</span>
      </div>
      <div id="new-folder" class="icon-text" @click="onNewFolder" v-if="chatListDisplayMode == 'folder'">
        <BIconFolderPlus />
      </div>
      <div id="select" class="icon-text" v-if="store.history.chats.length" @click="onSelect">
        <BIconCheck2Square />
      </div>
    </div>
  </div>
  <div class="resizer" :style="`left: ${width-5}px`" @mousedown="onResizeSidebarStart" v-if="visible">&nbsp;</div>
</template>

<script setup lang="ts">

import { ChatListMode } from '../types/config'
import { ref, onMounted, Ref } from 'vue'
import { store } from '../services/store'
import { t } from '../services/i18n'
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

const visible: Ref<boolean> = ref(true)
const width: Ref<number> = ref(0)
const manualResize = ref(false)
const chatListDisplayMode: Ref<ChatListMode> = ref('timeline')
const chatList: Ref<typeof ChatList|null> = ref(null)
const filter: Ref<string> = ref('')
const selectMode: Ref<boolean> = ref(false)

onMounted(() => {
  visible.value = window.api.store.get('sidebarVisible', true)
  width.value = window.api.store.get('sidebarWidth', 250)
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
  window.api.settings.open({ initialTab: 'general' })
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

const onResizeSidebarStart = () => {
  window.addEventListener('mousemove', onResizeSidebarMove)
  window.addEventListener('mouseup', onResizeSidebarEnd)
  manualResize.value = true
}

const onResizeSidebarMove = (event: MouseEvent) => {
  width.value = Math.max(150, Math.min(400, event.clientX))
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
@import '../../css/form.css';
</style>

<style scoped>
.sidebar {
  flex: 0 0 0px;
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  height: 100vh;
  background-color: var(--sidebar-bg-color);
  color: var(--sidebar-text-color);
  overflow-x: hidden;
  position: relative;

  /* resizing animation except when dragging */
  transition: flex-basis 0.1s ease-in-out;
  &.manual-resize {
    transition: none;
  }

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
  padding: 5px 24px 5px 8px;
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
