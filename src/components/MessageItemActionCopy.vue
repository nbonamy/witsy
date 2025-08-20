<template>
  <div class="action copy" v-if="!message.transient" @click="onCopy">
    <ClipboardIcon /> {{ copyLabel }}
  </div>
</template>

<script setup lang="ts">

import { removeMarkdown } from '@excalidraw/markdown-to-text'
import { ClipboardIcon } from 'lucide-vue-next'
import { ref } from 'vue'
import Dialog from '../composables/dialog'
import Message from '../models/message'
import { t } from '../services/i18n'

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
