<template>
  <div class="main">
    <Sidebar :chat="assistant.chat" v-if="!isStandaloneChat" />
    <ChatArea :chat="assistant.chat" :standalone="isStandaloneChat" />
    <Settings id="settings" :initial-tab="settingsInitialTab"/>
  </div>
</template>

<script setup>

// components
import Swal from 'sweetalert2/dist/sweetalert2.js'
import { ref, computed, onMounted, nextTick } from 'vue'
import { store } from '../services/store'
import { download, saveFileContents } from '../services/download'
import Sidebar from '../components/Sidebar.vue'
import ChatArea from '../components/ChatArea.vue'
import Settings from './Settings.vue'

// bus
import useEventBus from '../composables/useEventBus'
const { onEvent, emitEvent } = useEventBus()

// assistant
import Assistant from '../services/assistant'
const assistant = ref(new Assistant(store.config))

const settingsInitialTab = ref('general')
const prompt = ref(null)
const engine = ref(null)
const model = ref(null)
const props = defineProps({
  extra: Object
})

const isStandaloneChat = computed(() => {
  return prompt.value !== null
})

onMounted(() => {
  onEvent('newChat', onNewChat)
  onEvent('renameChat', onRenameChat)
  onEvent('deleteChat', onDeleteChat)
  onEvent('selectChat', onSelectChat)
  onEvent('sendPrompt', onSendPrompt)
  onEvent('attachFile', onAttachFile)
  onEvent('detachFile', onDetachFile)
  onEvent('stopAssistant', onStopAssistant)

  // load extra from props
  prompt.value = props.extra?.prompt || null
  engine.value = props.extra?.engine || null
  model.value = props.extra?.model || null

  // init assistant
  if (prompt.value !== null) {
    assistant.value.prompt(prompt.value, {
      engine: engine.value,
      model: model.value,
      route: false,
      save: false,
    }, (text) => {
     emitEvent('newChunk', text)
    })
  }

})

const onNewChat = () => {
  assistant.value.setChat(null)
}

const onRenameChat = async (chat) => {
  // prompt
  const { value: title } = await Swal.fire({
    title: 'Rename Chat',
    input: 'text',
    inputValue: chat.title,
    showCancelButton: true,
  });
  if (title) {
    chat.title = title
    store.saveHistory()
  }
}

const onDeleteChat = async (chat) => {

  Swal.fire({
    target: document.querySelector('.main'),
    title: 'Are you sure you want to delete this conversation? This cannot be undone.',
    confirmButtonText: 'Delete',
    showCancelButton: true,
  }).then((result) => {
    if (result.isConfirmed) {

      // fist remove
      if (isStandaloneChat.value) {
        chat.deleted = true
        store.saveHistory()
      } else {
        let index = store.chats.indexOf(chat)
        store.chats[index].delete()
        store.chats.splice(index, 1)
        store.saveHistory()
      }

      // if current chat
      if (chat.uuid == assistant.value.chat?.uuid) {
        emitEvent('newChat')
      }

      // close window if standalone
      if (isStandaloneChat.value) {
        window.close()
      }

    }
  })
}

const onSelectChat = (chat) => {
  assistant.value.setChat(chat)
  nextTick(() => {
    emitEvent('newChunk')
  })
}

const onSendPrompt = async (prompt) => {

  // make sure we can have an llm
  if (assistant.value.initLlm(store.config.llm.engine) === null) {
    settingsInitialTab.value = 'openai'
    nextTick(() => emitEvent('openSettings'))
    return
  }

  // save the attachment
  if (store.pendingAttachment?.downloaded === false) {
    let filename = null
    if (store.pendingAttachment.url === 'clipboard://') {
      filename = saveFileContents(store.pendingAttachment.format, store.pendingAttachment.contents)
    } else {
      filename = download(store.pendingAttachment.url)
    }
    if (filename) {
      store.pendingAttachment.downloaded = true
      store.pendingAttachment.url = `file://${filename}`
    }
  }

  // prompt
  assistant.value.prompt(prompt, {
    attachment: store.pendingAttachment,
  }, (text) => {
    emitEvent('newChunk', text)
  })

  // clear stuff
  store.pendingAttachment = null

}

const onAttachFile = async (file) => {
  store.pendingAttachment = file
}

const onDetachFile = async () => {
  store.pendingAttachment = null
}

const onStopAssistant = async () => {
  await assistant.value.stop()
}

</script>

<style>
@import 'sweetalert2/dist/sweetalert2.css';
@import '../../css/swal2.css';
</style>

<style scoped>

.main {
  display: flex;
  flex-direction: row;
  height: 100vh;
}

</style>

