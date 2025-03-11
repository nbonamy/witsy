<template>
  <div class="history">
    <div class="title">{{ t('createMedia.history.title') }}</div>
    <div v-if="history.length === 0" class="empty">{{ t('createMedia.history.empty') }}</div>
    <div v-else class="messages">
      <div 
        class="message" 
        :class="{ selected: msg.uuid === selectedMessage?.uuid }" 
        v-for="msg in history" 
        :key="msg.uuid" 
        @click="selectMessage(msg)" 
        @contextmenu.prevent="showContextMenu($event, msg)"
      >
        <BIconFilm class="thumbnail" v-if="msg.isVideo()"/>
        <img class="thumbnail" :src="msg.attachment.url" v-else/>
        <div class="description">
          <div class="content">{{ msg.content }}</div>
          <div class="info">{{ msg.engine }} - {{ msg.model }}</div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { t } from '../services/i18n'
import Message from '../models/message'

defineProps({
  history: {
    type: Array as () => Message[],
    required: true
  },
  selectedMessage: {
    type: Object as () => Message,
    default: null
  }
})

const emit = defineEmits(['select-message', 'context-menu'])

const selectMessage = (msg: Message) => {
  emit('select-message', msg)
}

const showContextMenu = (event: MouseEvent, msg: Message) => {
  emit('context-menu', { event, message: msg })
}
</script>

<style scoped>
.history {
  flex: 1;
  scrollbar-color: var(--sidebar-scroll-thumb-color) var(--sidebar-bg-color);
  overflow-y: auto;
  padding-bottom: 2rem;
  -webkit-app-region: no-drag;
}

.history > * {
  padding: 0px 24px;
}

.history .title {
  font-weight: bold;
  font-size: 1.1em;
  color: var(--text-color);
  margin-bottom: 1rem;
}

.history .empty {
  font-size: 11pt;
  opacity: 0.8;
}

.history .message {
  -webkit-app-region: no-drag;
  cursor: pointer;
  padding: 0.5rem !important;
  padding-right: 1rem !important;
  margin-bottom: 0.5rem !important;
  display: flex;
  flex-direction: row;
  align-items: center;
  border-radius: 4px;
  gap: 1rem;
}

.history .message .thumbnail {
  width: 3rem;
  height: 3rem;
  border-radius: 4px;
}
  
.history .message svg.thumbnail {
  fill: var(--sidebar-icon-color);
  padding: 0.5rem;
  width: 2rem;
  height: 2rem;
}

.history .message .description {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 11pt;
}

.history .message .description .content {
  max-height: 3.3rem;
  text-overflow: ellipsis;
  overflow: hidden;
}

.history .message .description .info {
  display: none;
  font-size: 10pt;
  font-style: italic;
}

.history .message.selected {
  background-color: var(--sidebar-selected-color);
}
</style>