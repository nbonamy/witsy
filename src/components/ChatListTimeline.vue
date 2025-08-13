<template>
  <section v-for="c in chats" :key="c.uuid" :set="chatDay=getDay(c)">
    <div v-if="store.isFeatureEnabled('chat.dates') && chatDay != currDay" :set="currDay = chatDay" class="day">{{ currDay }}</div>
    <ChatListItem :chat="c" :selection="selection" :active="active" :selectMode="selectMode" @click="onSelectChat(c)" @contextmenu.prevent="showContextMenu($event, c)" :data-day="chatDay" />
  </section>
</template>

<script setup lang="ts">

import { t } from '../services/i18n'
import { store } from '../services/store'
import ChatListItem from './ChatListItem.vue'
import Chat from '../models/chat'

defineProps({
  chats: {
    type: Array<Chat>,
    required: true,
  },
  selection: {
    type: Array<String>,
    required: true,
  },
  active: {
    type: Chat,
    default: null,
  },
  selectMode: {
    type: Boolean,
    default: false,
  }
})

let currDay: string|null = null
let chatDay: string

const emit = defineEmits(['select', 'menu'])

const getDay = (chat: Chat) => {
  const now = new Date()
  const oneDay = 24 * 60 * 60 * 1000
  const diff = Date.now() - chat.lastModified
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  const yesterdayStart = todayStart - 86400000

  if (chat.lastModified >= todayStart) return t('chatList.timeline.today')
  if (chat.lastModified >= yesterdayStart) return t('chatList.timeline.yesterday')
  if (diff < 7 * oneDay) return t('chatList.timeline.last7days')
  if (diff < 14 * oneDay) return t('chatList.timeline.last14days')
  if (diff < 30 * oneDay) return t('chatList.timeline.last30days')
  return t('chatList.timeline.earlier')
}

const onSelectChat = (chat: Chat) => {
  emit('select', chat)
}

const showContextMenu = (event: MouseEvent, chat: Chat) => {
  emit('menu', event, chat)
}

</script>

<style scoped>

.day {
  margin: 12px 0 8px;
  padding: 0 12px;
  font-size: 9pt;
  font-weight: bold;
  text-transform: uppercase;
  color: var(--sidebar-section-title-color);
}

section:first-child .day {
  margin-top: 0;
}

</style>
