<template>
  <div class="studio panel-content" @keydown="onKeyDown" v-bind="$attrs">
    <div class="panel">
      <header>
        <div class="title">{{ t('designStudio.title') }}</div>
        <BIconArrowCounterclockwise class="icon reset" @click="onReset" v-if="currentMedia" />
      </header>
      <main>
        <div class="button-group">
          <button :class="{active: mode === 'create'}" @click="mode = 'create'">{{ t('common.create') }}</button>
          <button :class="{active: mode === 'history'}" @click="mode = 'history'">{{ t('designStudio.history.title') }}</button>
        </div>
        <Settings :class="{ hidden: mode !== 'create' }" ref="settingsPanel" :current-media="currentMedia" :is-generating="isGenerating" @upload="onUpload" @generate="onMediaGenerationRequest" />
        <History :class="{ hidden: mode !== 'history' }" :history="history" :selected-messages="selection" @select-message="selectMessage" @context-menu="showContextMenu" />
      </main>
    </div>
    <Preview class="content"
      :message="currentMedia" :is-generating="isGenerating"
      :can-undo="undoStack.length > 0" :can-redo="redoStack.length > 0"
      @fullscreen="onFullScreen" @delete="onDelete"
      @undo="onUndo" @redo="onRedo"
    />
  </div>
  <ContextMenu v-if="showMenu" @close="closeContextMenu" :actions="contextMenuActions()" @action-clicked="handleActionClick" :x="menuX" :y="menuY" />
</template>

<script setup lang="ts">
import { FileContents } from '../types/index'
import { ref, onMounted, onUnmounted, computed, nextTick } from 'vue'
import { t } from '../services/i18n'
import { store, kMediaChatId, kReferenceParamValue } from '../services/store'
import { saveFileContents } from '../services/download'
import Dialog from '../composables/dialog'
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
const mode = ref<'create'|'history'>('create')
const chat = ref<Chat>(null)
const selection = ref<Message[]>([])
const isGenerating = ref(false)
const undoStack = ref<Message[]>([])
const redoStack = ref<Message[]>([])

const showMenu = ref(false)
const menuX = ref(0)
const menuY = ref(0)
const targetRow = ref<Message|null>(null)

const contextMenuActions = () => {
  return [
    ...selection.value.length == 1 ? [
      { label: t('designStudio.loadMediaSettings'), action: 'load' },
      { label: t('common.rename'), action: 'rename' },
    ] : [],
    { label: t('common.delete'), action: 'delete' },
  ]
}

const currentMedia = computed(() => {
  return selection.value.length === 1 ? selection.value[0] : null
})

const history = computed(() => {
  return chat.value?.messages.filter((m) => m.role === 'user').reverse() || []
})

onMounted(() => {
  // we need the media chat
  chat.value = store.history.chats.find(chat => chat.uuid === kMediaChatId)
  if (!chat.value) {
    chat.value = Chat.fromJson({
      uuid: kMediaChatId,
      title: 'Media',
      createdAt: Date.now(),
      messages: [],
    })
    chat.value.addMessage(new Message('system', 'Dummy chat to save created media'))
    store.history.chats.push(chat.value)
  }

  // events
  window.api.on('delete-media', onDeleteMedia)
  window.api.on('select-all-media', onSelectAll)
  document.addEventListener('keydown', onKeyDown)

})

onUnmounted(() => {
  document.removeEventListener('keydown', onKeyDown)
  window.api.off('delete-media', onDeleteMedia)
  window.api.off('select-all-media', onSelectAll)
})

const isSelected = (msg: Message) => {
  return selection.value.some(m => m.uuid === msg.uuid)
}

const onSelectAll = () => {
  if (history.value.length) {
    mode.value = 'history'
    selection.value = history.value.slice()
  }
}

const onDeleteMedia = () => {
  if (selection.value.length) {
    deleteMedia(selection.value)
  }
}

const onReset = () => {
  selection.value = []
  clearStacks()
  mode.value = 'create'
}

const clearStacks = () => {
  undoStack.value = []
  redoStack.value = []
}

const selectMessage = ({ event, message: msg }: { event: MouseEvent, message: Message }) => {
  if (event.ctrlKey || event.metaKey) {
    if (isSelected(msg)) {
      selection.value = selection.value.filter(m => m.uuid !== msg.uuid)
    } else {
      selection.value.push(msg)
    }
  } else {
    selection.value = [msg]
  }
  clearStacks()
}

const showContextMenu = ({ event, message: msg }: { event: MouseEvent, message: Message }) => {
  showMenu.value = true
  targetRow.value = msg
  if (!isSelected(msg)) {
    selection.value = [msg]
  }
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
        params: msg.toolCalls?.[0]?.params || {}
      })
    })
  } else if (action === 'rename') {
    renameMedia(msg)
  } else if (action === 'delete') {
    deleteMedia(selection.value)
  }
}

const onDelete = (msg: Message) => {
  deleteMedia([msg])
}

const renameMedia = (msg: Message) => {
  Dialog.show({
    title: t('designStudio.renameMedia'),
    input: 'text',
    inputValue: msg.content,
    showCancelButton: true,
  }).then((result) => {
    if (result.isConfirmed) {
      msg.content = result.value
      store.saveHistory()
    }
  })
}

const deleteMedia = (messages: Message[]) => {
  
  Dialog.show({
    title: messages.length > 1
    ? t('designStudio.confirmDeleteMultiple')
    : t('designStudio.confirmDeleteSingle'),
    text: t('common.confirmation.cannotUndo'),
    confirmButtonText: t('common.delete'),
    showCancelButton: true,
  }).then((result) => {
  
    if (result.isConfirmed) {

      // auto-select
      let index = -1
      if (mode.value === 'history' && messages.length === 1) {
        index = history.value.findIndex((m) => m.uuid === messages[0].uuid)
      }

      // delete
      for (const msg of messages) {

        // delete attachments
        for (const attachment of msg.attachments) {
          if (attachment.url) {
            window.api.file.delete(attachment.url)
          }
        }
        chat.value.messages = chat.value.messages.filter((m) => m.uuid !== msg.uuid)
        store.saveHistory()

      }
      
      // if no more history or in create mode or did not find the message
      if (mode.value == 'create' || chat.value.messages.length === 1) {
        selection.value = []
        mode.value = 'create'
        clearStacks()
        return
      }

      // if we did not find the message then select the 1st one
      index = Math.max(0, index - 1)
      selection.value = [history.value[index]]
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

  // select all: don't trigger if focus is on input or textarea
  if (event.key === 'a' && (event.ctrlKey || event.metaKey)) {
    const activeElement = document.activeElement
    if (activeElement && (activeElement.tagName === 'INPUT' || activeElement.tagName === 'TEXTAREA')) {
      return
    }
    event.preventDefault()
    onSelectAll()
    return
  }


  // keyboard navigation
  if (selection.value.length == 1 && mode.value === 'history' && (event.key === 'ArrowDown' || event.key === 'ArrowUp')) {
    const currentIndex = history.value.findIndex((m) => m.uuid === selection.value[0].uuid)
    const newIndex = currentIndex === -1 ? 0 : event.key === 'ArrowDown' ? currentIndex + 1 : currentIndex - 1
    if (newIndex >= 0 && newIndex < history.value.length) {
      selection.value = [history.value[newIndex]]
      clearStacks()
    }
    return
  }

}

const backupCurrentMessage = (): Message => {
  const backup = Message.fromJson(selection.value[0])
  for (const attachment of backup.attachments) {
    if (!attachment.content) {
      attachment.content = window.api.file.read(attachment.url).contents
    }
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
  if (selection.value.length != 1) return
  const message = selection.value[0]
  for (const attachment of message.attachments) {
    if (attachment.url) {
      window.api.file.delete(attachment.url)
    }
  }
  message.content = msg.content
  message.engine = msg.engine
  message.model = msg.model
  message.toolCalls = msg.toolCalls
  message.content = msg.content
  message.attachments = []
  for (const a of msg.attachments) {
    const attachment = new Attachment('', a.mimeType, a.url)
    attachment.url = window.api.file.save({
      contents: a.content,
      properties: {
        filename: a.url.split(/[\\/]/).pop(),
        directory: 'userData',
        subdir: 'images',
        prompt: false
      }
    })
    message.attach(attachment)
  }
  message.usage = msg.usage
}

const onUpload = () => {
  let file = window.api.file.pick({ filters: [
    { name: 'Images', extensions: ['jpg', 'png', 'gif'] }
  ] })
  if (file) {
    const fileContents = file as FileContents
    const fileUrl = saveFileContents(fileContents.url.split('.').pop(), fileContents.contents)
    const message = new Message('user', t('common.upload'))
    message.engine = 'upload'
    message.model = fileContents.url.split(/[\\/]/).pop()
    message.attach(new Attachment('', fileContents.mimeType, fileUrl))
    selection.value = [message]
    clearStacks()
  }
}

const onMediaGenerationRequest = async (data: any) => {

  // check
  const message: Message|null = selection.value.length == 0 ? null : selection.value[0]

  // save
  const currentUrl = message?.attachments[0]?.url
  const isEditing = data.action === 'edit' && !!currentUrl
  const isTransforming = data.action === 'transform' && !!currentUrl
  let attachReference = isEditing || isTransforming

  // make a copy as we are going to change that
  const params = JSON.parse(JSON.stringify(data.params))

  // replicate is painful...
  let referenceKey = null
  if (data.engine === 'replicate') {

    // find the key of <media> in params
    referenceKey = Object.keys(params).find(k => params[k] === kReferenceParamValue)

    if (attachReference) {

      // ask the user
      if (!referenceKey) {

        const url = `https://replicate.com/${data.model.split(':')[0]}`
        
        const result = await Dialog.show({
          title: t('designStudio.replicateInputImageRequired.title'),
          html: t('designStudio.replicateInputImageRequired.text', { url }),
          input: 'text',
          showCancelButton: true,
        })

        referenceKey = result.value
      }

      // still not?
      if (!referenceKey) {
        isGenerating.value = false
        return
      }

      // attach here
      const reference = window.api.file.read(currentUrl)
      params[referenceKey] = `data:${reference.mimeType};base64,${reference.contents}`
      attachReference = false

      // ask Settings.vue to save the key
      emitEvent('replicate-input-image-key', referenceKey)

    } else if (referenceKey) {

      // remove the key
      delete params[referenceKey]
      attachReference = false

    }

  }

  // reset
  isGenerating.value = true
  if (!isEditing) {
    selection.value = []
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
    let message: Message|null = null
    if (selection.value.length === 0) {
    
      message = new Message('user', data.prompt)
      chat.value.messages.push(message)
      selection.value = [message]
    
    } else {

      // update
      message = selection.value[0]
      message.content = message.content.length ? `${message.content} / ${data.prompt}` : data.prompt
      message.createdAt = Date.now()

      // delete attachment
      if (message.attachments.length > 0) {
        window.api.file.delete(message.attachments[0].url)
        message.attachments = []
      }
      
      // push at the end of the chat
      chat.value.messages = chat.value.messages.filter((m) => m.uuid !== message.uuid)
      chat.value.messages.push(message)
    }

    // now the message
    message.engine = data.engine
    message.model = data.model
    const attachment = new Attachment('', data.mediaType === 'image' ? 'image/jpg' : 'video/mp4', media.url)
    message.attach(attachment)

    // tool call
    if (Object.keys(data.params).length > 0) {

      // update reference key
      if (referenceKey) {
        params[referenceKey] = kReferenceParamValue
      }
      message.toolCalls = [{
        id: crypto.randomUUID(),
        name: data.action,
        params: params,
        result: 'success',
        done: true
      }]
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

.panel-content {
  
  .panel {
  
    flex: 0 0 var(--create-panel-width);

    header {

      .icon.reset {
        position: relative;
        transform: scale(105%);
        top: 1px;
      }
    }

    main {
      flex: 1;
      padding-top: 1rem;
      border-right: 1px solid var(--sidebar-border-color);
    }

    main .button-group {
      display: flex;
      justify-content: center;
      align-items: center;
      margin-bottom: 1rem;
    }

    main .hidden {
      display: none;
    }
  }

}

</style>