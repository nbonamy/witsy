<template>
  <div class="action copy" v-if="message.role == 'assistant' && !message.transient" @click="onCopy">
    <BIconClipboard /> {{ copyLabel }}
  </div>
</template>

<script setup lang="ts">

import { ref } from 'vue'
import { t } from '../services/i18n'
import { removeMarkdown } from '@excalidraw/markdown-to-text'
import Message from '../models/message'
import Dialog from '../composables/dialog'

const props = defineProps({
  message: {
    type: Message,
    required: true,
  }
})

const copyLabel = ref(t('common.copy'))

const onCopy = () => {
  if (props.message.type == 'text') {

    const textToCopy = removeMarkdown(props.message.content, {
      listUnicodeChar: '',
      stripListLeaders: false,
    })

    // try both ways
    if (!window.api.clipboard.writeText(textToCopy)) {
      navigator.clipboard.writeText(textToCopy)
        .catch(err => {
          Dialog.alert(t('common.errorCopyClipboard'), t('common.tryAgain'))
        })
    }
  
  } else if (props.message.type == 'image') {
    window.api.clipboard.writeImage(props.message.content)
  }
  copyLabel.value = t('common.copied')
  setTimeout(() => copyLabel.value = t('common.copy'), 1000)
}

defineExpose({
  copy: onCopy,
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