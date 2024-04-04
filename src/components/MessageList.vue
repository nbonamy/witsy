<template>
  <div class="messages" ref="divMessages">
    <div v-for="message in messages" :key="message.uuid">
      <MessageItem :message="message" />
    </div>
  </div>
</template>

<script setup>

import { ref, onMounted, nextTick } from 'vue'
import MessageItem from './MessageItem.vue'

import useEventBus from '../composables/useEventBus'
const { onEvent } = useEventBus()

const divMessages = ref(null)

defineProps({
  messages: Array
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
