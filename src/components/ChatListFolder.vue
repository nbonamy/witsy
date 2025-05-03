<template>
  <section v-for="f in visibleFolders" :key="f.name">
    <div class="folder">
      <span @click="toggleFolder(f.id)">
        <span v-if="isFolderExpanded(f.id)" class="expand">▼</span>
        <span v-else class="expand">▶</span>
        {{ f.name }}
      </span>
      <BIconThreeDots class="menu" @click="showFolderContextMenu($event, f.id)" v-if="f.id != store.rootFolder.id"/>
    </div>
    <template v-for="chat in f.chats" :key="chat.uuid" v-if="isFolderExpanded(f.id)">
      <ChatListItem :chat="chat" :selection="selection" :active="active" :selectMode="selectMode" @click="onSelectChat(chat)" @contextmenu.prevent="showChatContextMenu($event, chat)" />
    </template>
  </section>
  <ContextMenu v-if="showMenu" :on-close="closeContextMenu" :actions="contextMenuActions()" @action-clicked="handleActionClick" :x="menuX" :y="menuY" />
</template>

<script setup lang="ts">

import { Folder } from '../types/index'
import { Ref, ref, onMounted, computed } from 'vue'
import { store } from '../services/store'
import { t } from '../services/i18n'
import Dialog from '../composables/dialog'
import ChatListItem from './ChatListItem.vue'
import ContextMenu from './ContextMenu.vue'
import Chat from '../models/chat'

import useEventBus from '../composables/event_bus'
const { emitEvent } = useEventBus()

import useTipsManager from '../composables/tips_manager'
const tipsManager = useTipsManager(store)

const props = defineProps({
  chats: {
    type: Array<Chat>,
    required: true,
  },
  filtered: {
    type: Boolean,
    required: true,
  },
  selection: {
    type: Array<String>,
    required: true,
  },
  active: {
    type: Chat,
    default: null,
  },
  selectMode: {
    type: Boolean,
    default: false,
  }
})

const visibleFolders = computed(() => {
  let folders: Folder[] = JSON.parse(JSON.stringify(store.history.folders))
  if (props.filtered) {
    folders = folders.filter((f: Folder) => {
      return f.chats.some(c => props.chats.map(c => c.uuid).includes(c))
    })
  }
  folders.sort((a: Folder, b: Folder) => a.name.localeCompare(b.name))
  let rootChats = store.history.chats.filter(c => store.history.folders.every(f => !f.chats.includes(c.uuid)))
  folders.push({ id: store.rootFolder.id, name: store.rootFolder.name, chats: rootChats.map(c => c.uuid) })
  return folders.map(f => {
    return {
      id: f.id,
      name: f.name,
      chats: f.chats
        .filter(c => props.chats.find(chat => chat.uuid == c))
        .map(c => props.chats.find(chat => chat.uuid == c))
        .sort((a, b) => b.lastModified - a.lastModified)
    }
  })
})

const emit = defineEmits(['select', 'menu']);

const expandedFolders: Ref<string[]> = ref([ store.rootFolder.id ])

const showMenu = ref(false)
const menuX = ref(0)
const menuY = ref(0)
const targetRow: Ref<string|null> = ref(null)
const contextMenuActions = () => {
  const folder = store.history.folders.find((f) => f.id === targetRow.value)
  return [
    { label: t('common.newChat'), action: 'chat' },
    { label: t('common.rename'), action: 'rename' },
    ...(props.active?.hasMessages() ? [ { label: t('chatList.folder.actions.setDefaults'), action: 'setDefaults' } ] : []),
    ...(folder?.defaults ? [ { label: t('chatList.folder.actions.clearDefaults'), action: 'clearDefaults' } ] : []),
    { label: t('chatList.folder.actions.delete'), action: 'delete' },
  ]
}

onMounted(() => {
  expandedFolders.value = localStorage.getItem('expandedFolders')?.split(',') || expandedFolders.value
})

const isFolderExpanded = (id: string) => {
  return expandedFolders.value.includes(id)
}

const expandFolder = (id: string) => {
  expandedFolders.value = [...expandedFolders.value, id]
  localStorage.setItem('expandedFolders', expandedFolders.value.join(','))
}

const collapseFolder = (id: string) => {
  expandedFolders.value = expandedFolders.value.filter(i => i != id)
  localStorage.setItem('expandedFolders', expandedFolders.value.join(','))
}

const toggleFolder = (id: string) => {
  if (isFolderExpanded(id)) {
    collapseFolder(id)
  } else {
    expandFolder(id)
  }
}

const onSelectChat = (chat: Chat) => {
  emit('select', chat)
}

const showChatContextMenu = (event: MouseEvent, chat: Chat) => {
  emit('menu', event, chat)
}

const showFolderContextMenu = (event: MouseEvent, folderId: string) => {
  showMenu.value = true
  targetRow.value = folderId
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
  let folderId: string = targetRow.value
  if (!folderId) return

  // process
  if (action === 'chat') {
    expandFolder(folderId)
    emitEvent('new-chat-in-folder', folderId)
  } else if (action === 'rename') {
    emitEvent('rename-folder', folderId)
  } else if (action === 'delete') {
    emitEvent('delete-folder', folderId)
  } else if (action === 'setDefaults') {

    // get and check
    const chat: Chat = props.active
    const folder = store.history.folders.find((f) => f.id === folderId)
    if (!folder) return

    // if already set, ask for confirmation
    if (folder.defaults) {
      const result = await Dialog.show({
        title: t('chatList.folder.confirmOverwriteDefaults'),
        text: t('common.confirmation.cannotUndo'),
        showCancelButton: true,
      })

      if (result.isDismissed) {
        return
      }
    }

    // set defaults
    folder.defaults = {
      engine: chat.engine,
      model: chat.model,
      disableStreaming: chat.disableStreaming,
      tools: chat.tools,
      prompt: chat.prompt,
      locale: chat.locale,
      expert: chat.messages.findLast((m) => m.expert)?.expert?.id,
      docrepo: chat.docrepo,
      modelOpts: chat.modelOpts,
    }

    // save
    store.saveHistory()

    // show tip
    tipsManager.showTip('folderDefaults')

  } else if (action === 'clearDefaults') {

    // get and check
    const folder = store.history.folders.find((f) => f.id === folderId)
    if (!folder) return

    // confirm
    const result = await Dialog.show({
      title: t('chatList.folder.confirmDeleteDefaults'),
      text: t('common.confirmation.cannotUndo'),
      confirmButtonText: t('common.delete'),
      showCancelButton: true,
    })

    if (result.isDismissed) {
      return
    }

    // clear and save
    delete folder.defaults
    store.saveHistory()

  }
}

</script>

<style scoped>

.folder {
  display: flex;
  gap: .25rem;
  margin: 12px 0 8px;
  padding: 0 12px;
  font-size: 9pt;
  font-weight: bold;
  text-transform: uppercase;
  color: var(--sidebar-section-title-color);
  cursor: pointer;

  .expand {
    display: inline-block;
    width: 0.66rem;
  }

  .menu {
    margin-left: auto;
  }
}

section:first-child .folder {
  margin-top: 0;
}

</style>
