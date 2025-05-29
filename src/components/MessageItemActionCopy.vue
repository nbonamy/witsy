<template>
  <div class="action copy" v-if="message.role == 'assistant' && !message.transient" @click="copy">
    <BIconClipboard /> {{ copyLabel }}
  </div>
</template>

<script setup lang="ts">

import { ref } from 'vue'
import { t } from '../services/i18n'
import Message from '../models/message'
import { removeMarkdown } from '@excalidraw/markdown-to-text'

const props = defineProps({
  message: {
    type: Message,
    required: true,
  }
})

const copyLabel = ref(t('common.copy'))

const copy = () => {
  if (props.message.type == 'text') {
    window.api.clipboard.writeText(removeMarkdown(props.message.content, {
      listUnicodeChar: '',
      stripListLeaders: false,
    }))
  } else if (props.message.type == 'image') {
    window.api.clipboard.writeImage(props.message.content)
  }
  copyLabel.value = t('common.copied')
  setTimeout(() => copyLabel.value = t('common.copy'), 1000)
}

defineExpose({
  copy
})
</script>

<style scoped>
.action {
  display: flex;
  flex-direction: row;
  align-items: center;
}
svg {
  margin-right: 4px;
}
</style>