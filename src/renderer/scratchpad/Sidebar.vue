<template>
  <div class="sp-sidebar">

    <header>
      <div class="title">{{ t('scratchpad.title') }}</div>
      <ButtonIcon class="config" v-tooltip="{ text: t('common.settings'), position: 'bottom' }" @click="onSettings">
        <Settings2Icon />
      </ButtonIcon>
    </header>

    <main>
      <div class="history-section">
        <div class="history-title">{{ t('scratchpad.history.documents') }}</div>
        <History :scratchpads="scratchpads" :selectedScratchpad="selectedScratchpad" :contextMenuTarget="contextMenuTarget" @select-scratchpad="onSelectScratchpad" @context-menu="onContextMenu" />
      </div>
    </main>

    <footer>
      <button id="new-scratchpad-btn" class="cta" @click="toggleNewMenu">
        <PlusIcon />{{ t('scratchpad.new') }}
      </button>
      <ContextMenuPlus
        v-if="showNewMenu"
        anchor="#new-scratchpad-btn"
        position="above"
        :auto-close="true"
        @close="showNewMenu = false"
      >
        <div class="item" @click="onCreateEmpty">
          <NotebookPenIcon class="icon" />
          <span>{{ t('scratchpad.createEmpty') }}</span>
        </div>
        <div class="item" @click="onImport">
          <FileUpIcon class="icon" />
          <span>{{ t('scratchpad.importDocument') }}</span>
        </div>
      </ContextMenuPlus>
    </footer>

  </div>
</template>

<script setup lang="ts">

import { FileUpIcon, NotebookPenIcon, PlusIcon, Settings2Icon } from 'lucide-vue-next'
import ContextMenuPlus from '@components/ContextMenuPlus.vue'
import ButtonIcon from '@components/ButtonIcon.vue'
import History from './History.vue'
import { t } from '@services/i18n'
import { ScratchpadHeader } from 'types/index'
import { ref } from 'vue'

const emit = defineEmits(['action'])

defineProps({
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

const showNewMenu = ref(false)

const toggleNewMenu = () => {
  showNewMenu.value = !showNewMenu.value
}

const onSettings = () => {
  emit('action', 'settings')
}

const onCreateEmpty = () => {
  showNewMenu.value = false
  emit('action', 'clear')
}

const onImport = () => {
  showNewMenu.value = false
  emit('action', 'import')
}

const onSelectScratchpad = (scratchpad: ScratchpadHeader) => {
  emit('action', { type: 'select-scratchpad', value: scratchpad })
}

const onContextMenu = ({ event, scratchpad }: { event: MouseEvent, scratchpad: ScratchpadHeader }) => {
  emit('action', { type: 'context-menu', value: { event, scratchpad } })
}

</script>

<style scoped>

.sp-sidebar {
  flex: 0 0 var(--large-panel-width);
  display: flex;
  flex-direction: column;
  min-height: 0;

  main {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
    overflow: hidden;
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

  footer {
    flex-shrink: 0;
  }
}

</style>