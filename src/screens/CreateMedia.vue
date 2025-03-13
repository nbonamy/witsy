<template>
  <div class="create-media window" @keydown="onKeyDown">
    <div class="panel">
      <div class="actions">
        <BIconClockHistory @click="mode = 'history'" v-if="mode === 'create'"/>
        <BIconSliders @click="mode = 'create'" v-if="mode === 'history'"/>
      </div>
      <Settings :class="{ hidden: mode !== 'create' }" ref="settingsPanel" :is-generating="isGenerating" @generate="onMediaGenerationRequest" />
      <History :class="{ hidden: mode !== 'history' }" :history="history" :selected-message="message" @select-message="selectMessage" @context-menu="showContextMenu" />
    </div>
    <Preview :message="message" :is-generating="isGenerating" @fullscreen="onFullScreen" @delete="onDelete"/>
  </div>
  <Fullscreen window="create" />
  <ContextMenu v-if="showMenu" :on-close="closeContextMenu" :actions="contextMenuActions()" @action-clicked="handleActionClick" :x="menuX" :y="menuY" />
</template>

<script setup lang="ts">
import { ref, Ref, onMounted, computed, nextTick } from 'vue'
import { t } from '../services/i18n'
import { store, mediaChatId } from '../services/store'
import Dialog from '../composables/dialog'
import Fullscreen from '../components/Fullscreen.vue'
import ContextMenu from '../components/ContextMenu.vue'
import Settings from '../create/Settings.vue'
import History from '../create/History.vue'
import Preview from '../create/Preview.vue'
import ImageCreator from '../services/image'
import VideoCreator from '../services/video'
import Message from '../models/message'
import Attachment from '../models/attachment'
import Chat from '../models/chat'

import useEventBus from '../composables/event_bus'
const { emitEvent } = useEventBus()

defineProps({
  extra: Object
})

const settingsPanel = ref(null)
const mode: Ref<'create'|'history'> = ref('create')
const chat: Ref<Chat> = ref(null)
const message: Ref<Message> = ref(null)
const isGenerating = ref(false)

const showMenu = ref(false)
const menuX = ref(0)
const menuY = ref(0)
const targetRow: Ref<Message|null> = ref(null)

const contextMenuActions = () => [
  { label: t('createMedia.loadMediaSettings'), action: 'load' },
  { label: t('common.delete'), action: 'delete' },
]

store.loadSettings()
store.loadHistory()

const history = computed(() => {
  return chat.value?.messages.filter((m) => m.role === 'user').reverse() || []
})

onMounted(() => {
  // we need the media chat
  chat.value = store.history.chats.find(chat => chat.uuid === mediaChatId)
  if (!chat.value) {
    chat.value = Chat.fromJson({
      uuid: mediaChatId,
      title: 'Media',
      createdAt: Date.now(),
      messages: [],
    })
    chat.value.addMessage(new Message('system', 'Dummy chat to save created media'))
    store.history.chats.push(chat.value)
  }

  // main event
  window.api.on('delete-media', () => {
    if (message.value) {
      deleteMedia(message.value)
    }
  })

  // keyboard
  document.addEventListener('keydown', onKeyDown)
})

const selectMessage = (msg: Message) => {
  message.value = msg
}

const showContextMenu = ({ event, message: msg }: { event: MouseEvent, message: Message }) => {
  showMenu.value = true
  targetRow.value = msg
  message.value = msg
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
  let msg = targetRow.value
  if (!msg) return

  // process
  if (action === 'load') {
    mode.value = 'create'
    nextTick(() => {
      settingsPanel.value.loadSettings({
        mediaType: msg.isVideo() ? 'video' : 'image',
        engine: msg.engine,
        model: msg.model,
        prompt: msg.content,
        params: msg.toolCall?.calls?.[0]?.params || {}
      })
    })
  }
  else if (action === 'delete') {
    deleteMedia(msg)
  }
}

const onDelete = (msg: Message) => {
  deleteMedia(msg)
}

const deleteMedia = (msg: Message) => {
  Dialog.show({
    title: t('createMedia.confirmDelete'),
    text: t('common.confirmation.cannotUndo'),
    confirmButtonText: t('common.delete'),
    showCancelButton: true,
  }).then((result) => {
    if (result.isConfirmed) {

      // auto-select
      let index = -1
      if (mode.value === 'history') {
        index = history.value.findIndex((m) => m.uuid === msg.uuid)
      }

      // delete
      window.api.file.delete(msg.attachment.url)        
      chat.value.messages = chat.value.messages.filter((m) => m.uuid !== msg.uuid)
      store.saveHistory()
      
      // if no more history or in create mode or did not find the message
      if (mode.value == 'create' || chat.value.messages.length === 1) {
        message.value = null
        mode.value = 'create'
        return
      }

      // if we did not find the message then select the 1st one
      index = Math.max(0, index - 1)
      message.value = history.value[index]

    }
  })
}

const onKeyDown = (event: KeyboardEvent) => {

  // escape to go back to create
  if (event.key === 'Escape') {
    mode.value = 'create'
    return
  }

  // keyboard navigation
  if (mode.value === 'history' && (event.key === 'ArrowDown' || event.key === 'ArrowUp')) {
    const currentIndex = history.value.findIndex((m) => m.uuid === message.value?.uuid)
    const newIndex = currentIndex === -1 ? 0 : event.key === 'ArrowDown' ? currentIndex + 1 : currentIndex - 1
    if (newIndex >= 0 && newIndex < history.value.length) {
      message.value = history.value[newIndex]
    }
    return
  }

}

const onMediaGenerationRequest = async (data: any) => {

  message.value = null
  isGenerating.value = true

  try {

    // we need to convert params who look like numbers to numbers
    Object.keys(data.params).forEach((key) => {
      if (!data.params[key]) {
        delete data.params[key]
      } else if (data.params[key] === 'true') {
        data.params[key] = true
      } else if (data.params[key] === 'false') {
        data.params[key] = false
      } else if (!isNaN(data.params[key])) {
        data.params[key] = parseFloat(data.params[key])
      }
    })

    // generate
    const creator = data.mediaType === 'image' ? new ImageCreator() : new VideoCreator()
    const media = await creator.execute( data.engine, data.model, {
      prompt: data.prompt,
      ...data.params
    })

    // check
    if (!media?.url) {
      throw new Error()
    }

    // now the message
    const newMessage = new Message('user', data.prompt)
    newMessage.engine = data.engine
    newMessage.model = data.model
    newMessage.attach(new Attachment('', data.mediaType === 'image' ? 'image/jpg' : 'video/mp4', media.url))

    // extra params
    if (Object.keys(data.params).length > 0) {
      newMessage.toolCall = {
        status: 'done',
        calls: [{
          name: 'create_media',
          params: data.params,
          result: 'success'
        }]
      }
    }

    // save
    chat.value.messages.push(newMessage)
    message.value = newMessage

    // done
    store.saveHistory()

  } catch (e) {

    // replicate special
    try {
      if (e.response?.status === 422) {
        const index = e.message.indexOf('{')
        if (index >= 0) {
          const error = e.message.substring(index, e.message.length - 1)
          const message = JSON.parse(error)
          Dialog.show({
            title: t('common.error'),
            text: t('createMedia.error.invalidParams', { detail: message.detail.trim() }),
          })
        } else {
          Dialog.show({
            title: t('common.error'),
            text: t('createMedia.error.invalidParams', { detail: t('createMedia.error.noDetailsProvided') }),
          })
        }
        return
      }
    } catch {
      // Fall through to general error handling
    }

    // other errors
    Dialog.show({
      title: t('common.error'),
      text: e.message || t('createMedia.error.unknown'),
    })
  
  } finally {
    isGenerating.value = false
  }
}

const onFullScreen = (url: string) => {
  emitEvent('fullscreen', url)
}
</script>

<style scoped>
@import '../../css/panel-content.css';
</style>

<style scoped>

.panel {
  flex: 0 0 var(--create-panel-width);
  > .hidden {
    display: none;
  }
}

</style>