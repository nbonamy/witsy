<template>
  <div class="sp-sidebar">

    <header>
      <div class="title">{{ t('scratchpad.title') }}</div>
      <ButtonIcon class="import" v-tooltip="{ text: t('common.import'), position: 'bottom' }" @click="onImport">
        <FileUpIcon />
      </ButtonIcon>
      <ButtonIcon class="config" v-tooltip="{ text: t('common.settings'), position: 'bottom' }" @click="onSettings">
        <Settings2Icon />
      </ButtonIcon>
    </header>

    <main>
      <div class="toolbar">
        <button @click="emitEvent('action', 'clear')">
          <FileIcon /><span>{{ t('common.new') }}</span>
        </button>

        <button @click="emitEvent('action', 'save')">
          <SaveIcon /><span>{{ t('common.save') }}</span>
        </button>
      </div>

      <div class="history-section">
        <div class="history-title">{{ t('scratchpad.history.documents') }}</div>
        <History :scratchpads="scratchpads" :selectedScratchpad="selectedScratchpad" :contextMenuTarget="contextMenuTarget" @select-scratchpad="onSelectScratchpad" @context-menu="onContextMenu" />
      </div>
    </main>

  </div>
</template>

<script setup lang="ts">

import { FileIcon, FileUpIcon, SaveIcon, Settings2Icon } from 'lucide-vue-next'
import ButtonIcon from '../components/ButtonIcon.vue'
import History from './History.vue'
import useEventBus from '../composables/event_bus'
import { t } from '../services/i18n'
import { ScratchpadHeader } from '../types/index'

const { emitEvent } = useEventBus()

defineProps({
  modified: Boolean,
  fileUrl: String,
  scratchpads: {
    type: Array as () => ScratchpadHeader[],
    default: (): ScratchpadHeader[] => []
  },
  selectedScratchpad: {
    type: Object as () => ScratchpadHeader | null,
    default: (): ScratchpadHeader | null => null
  },
  contextMenuTarget: {
    type: Object as () => ScratchpadHeader | null,
    default: (): ScratchpadHeader | null => null
  }
})

const onSettings = () => {
  emitEvent('action', 'settings')
}

const onImport = () => {
  emitEvent('action', 'import')
}

const onSelectScratchpad = (scratchpad: ScratchpadHeader) => {
  emitEvent('action', { type: 'select-scratchpad', value: scratchpad })
}

const onContextMenu = ({ event, scratchpad }: { event: MouseEvent, scratchpad: ScratchpadHeader }) => {
  emitEvent('action', { type: 'context-menu', value: { event, scratchpad } })
}

</script>

<style scoped>

.sp-sidebar {
  flex: 0 0 var(--large-panel-width);

  main {
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .toolbar {
    flex: 0 0 auto;
    display: flex;
    margin-bottom: 1.5rem;

    button {
      padding: 0.5rem;
    }
  }

  .history-section {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    min-height: 0;
  }

  .history-title {
    flex: 0 0 auto;
    font-size: 15px;
    font-weight: var(--font-weight-semibold);
    color: var(--sidebar-text-color);
    margin-bottom: 0.75rem;
    padding-left: 0.25rem;
  }

  .history-section :deep(.history) {
    flex: 1;
    overflow-y: auto;
    min-height: 0;
  }
}

</style>