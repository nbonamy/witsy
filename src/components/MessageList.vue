<template>
  <div class="container">
    <div class="messages" :class="chatTheme" ref="divScroller" @wheel="onScroll">
      <div v-for="message in chat.messages" :key="message.uuid">
        <MessageItem v-if="message.role != 'system'" :chat="chat" :message="message" class="message" @image-loaded="onImageLoaded" />
      </div>
    </div>
    <div v-if="overflown" class="overflow" @click="scrollDown">
      <BIconArrowDown />
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

const divScroller = ref(null)
const overflown = ref(false)

const chatTheme = computed(() => store.config.appearance.chat.theme)

defineProps({
  chat: Chat
})

onMounted(() => {
  onEvent('newChunk', onNewChunk)
  scrollDown()
})

const onImageLoaded = (message) => {
  if (!overflown.value) {
    scrollDown()
  }
}

const scrollDown = () => {
  nextTick(() => {
    divScroller.value.scrollTop = divScroller.value.scrollHeight
    overflown.value = false
  })
}

let scrollOnChunk = true
const onNewChunk = (chunk) => {

  // reset on empty chunk
  if (!chunk) {
    scrollOnChunk = true
  }

  // chunk if not disabled
  if (scrollOnChunk && !chunk?.done) {
    scrollDown()
  }

}

const onScroll = () => {
  overflown.value = divScroller.value.scrollTop + divScroller.value.clientHeight < divScroller.value.scrollHeight
  scrollOnChunk = !overflown.value
}

</script>

<style scoped>

.container {
  height: 100vh;
  display: flex;
  position: relative;
  overflow: hidden;
}

.messages {
  width: 100%;
  padding: 16px;
  overflow-y: auto;
}

.overflow {
  position: absolute;
  bottom: 32px;
  left: 50%;
  display: flex;
  justify-content: center;
  align-items: center;
  width: 22pt;
  height: 22pt;
  margin-left: -11pt;
  border-radius: 11pt;
  background-color: white;
  border: 1px solid #ccc;
  font-size: 14pt;
  font-weight: bold;
  cursor: pointer;
}

</style>
