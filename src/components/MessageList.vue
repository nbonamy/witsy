<template>
  <div class="messages-list" :style="fontStyle">
    <div class="messages" :class="[ chatTheme, 'size' + store.config.appearance.chat.fontSize ]" ref="divScroller" @scroll="onScroll">
      <div v-for="message in chat?.messages" :key="message.uuid">
        <MessageItem v-if="message.role != 'system'" :chat="chat" :message="message" class="message" @media-loaded="onMediaLoaded" ref="items" />
      </div>
    </div>
    <div v-if="overflown" class="overflow" @click="scrollDown">
      <BIconArrowDown />
    </div>
  </div>
</template>

<script setup lang="ts">

import { ref, computed, onMounted, useTemplateRef, nextTick, onUnmounted } from 'vue'
import { store } from '../services/store'
import { LlmChunk } from 'multi-llm-ts'
import MessageItem from './MessageItem.vue'
import Chat from '../models/chat'

import useEventBus from '../composables/event_bus'
const { onEvent } = useEventBus()

const divScroller = ref<HTMLElement|null>(null)
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
  window.api.on('read-aloud-selection', onReadAloudSelection)
  scrollDown()
})

onUnmounted(() => {
  window.api.off('read-aloud-selection', onReadAloudSelection)
})

const onReadAloudSelection = (payload: { context: string, selection: string }) => {
  for (const index in itemRefs.value) {
    const item = itemRefs.value[index]
    if (item.message.uuid === payload.context) {
      item.readAloud(payload.selection)
      return
    }
  }
}

const onMediaLoaded = () => {
  if (!overflown.value) {
    scrollDown()
  }
}

const scrollDown = async () => {
  await nextTick()
  divScroller.value!.scrollTop = divScroller.value!.scrollHeight
  overflown.value = false
  await nextTick()
}

let scrollOnChunk = true
let avatar: HTMLElement | null = null
const onNewChunk = async (chunk: LlmChunk) => {

  // scroll down on a new chunk
  if (!chunk || (chunk.type === 'content' && chunk.text === '' && !chunk.done)) {
    await scrollDown()
    scrollOnChunk = true
    avatar = null
  }

  // if we do not referenced the last avatar yet, we need to find it
  if (!avatar) {
    const avatars = document.querySelectorAll<HTMLElement>('.message .avatar')
    avatar = avatars[avatars.length - 1]
  }

  // we don't want to scroll past the avatar
  if (avatar && divScroller.value) {
    const rc = avatar.getBoundingClientRect()
    const messagesListRect = divScroller.value.getBoundingClientRect()
    if (rc && messagesListRect && rc.top - rc.height < messagesListRect.top + 16) {
      scrollOnChunk = false
      overflown.value = true
    }
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

  // clear
  if (chunk?.done) {
    scrollOnChunk = true
    avatar = null
  }

}

const onScroll = () => {
  overflown.value = divScroller.value!.scrollTop + divScroller.value!.clientHeight < divScroller.value!.scrollHeight - 1
  scrollOnChunk = !overflown.value
  divScroller.value?.focus()
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
