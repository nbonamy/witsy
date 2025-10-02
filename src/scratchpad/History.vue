<template>
  <div class="history">
    <div v-if="scratchpads.length === 0" class="empty">{{ t('scratchpad.history.empty') }}</div>
    <div v-else class="messages">
      <div
        v-for="scratchpad in scratchpads"
        :id="`scratchpad-${scratchpad.uuid}`"
        class="message"
        :class="{
          selected: selectedScratchpad?.uuid === scratchpad.uuid,
          'context-target': contextMenuTarget?.uuid === scratchpad.uuid
        }"
        :key="scratchpad.uuid"
        @click="selectScratchpad(scratchpad)"
        @contextmenu.prevent="showContextMenu($event, scratchpad)"
      >
        <div class="icon leading">
          <FileTextIcon />
        </div>
        <div class="info">
          <div class="text">{{ scratchpad.title }}</div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { FileTextIcon } from 'lucide-vue-next'
import { t } from '../services/i18n'
import { ScratchpadHeader } from '../types/index'

defineProps({
  scratchpads: {
    type: Array as () => ScratchpadHeader[],
    required: true
  },
  selectedScratchpad: {
    type: Object as () => ScratchpadHeader | null,
    default: null
  },
  contextMenuTarget: {
    type: Object as () => ScratchpadHeader | null,
    default: null
  }
})

const emit = defineEmits(['select-scratchpad', 'context-menu'])

const selectScratchpad = (scratchpad: ScratchpadHeader) => {
  emit('select-scratchpad', scratchpad)
}

const showContextMenu = (event: MouseEvent, scratchpad: ScratchpadHeader) => {
  emit('context-menu', { event, scratchpad })
}

</script>

<style scoped>

.history {
  overflow-y: auto;
  padding-bottom: 2rem;
}

.history .empty {
  padding-left: 0.25rem;
  font-size: 14.5px;
  opacity: 0.8;
}

.history .message {
  cursor: pointer;
  padding: 0.5rem 0rem !important;
  padding-right: 1rem !important;
  margin-bottom: 0.5rem !important;
  display: flex;
  flex-direction: row;
  align-items: center;
  border-radius: 4px;
  border: 1px solid transparent;
  gap: 0.25rem;
  word-break: break-word;
  overflow: hidden;
}

.history .message .icon {
  color: var(--sidebar-icon-color);
  width: var(--icon-md);
  height: var(--icon-md);
  flex-shrink: 0;
}

.history .message .info {
  flex: 1;
  display: flex;
  flex-direction: column;
  font-size: 14.5px;
}

.history .message .info .text {
  max-height: 1.5rem;
  text-overflow: ellipsis;
  overflow: hidden;
  white-space: nowrap;
}

.history .message.selected {
  background-color: var(--sidebar-selected-color);
}

.history .message.context-target {
  border: 1px solid var(--sidebar-selected-color);
}
</style>
