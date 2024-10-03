<template>
  <div class="container">
    <div class="messages" :class="chatTheme" ref="divScroller" @wheel="onScroll">
      <div v-for="message in chat?.messages" :key="message.uuid">
        <MessageItem v-if="message.role != 'system'" :chat="chat" :message="message" class="message" @image-loaded="onImageLoaded" />
      </div>
    </div>
    <div v-if="overflown" class="overflow" @click="scrollDown">
      <BIconArrowDown />
    </div>
  </div>
  <div class="fullscreen" v-if="fullScreenImageUrl" @click="onCloseFullScreen">
    <img :src="fullScreenImageUrl"/>
    <BIconXLg class="close" />
  </div>
</template>

<script setup>

import { ref, computed, onMounted, nextTick } from 'vue'
import { store } from '../services/store'
import Chat from '../models/chat'
import MessageItem from './MessageItem.vue'

import useEventBus from '../composables/event_bus'
const { onEvent } = useEventBus()

const divScroller = ref(null)
const overflown = ref(false)
const fullScreenImageUrl = ref(null)

const chatTheme = computed(() => store.config.appearance.chat.theme)

defineProps({
  chat: Chat
})

onMounted(() => {
  onEvent('newChunk', onNewChunk)
  onEvent('fullScreen', onFullscreen)
  scrollDown()
})

const onFullscreen = (imageUrl) => {
  fullScreenImageUrl.value = imageUrl
  window.api.fullscreen(true)
}

const onCloseFullScreen = () => {
  fullScreenImageUrl.value = null
  window.api.fullscreen(false)
}

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
  padding-top: 32px;
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

.fullscreen {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: black;
  padding: 8px;
  z-index: 100;
  cursor: pointer;
  -webkit-app-region: no-drag;
}

.fullscreen img {
  height: 100%;
  width: 100%;
  object-fit: contain;
}

.fullscreen .close {
  color: white;
  position: absolute;
  top: 16px;
  right: 16px;
  font-size: 14pt;
}

</style>
