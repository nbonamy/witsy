<template>
  <div class="action copy" v-if="!message.transient" @click="onCopy">
    <BIconClipboard /> {{ copyLabel }}
  </div>
</template>

<script setup lang="ts">

import { ref } from 'vue'
import { t } from '../services/i18n'
import { store } from '../services/store'
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

const onCopy = (event: MouseEvent) => {
  if (props.message.type == 'text') {

    let textToCopy = removeMarkup(props.message.content)

    const isShift = event ? event.shiftKey : false

    if ((store.config.appearance.chat.copyFormat === 'text' && !isShift) || (store.config.appearance.chat.copyFormat === 'markdown' && isShift)) {
      textToCopy = removeMarkdown(textToCopy, {
        listUnicodeChar: '',
        stripListLeaders: false,
      })
    }
    
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

const removeMarkup = (text: string): string => {

  // remove <tool id="call_r0SxqnSwl1FRo7alxseVpVDz"></tool>
  let cleaned = text.replace(/<tool[^>]*>.*?<\/tool>/g, '')

  // done
  return cleaned

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