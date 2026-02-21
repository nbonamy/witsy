<template>
  <div class="messages-list" :style="fontStyle">
    <div class="messages" :class="[ chatTheme, 'size' + store.config.appearance.chat.fontSize ]" ref="divScroller" @scroll="onScroll">
      <div v-for="message in chat?.messages" :key="message.uuid">
        <MessageItem v-if="message.role != 'system'" :chat="chat" :message="message" class="message" @media-loaded="onMediaLoaded" ref="items" />
      </div>
    </div>
    <div v-if="overflown" class="overflow" @click="scrollDown">
      <ArrowDownIcon />
    </div>
  </div>
</template>

<script setup lang="ts">

import { ChatTheme } from '@/types/config'
import useIpcListener from '@composables/ipc_listener'
import Chat from '@models/chat'
import { SearchState } from '@screens/Chat.vue'
import { t } from '@services/i18n'
import { store } from '@services/store'
import { ArrowDownIcon } from 'lucide-vue-next'
import { LlmChunk } from 'multi-llm-ts'
import { computed, inject, nextTick, onMounted, PropType, ref, Ref, useTemplateRef, watch } from 'vue'
import MessageItem from './MessageItem.vue'

const { onIpcEvent } = useIpcListener()

// inject search state from parent Chat component
const searchState = inject<SearchState>('searchState')

// inject chunk from parent Chat component (scoped to component tree)
const latestChunk = inject<Ref<LlmChunk | null>>('latestChunk')
if (latestChunk === undefined) {
  console.warn('[MessageList] latestChunk not provided - parent component must provide("latestChunk", ref<LlmChunk|null>)')
}

const divScroller = ref<HTMLElement|null>(null)
const overflown = ref(false)

const itemRefs = useTemplateRef<typeof MessageItem>('items')

const fontStyle = computed(() => {
  return {
    '--font-family-base': store.config.appearance.chat.fontFamily,
  }
})

const chatTheme = computed(() => props.theme ?? store.config.appearance.chat.theme)

const props = defineProps({
  chat: {
    type: Chat,
    required: true,
  },
  theme: {
    type: String as PropType<ChatTheme>,
    required: false,
  },
  conversationMode: {
    type: String,
    required: true,
  }
})

onMounted(() => {
  onIpcEvent('read-aloud-selection', onReadAloudSelection)
  scrollDown()
})

// watch for chunk updates from parent
if (latestChunk) {
  watch(latestChunk, (chunk) => {
    onNewChunk(chunk)
  })
}

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
  if (chunk?.done && props.conversationMode !== 'off' && itemRefs.value?.length) {
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
  if (!searchState?.filter.value) {
    divScroller.value?.focus()
  }
}

defineExpose({
  scroller: divScroller,
})

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
  position: relative;
  width: 100%;
  padding: 16px;
  overflow-y: auto;
  padding-top: 32px;
  outline: none;
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
  font-size: 18.5px;
  font-weight: bold;
  cursor: pointer;
}

</style>
