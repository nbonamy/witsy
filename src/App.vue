<template>
  <div class="main">
    <Sidebar :chat="assistant.chat" />
    <ChatArea :chat="assistant.chat" />
    <Settings id="settings"/>
  </div>
</template>

<script setup>

// components
import { ref, onMounted } from 'vue'
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

// assistant
import Assistant from './services/assistant'
const assistant = ref(new Assistant(store.config))

onMounted(() => {
  onEvent('newChat', onNewChat)
  onEvent('selectChat', onSelectChat)
  onEvent('sendPrompt', onSendPrompt)
  onEvent('openSettings', onOpenSettings)
})

const onNewChat = () => {
  assistant.value.newChat()
}

const onSelectChat = (chat) => {
  assistant.value.setChat(chat)
}

const onOpenSettings = () => {
  document.querySelector('#settings').showModal()
}

const onSendPrompt = async (prompt) => {

  // do we need to init llm
  if (!assistant.value.hasLlm()) {
    if (store.config.openAI.apiKey) {
      assistant.value.initLlm()
    } else {
      emitEvent('openSettings')
      return
    }
  }

  // 
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

