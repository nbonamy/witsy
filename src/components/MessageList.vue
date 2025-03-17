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
  <Fullscreen window="main" />
</template>

<script setup lang="ts">

import { Ref, ref, computed, onMounted, useTemplateRef, nextTick } from 'vue'
import { store } from '../services/store'
import { LlmChunk } from 'multi-llm-ts'
import MessageItem from './MessageItem.vue'
import Fullscreen from './Fullscreen.vue'
import Chat from '../models/chat'

import useEventBus from '../composables/event_bus'
const { onEvent } = useEventBus()

const divScroller: Ref<HTMLElement|null> = ref(null)
const overflown = ref(false)

const itemRefs = useTemplateRef<typeof MessageItem>('items')

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
  scrollDown()
})

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

</style>
