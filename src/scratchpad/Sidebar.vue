<template>
  <div class="sp-sidebar">

    <header>
      <div class="title">{{ t('scratchpad.title') }}</div>
      <ButtonIcon class="config" v-tooltip="{ text: t('common.settings'), position: 'bottom' }" @click="onSettings">
        <Settings2Icon />
      </ButtonIcon>
    </header>

    <main>
      <div class="form form-vertical">

        <div class="toolbar">

          <button @click="emitEvent('action', 'clear')">
            <FileIcon /><span>{{ t('common.new') }}</span>
          </button>

          <button @click="emitEvent('action', 'load')">
            <FolderOpenIcon /><span>{{ t('common.load') }}</span>
          </button>

          <div class="flex-push"></div>

          <button @click="emitEvent('action', 'save')">
            <SaveIcon /><span>{{ t('common.save') }}</span>
          </button>

        </div>

      </div>
    </main>

  </div>
</template>

<script setup lang="ts">

import { FileIcon, FolderOpenIcon, SaveIcon, Settings2Icon } from 'lucide-vue-next'
import ButtonIcon from '../components/ButtonIcon.vue'
import useEventBus from '../composables/event_bus'
import { t } from '../services/i18n'

const { emitEvent } = useEventBus()

defineProps({
  modified: Boolean,
  fileUrl: String
})

const onSettings = () => {
  emitEvent('action', 'settings')
}

</script>

<style scoped>

.sp-sidebar {
  flex: 0 0 var(--large-panel-width);

  .toolbar {
    display: flex;
    margin-bottom: 1rem;

    button {
      padding: 0.5rem;
    }
  }
}

</style>