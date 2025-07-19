<template>
  <div class="history">
    <div v-if="history.length === 0" class="empty">{{ t('designStudio.history.empty') }}</div>
    <div v-else class="messages">
      <div 
        v-for="msg in history" 
        class="message" 
        :class="{ selected: selectedMessages.some(m => m.uuid === msg.uuid) }" 
        :key="msg.uuid" 
        @click="selectMessage($event, msg)" 
        @contextmenu.prevent="showContextMenu($event, msg)"
      >
        <video v-if="msg.isVideo()" class="thumbnail" :src="msg.attachments?.[0].url" />
        <img v-else class="thumbnail" :src="msg.attachments?.[0].url" />
        <div class="description">
          <div class="prompt">{{ msg.content }}</div>
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
  selectedMessages: {
    type: Array as () => Message[],
    default: () => [] as Message[]
  }
})

const emit = defineEmits(['select-message', 'context-menu'])

const selectMessage = (event: MouseEvent, msg: Message) => {
  emit('select-message', { event, message: msg })
}

const showContextMenu = (event: MouseEvent, msg: Message) => {
  emit('context-menu', { event, message: msg })
}

</script>


<style scoped>

.history {
  overflow-y: auto;
  padding-bottom: 2rem;
}

.history > * {
  padding: 0px 24px;
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
  word-break: break-word;
  overflow: hidden;
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

.history .message .description .prompt {
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