<template>
  <div class="main">
    <Sidebar :chat="assistant.chat" />
    <ChatArea :chat="assistant.chat" />
    <Settings id="settings"/>
  </div>
</template>

<script setup>

// components
import { ipcRenderer } from 'electron'
import { ref, onMounted, nextTick } from 'vue'
import Sidebar from './components/Sidebar.vue'
import ChatArea from './components/ChatArea.vue'
import Settings from './components/Settings.vue'

// bus
import useEventBus from './composables/useEventBus'
const { onEvent, emitEvent } = useEventBus()

// store
import { store } from './services/store'
import defaults from '../defaults/settings.json'
store.load(defaults)

// install shortcuts
ipcRenderer.send('register-shortcuts', JSON.stringify(store.config.shortcuts))

// assistant
import Assistant from './services/assistant'
const assistant = ref(new Assistant(store.config))

onMounted(() => {
  onEvent('newChat', onNewChat)
  onEvent('selectChat', onSelectChat)
  onEvent('sendPrompt', onSendPrompt)
  onEvent('attachFile', onAttachFile)
  onEvent('detachFile', onDetachFile)
  onEvent('stopAssistant', onStopAssistant)
})

const onNewChat = () => {
  assistant.value.newChat()
}

const onSelectChat = (chat) => {
  assistant.value.setChat(chat)
  nextTick(() => {
    emitEvent('newChunk')
  })
}

const onSendPrompt = async (prompt) => {

  // do we need to init llm
  if (assistant.value.initLlm() === null) {
    emitEvent('openSettings')
    return
  }

  // 
  assistant.value.prompt(prompt, store.pendingAttachment, (text) => {
    emitEvent('newChunk', text)
  })

  // clear stuff
  store.pendingAttachment = null
  store.cleanEmptyChats()
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

<style scoped>

.main {
  display: flex;
  flex-direction: row;
  height: 100vh;
}

</style>

