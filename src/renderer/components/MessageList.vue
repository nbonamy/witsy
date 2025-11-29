<template>
  <div class="messages-list" :style="fontStyle">
    <div class="messages" :class="[ chatTheme, 'size' + store.config.appearance.chat.fontSize ]" ref="divScroller" @scroll="onScroll">
      <div v-if="hasOlderMessages" class="load-more" ref="loadSentinel">
        <span class="tag">
          {{ isLoadingOlder ? t('chat.lazyLoad.loading') : t('chat.lazyLoad.scrollUp') }}
        </span>
      </div>
      <div v-for="message in visibleMessages" :key="message.uuid">
        <MessageItem v-if="message.role != 'system'" :chat="chat" :message="message" class="message" @media-loaded="onMediaLoaded" ref="items" />
      </div>
    </div>
    <div v-if="overflown" class="overflow" @click="scrollDown">
      <ArrowDownIcon />
    </div>
  </div>
</template>

<script setup lang="ts">

import { ArrowDownIcon } from 'lucide-vue-next'
import { LlmChunk } from 'multi-llm-ts'
import { computed, nextTick, onMounted, onBeforeUnmount, ref, useTemplateRef, watch } from 'vue'
import Chat from '@models/chat'
import { store } from '@services/store'
import { t } from '@services/i18n'
import MessageItem from './MessageItem.vue'

import useEventBus from '@composables/event_bus'
const { onEvent } = useEventBus()

const divScroller = ref<HTMLElement|null>(null)
const loadSentinel = ref<HTMLElement|null>(null)
const overflown = ref(false)

const itemRefs = useTemplateRef<typeof MessageItem>('items')

// Lazy loading state
const INITIAL_MESSAGE_COUNT = 20
const LOAD_MORE_COUNT = 20
const SCROLL_THRESHOLD = 200

const displayedMessageCount = ref(INITIAL_MESSAGE_COUNT)
const isLoadingOlder = ref(false)

const fontStyle = computed(() => {
  return {
    '--font-family-base': store.config.appearance.chat.fontFamily,
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

// Computed properties for lazy loading
const allMessages = computed(() => {
  return props.chat?.messages?.filter(m => m.role !== 'system') || []
})

const visibleMessages = computed(() => {
  const messages = allMessages.value
  // Show the LAST N messages (most recent at bottom)
  return messages.slice(-displayedMessageCount.value)
})

const hasOlderMessages = computed(() => {
  return allMessages.value.length > displayedMessageCount.value
})

// Reset displayed count when chat changes
watch(() => props.chat?.uuid, () => {
  displayedMessageCount.value = INITIAL_MESSAGE_COUNT
})

onMounted(() => {
  onEvent('new-llm-chunk', onNewChunk)
  window.api.on('read-aloud-selection', onReadAloudSelection)
  scrollDown()
})

onBeforeUnmount(() => {
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

const loadOlderMessages = async () => {
  if (isLoadingOlder.value || !hasOlderMessages.value) {
    return
  }

  isLoadingOlder.value = true

  // Save current scroll position
  const oldScrollHeight = divScroller.value!.scrollHeight
  const oldScrollTop = divScroller.value!.scrollTop

  // Load more messages
  displayedMessageCount.value = Math.min(
    displayedMessageCount.value + LOAD_MORE_COUNT,
    allMessages.value.length
  )

  // Wait for DOM to update
  await nextTick()

  // Restore scroll position (adjust for new content height)
  const newScrollHeight = divScroller.value!.scrollHeight
  const scrollDelta = newScrollHeight - oldScrollHeight
  divScroller.value!.scrollTop = oldScrollTop + scrollDelta

  isLoadingOlder.value = false
}

const onScroll = () => {
  if (!divScroller.value) return

  overflown.value = divScroller.value.scrollTop + divScroller.value.clientHeight < divScroller.value.scrollHeight - 1
  scrollOnChunk = !overflown.value

  // Load older messages when scrolling near top
  if (hasOlderMessages.value && divScroller.value.scrollTop < SCROLL_THRESHOLD) {
    loadOlderMessages()
  }

  divScroller.value.focus()
}

</script>

<style scoped>

.messages-list {
  display: flex;
  position: relative;
  overflow-y: hidden;
  background-color: var(--message-list-bg-color);
  color: var(--message-list-text-color);
}

.messages {
  width: 100%;
  padding: 16px;
  overflow-y: auto;
  padding-top: 32px;
  outline: none;
  scrollbar-color: var(--scrollbar-thumb-color) var(--scrollbar-bg-color);
}

.load-more {
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 12px;
  margin-bottom: 16px;

  .tag {
    padding: 0.375rem 0.75rem;
    font-size: var(--font-size-12);
  }
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
  font-size: 18.5px;
  font-weight: bold;
  cursor: pointer;
}

</style>
