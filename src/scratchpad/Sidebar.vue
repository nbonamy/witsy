<template>
  <div class="sp-sidebar">

    <header>
      <div class="title">{{ t('scratchpad.title') }}</div>
    </header>

    <main>
      <div class="form form-vertical">

        <div class="toolbar">

          <div class="form-field">
            <button @click="emitEvent('action', 'clear')">
              <FileIcon /><span>{{ t('common.clear') }}</span>
            </button>
          </div>

          <div class="form-field">
            <button @click="emitEvent('action', 'load')">
              <FolderOpenIcon /><span>{{ t('common.load') }}</span>
            </button>
          </div>

          <div class="form-field">
            <button @click="emitEvent('action', 'save')">
              <SaveIcon /><span>{{ t('common.save') }}</span>
            </button>
          </div>

        </div>

        <div class="form-field">
          <label>{{ t('scratchpad.fontFamily.title') }}</label>
          <select v-model="fontFamily" @change="onChangeFontFamily">
            <option value="serif">{{ t('scratchpad.fontFamily.serif') }}</option>
            <option value="sans-serif">{{ t('scratchpad.fontFamily.sansSerif') }}</option>
            <option value="monospace">{{ t('scratchpad.fontFamily.monospace') }}</option>
          </select>
        </div>

        <div class="form-field">
          <label>{{ t('scratchpad.fontSize.title') }}</label>
          <select v-model="fontSize" @change="onChangeFontSize">
            <option value="1">{{ t('scratchpad.fontSize.smaller') }}</option>
            <option value="2">{{ t('scratchpad.fontSize.small') }}</option>
            <option value="3">{{ t('scratchpad.fontSize.normal') }}</option>
            <option value="4">{{ t('scratchpad.fontSize.large') }}</option>
            <option value="5">{{ t('scratchpad.fontSize.larger') }}</option>
          </select>
        </div>

      </div>
    </main>

  </div>
</template>

<script setup lang="ts">

import { FileIcon, FolderOpenIcon, SaveIcon } from 'lucide-vue-next'
import { onMounted, ref, watch } from 'vue'
import useEventBus from '../composables/event_bus'
import { t } from '../services/i18n'

const { emitEvent } = useEventBus()

const props = defineProps({
  fontFamily: String,
  fontSize: String,
  modified: Boolean,
  fileUrl: String
})

const fontFamily = ref(null)
const fontSize = ref(null)

onMounted(() => {
  watch(() => props.fontFamily || {}, () => fontFamily.value = props.fontFamily, { immediate: true })
  watch(() => props.fontSize || {}, () => fontSize.value = props.fontSize, { immediate: true })
})

const onChangeFontFamily = () => {
  emitEvent('action', { type: 'fontFamily', value: fontFamily.value })
}

const onChangeFontSize = () => {
  emitEvent('action', { type: 'fontSize', value: fontSize.value })
}

</script>

<style scoped>

.sp-sidebar {
  flex: 0 0 var(--large-panel-width);

  .toolbar {
    display: flex;
    margin-bottom: 1rem;
  }
}

</style>