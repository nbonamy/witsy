<template>
  <div class="messages-list" :style="fontStyle">
    <div class="messages" :class="[ chatTheme, 'size' + store.config.appearance.chat.fontSize ]" ref="divScroller" @wheel="onScroll">
      <div v-for="message in chat?.messages" :key="message.uuid">
        <MessageItem v-if="message.role != 'system'" :chat="chat" :message="message" class="message" @media-loaded="onMediaLoaded" ref="items" />
      </div>
    </div>
    <div v-if="overflown" class="overflow" @click="scrollDown">
      <BIconArrowDown />
    </div>
  </div>
  <div class="fullscreen" :class="fullScreenTheme" v-if="fullScreenImageUrl" @click="onCloseFullScreen">
    <img :src="fullScreenImageUrl"/>
    <BIconXLg class="close" />
  </div>
</template>

<script setup lang="ts">

import { type Ref, ref, computed, onMounted, useTemplateRef, nextTick } from 'vue'
import { store } from '../services/store'
import { type LlmChunk } from 'multi-llm-ts'
import Chat from '../models/chat'
import MessageItem from './MessageItem.vue'

import useEventBus from '../composables/event_bus'
const { onEvent } = useEventBus()

const divScroller: Ref<HTMLElement|null> = ref(null)
const overflown = ref(false)
const fullScreenImageUrl: Ref<string|null> = ref(null)
const fullScreenTheme: Ref<string|null> = ref(null)

const itemRefs = useTemplateRef('items')

const fontStyle = computed(() => {
  return {
    '--messages-font': store.config.appearance.chat.fontFamily,
  }
})

const chatTheme = computed(() => store.config.appearance.chat.theme)

const props = defineProps({
  chat: {
    type: Chat,
    required: true,
  },
  conversationMode: {
    type: String,
    required: true,
  }
})

onMounted(() => {
  onEvent('new-llm-chunk', onNewChunk)
  onEvent('fullscreen', onFullscreen)
  scrollDown()
})

const onFullscreen = (payload: string|strDict) => {
  document.addEventListener('keydown', onCloseFullScreen)
  fullScreenImageUrl.value = payload.url ?? payload
  fullScreenTheme.value = payload.theme
  window.api.fullscreen(true)
}

const onCloseFullScreen = () => {
  document.removeEventListener('keydown', onCloseFullScreen)
  fullScreenImageUrl.value = null
  window.api.fullscreen(false)
}

const onMediaLoaded = () => {
  if (!overflown.value) {
    scrollDown()
  }
}

const scrollDown = () => {
  nextTick(() => {
    divScroller.value!.scrollTop = divScroller.value!.scrollHeight
    overflown.value = false
  })
}

let scrollOnChunk = true
const onNewChunk = (chunk: LlmChunk) => {

  // reset on empty chunk
  if (!chunk) {
    scrollOnChunk = true
  }

  // only concerned with text chunks
  if (chunk?.type !== 'content') {
    return
  }

  // chunk if not disabled
  if (scrollOnChunk && !chunk?.done) {
    scrollDown()
  }

  // auto-read
  if (chunk?.done && props.conversationMode && itemRefs.value?.length) {
    const last: any = itemRefs.value[itemRefs.value.length - 1]
    last.readAloud()
  }

}

const onScroll = () => {
  overflown.value = divScroller.value!.scrollTop + divScroller.value!.clientHeight < divScroller.value!.scrollHeight
  scrollOnChunk = !overflown.value
}

</script>

<style scoped>

.messages-list {
  display: flex;
  position: relative;
  overflow: hidden;
  background-color: var(--message-list-bg-color);
  color: var(--message-list-text-color);
}

.messages {
  width: 100%;
  padding: 16px;
  overflow-y: auto;
  padding-top: 32px;
  scrollbar-color: var(--scrollbar-thumb-color) var(--scrollbar-bg-color);
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
  background-color: var(--message-list-overflow-bg-color);
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

.fullscreen.light {
  background-color: white;
}

</style>
