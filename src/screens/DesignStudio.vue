<template>
  <div class="create-media window" @keydown="onKeyDown">
    <div class="panel">
      <div class="actions">
        <BIconClockHistory @click="mode = 'history'" v-if="mode === 'create'"/>
        <BIconSliders @click="mode = 'create'" v-if="mode === 'history'"/>
        <BIconPencilSquare @click="onReset"/>
      </div>
      <Settings :class="{ hidden: mode !== 'create' }" ref="settingsPanel" :current-media="message" :is-generating="isGenerating" @upload="onUpload" @generate="onMediaGenerationRequest" />
      <History :class="{ hidden: mode !== 'history' }" :history="history" :selected-message="message" @select-message="selectMessage" @context-menu="showContextMenu" />
    </div>
    <Preview
      :message="message" :is-generating="isGenerating"
      :can-undo="undoStack.length > 0" :can-redo="redoStack.length > 0"
      @fullscreen="onFullScreen" @delete="onDelete"
      @undo="onUndo" @redo="onRedo"
    />
  </div>
  <Fullscreen window="create" />
  <ContextMenu v-if="showMenu" :on-close="closeContextMenu" :actions="contextMenuActions()" @action-clicked="handleActionClick" :x="menuX" :y="menuY" />
</template>

<script setup lang="ts">
import { FileContents } from '../types/index'
import { ref, Ref, onMounted, computed, nextTick } from 'vue'
import { t } from '../services/i18n'
import { store, mediaChatId } from '../services/store'
import { saveFileContents } from '../services/download'
import Dialog from '../composables/dialog'
import Fullscreen from '../components/Fullscreen.vue'
import ContextMenu from '../components/ContextMenu.vue'
import Settings from '../studio/Settings.vue'
import History from '../studio/History.vue'
import Preview from '../studio/Preview.vue'
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
const undoStack: Ref<Message[]> = ref([])
const redoStack: Ref<Message[]> = ref([])

const showMenu = ref(false)
const menuX = ref(0)
const menuY = ref(0)
const targetRow: Ref<Message|null> = ref(null)

const contextMenuActions = () => [
  { label: t('designStudio.loadMediaSettings'), action: 'load' },
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

const onReset = () => {
  selectMessage(null)
  mode.value = 'create'
}

const clearStacks = () => {
  undoStack.value = []
  redoStack.value = []
}

const selectMessage = (msg: Message) => {
  message.value = msg
  clearStacks()
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
    clearStacks()
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
    title: t('designStudio.confirmDelete'),
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
        clearStacks()
        return
      }

      // if we did not find the message then select the 1st one
      index = Math.max(0, index - 1)
      message.value = history.value[index]
      clearStacks()

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
      clearStacks()
    }
    return
  }

}

const backupCurrentMessage = (): Message => {
  const backup = Message.fromJson(message.value)
  if (!backup.attachment.content) {
    backup.attachment.content = window.api.file.read(backup.attachment.url).contents
  }
  return backup
}


const onUndo = () => {
  if (isGenerating.value) return
  if (undoStack.value.length === 0) return
  redoStack.value.push(backupCurrentMessage())
  updateMessage(undoStack.value.pop()!)
  store.saveHistory()
}

const onRedo = () => {
  if (isGenerating.value) return
  if (redoStack.value.length === 0) return
  undoStack.value.push(backupCurrentMessage())
  updateMessage(redoStack.value.pop()!)
  store.saveHistory()
}

const updateMessage = (msg: Message) => {
  if (!message.value || !msg) return
  if (message.value.attachment?.url) {
    window.api.file.delete(message.value.attachment.url)
  }
  message.value.content = msg.content
  message.value.engine = msg.engine
  message.value.model = msg.model
  message.value.toolCall = msg.toolCall
  message.value.attachment.mimeType = msg.attachment.mimeType
  message.value.content = msg.content
  message.value.attachment.url = window.api.file.save({
    contents: msg.attachment.content,
    properties: {
      filename: msg.attachment.url.split('/').pop(),
      directory: 'userData',
      subdir: 'images',
      prompt: false
    }
  })
  message.value.usage = msg.usage
}

const onUpload = () => {
  let file = window.api.file.pick({ filters: [
    { name: 'Images', extensions: ['jpg', 'png', 'gif'] }
  ] })
  if (file) {
    const fileContents = file as FileContents
    const fileUrl = saveFileContents(fileContents.url.split('.').pop(), fileContents.contents)
    message.value = new Message('user', t('common.upload'))
    message.value.engine = 'upload'
    message.value.model = fileContents.url.split('/').pop()
    message.value.attachment = new Attachment('', fileContents.mimeType, fileUrl)
    clearStacks()
  }
}

const onMediaGenerationRequest = async (data: any) => {

  // save
  const currentUrl = message.value?.attachment?.url
  const isEditing = data.action === 'edit' && !!currentUrl
  const isTransforming = data.action === 'transform' && !!currentUrl
  let attachReference = isEditing || isTransforming

  // make a copy as we are going to change that
  const params = JSON.parse(JSON.stringify(data.params))

  // replicate is painful...
  if (data.engine === 'replicate' && attachReference) {

    // find the key of <media> in params
    let key = Object.keys(params).find(k => params[k] === '<media>')

    // ask the user
    if (!key) {

      const url = `https://replicate.com/${data.model.split(':')[0]}`
      
      const result = await Dialog.show({
        title: t('designStudio.replicateInputImageRequired.title'),
        html: t('designStudio.replicateInputImageRequired.text', { url }),
        input: 'text',
        showCancelButton: true,
      })

      key = result.value
    }

    // still not?
    if (!key) {
      isGenerating.value = false
      return
    }

    // attach here
    const reference = window.api.file.read(currentUrl)
    params[key] = `data:${reference.mimeType};base64,${reference.contents}`
    attachReference = false

    // ask Settings.vue to save the key
    emitEvent('replicate-input-image-key', key)

  }

  // reset
  isGenerating.value = true
  if (!isEditing) {
    message.value = null
    clearStacks()
  } else {
    undoStack.value.push(backupCurrentMessage())
    redoStack.value = []
  }

  try {

    // we need to convert params who look like numbers to numbers
    Object.keys(params).forEach((key) => {
      if (!params[key]) {
        delete params[key]
      } else if (params[key] === 'true') {
        params[key] = true
      } else if (params[key] === 'false') {
        params[key] = false
      } else if (!isNaN(params[key])) {
        params[key] = parseFloat(params[key])
      }
    })

    // generate
    const creator = data.mediaType === 'image' ? new ImageCreator() : new VideoCreator()
    const media = await creator.execute(data.engine, data.model, {
      prompt: data.prompt,
      ...params
    }, attachReference ? window.api.file.read(currentUrl) : undefined)

    // check
    if (!media?.url) {
      throw new Error(media.error)
    }

    // if we are editing then delete the old media
    if (!message.value) {
      message.value = new Message('user', data.prompt)
      chat.value.messages.push(message.value)
    } else {

      // update
      message.value.content = message.value.content.length ? `${message.value.content} / ${data.prompt}` : data.prompt
      message.value.createdAt = Date.now()

      // delete attachment
      if (message.value.attachment) {
        window.api.file.delete(message.value.attachment.url)
        message.value.attach(null)
      }
      
      // push at the end of the chat
      chat.value.messages = chat.value.messages.filter((m) => m.uuid !== message.value.uuid)
      chat.value.messages.push(message.value)
    }

    // now the message
    message.value.engine = data.engine
    message.value.model = data.model
    const attachment = new Attachment('', data.mediaType === 'image' ? 'image/jpg' : 'video/mp4', media.url)
    message.value.attach(attachment)

    // extra params
    if (Object.keys(data.params).length > 0) {
      message.value.toolCall = {
        status: 'done',
        calls: [{
          name: 'create_media',
          params: params,
          result: 'success'
        }]
      }
    }

    // save
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
            text: t('designStudio.error.invalidParams', { detail: message.detail.trim() }),
          })
        } else {
          Dialog.show({
            title: t('common.error'),
            text: t('designStudio.error.invalidParams', { detail: t('designStudio.error.noDetailsProvided') }),
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
      text: e.message || t('designStudio.error.unknown'),
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