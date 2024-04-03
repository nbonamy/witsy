<template>
  <div class="main">
    <Sidebar :chat="assistant.chat" />
    <ChatArea :chat="assistant.chat" />
  </div>
</template>

<script setup>

// components
import { ref, onMounted } from 'vue'
import Sidebar from './components/Sidebar.vue'
import ChatArea from './components/ChatArea.vue'

// bus
import useEventBus from './composables/useEventBus'
const { onEvent } = useEventBus()

// store
import { store, loadStore } from './services/store'
import defaults from '../defaults/settings.json'
store.config = defaults
loadStore()

// assistant
import Assistant from './services/assistant'
const assistant = ref(new Assistant(store.config))

onMounted(() => {
  onEvent('newChat', onNewChat)
  onEvent('selectChat', onSelectChat)
  onEvent('sendPrompt', onSendPrompt)
})

const onNewChat = () => {
  assistant.value.newChat()
}

const onSelectChat = (chat) => {
  assistant.value.setChat(chat)
}

const onSendPrompt = async (prompt) => {
  assistant.value.prompt(prompt)
}

</script>

<style scoped>

.main {
  display: flex;
  flex-direction: row;
  height: 100vh;
}

</style>

