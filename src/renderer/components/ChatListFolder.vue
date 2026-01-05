<template>
  <section v-for="f in visibleFolders" :key="f.name">
    <div class="folder">
      <span @click="toggleFolder(f.id)">
        <span v-if="isFolderExpanded(f.id)" class="expand">▼</span>
        <span v-else class="expand">▶</span>
        {{ f.name }}
      </span>
      <div class="flex-push" />
      <ButtonIcon @click="onNewChat(f.id)">
        <MessageCirclePlusIcon />
      </ButtonIcon>
      <ButtonIcon class="menu" @click="showFolderContextMenu($event, f.id)" v-if="f.id != store.rootFolder.id">
        <EllipsisVertical />
      </ButtonIcon>
    </div>
    <template v-for="chat in f.chats" :key="chat.uuid" v-if="isFolderExpanded(f.id)">
      <ChatListItem :chat="chat" :selection="selection" :active="active" :selectMode="selectMode" @click="onSelectChat(chat)" @contextmenu.prevent="showChatContextMenu($event, chat)" />
    </template>
  </section>
  <ContextMenuPlus v-if="showMenu" @close="closeContextMenu" :mouseX="menuX" :mouseY="menuY">
    <!-- <div class="item" @click="handleActionClick('chat')">{{ t('common.newChat') }}</div> -->
    <div class="item" @click="handleActionClick('rename')">{{ t('common.rename') }}</div>
    <div class="item" @click="handleActionClick('editDefaults')">{{ t('chatList.folder.actions.editDefaults') }}</div>
    <div class="item" @click="handleActionClick('setDefaults')">{{ t('chatList.folder.actions.setDefaults') }}</div>
    <div v-if="store.history.folders.find((f: Folder) => f.id === targetRow)?.defaults" class="item" @click="handleActionClick('clearDefaults')">{{ t('chatList.folder.actions.clearDefaults') }}</div>
    <div class="item" @click="handleActionClick('delete')">{{ t('chatList.folder.actions.delete') }}</div>
  </ContextMenuPlus>

  <FolderSettings ref="folderSettings" />

</template>

<script setup lang="ts">

import { EllipsisVertical, MessageCirclePlusIcon } from 'lucide-vue-next'
import { computed, onMounted, ref } from 'vue'
import Dialog from '@renderer/utils/dialog'
import useEventBus from '@composables/event_bus'
import Chat from '@models/chat'
import FolderSettings from '@screens/FolderSettings.vue'
import { t } from '@services/i18n'
import { store } from '@services/store'
import { Folder } from 'types/index'
import ButtonIcon from './ButtonIcon.vue'
import ChatListItem from './ChatListItem.vue'
import ContextMenuPlus from './ContextMenuPlus.vue'

const { emitEvent } = useEventBus()

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

const folderSettings = ref<InstanceType<typeof FolderSettings>>()
const expandedFolders= ref<string[]>([ store.rootFolder.id ])

const showMenu = ref(false)
const menuX = ref(0)
const menuY = ref(0)
const targetRow= ref<string|null>(null)

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

const onNewChat = (folderId: string) => {
  expandFolder(folderId)
  emitEvent('new-chat-in-folder', folderId)
}

const handleActionClick = async (action: string) => {

  // close
  closeContextMenu()

  // init
  let folderId: string = targetRow.value
  if (!folderId) return

  // process
  if (action === 'chat') {
    onNewChat(folderId)
  } else if (action === 'rename') {
    emitEvent('rename-folder', folderId)
  } else if (action === 'delete') {
    emitEvent('delete-folder', folderId)
  } else if (action === 'editDefaults') {

    // get and check
    const folder = store.history.folders.find((f) => f.id === folderId)
    if (!folder) return

    // open the folder settings dialog
    folderSettings.value?.show(folder)

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

  } else if (action === 'setDefaults') {

    // get and check
    const chat: Chat = props.active
    
    // get and check
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
      instructions: chat.instructions,
      locale: chat.locale,
      expert: chat.messages.findLast((m) => m.expert)?.expert?.id || null,
      docrepos: chat.docrepos,
      modelOpts: chat.modelOpts,
    }

    // save
    store.saveHistory()

  }
}

</script>

<style scoped>

.folder {
  display: flex;
  align-items: center;
  justify-content: flex-start;
  gap: .25rem;
  margin: 12px 0 8px;
  padding: 0 2px;
  font-size: 12px;
  font-weight: bold;
  text-transform: uppercase;
  color: var(--sidebar-section-title-color);
  cursor: pointer;

  .expand {
    display: inline-block;
    width: 0.66rem;
  }

  .button-icon {
    padding: 0px 2px;
    visibility: hidden;
    background-color: transparent !important;
  }

  &:hover .button-icon {
    visibility: visible;
  }
}

section:first-child .folder {
  margin-top: 0;
}

</style>
