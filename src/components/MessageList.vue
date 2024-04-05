<template>
  <div class="messages" :class="chatTheme" ref="divMessages">
    <div v-for="message in chat.messages" :key="message.uuid">
      <MessageItem :chat="chat" :message="message" />
    </div>
  </div>
</template>

<script setup>

import { ref, computed, onMounted, nextTick } from 'vue'
import { store } from '../services/store'
import Chat from '../models/chat'
import MessageItem from './MessageItem.vue'

import useEventBus from '../composables/useEventBus'
const { onEvent } = useEventBus()

const divMessages = ref(null)

const chatTheme = computed(() => store.config.appearance.chat.theme)

defineProps({
  chat: Chat
})

onMounted(() => {
  onEvent('newChunk', onNewChunk)
})

const onNewChunk = () => {
  nextTick(() => {
    divMessages.value.scrollTop = divMessages.value.scrollHeight
  })
}

</script>

<style scoped>

.messages {
  height: 100vh;
  padding: 16px;
  overflow-y: auto;
}

</style>
