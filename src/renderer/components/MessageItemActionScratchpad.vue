<template>
  <div class="action scratchpad" v-if="!message.transient && message.role === 'assistant' && message.type === 'text'" @click="onScratchpad">
    <FileEditIcon /> {{ t('common.write') }}
  </div>
</template>

<script setup lang="ts">

import { FileEditIcon } from 'lucide-vue-next'
import Message from '../../models/message'
import { t } from '../services/i18n'
import { store } from '../services/store'

const props = defineProps({
  message: {
    type: Message,
    required: true,
  }
})

const removeMarkup = (text: string): string => {
  // remove <tool id="call_r0SxqnSwl1FRo7alxseVpVDz"></tool>
  let cleaned = text.replace(/<tool[^>]*>.*?<\/tool>/g, '')
  // done
  return cleaned
}

const onScratchpad = () => {
  const content = removeMarkup(props.message.content)

  // Create a new scratchpad with the content
  const uuid = window.api.scratchpad.create(store.config.workspaceId, content)

  // Open scratchpad with the UUID
  window.api.scratchpad.open(store.config.workspaceId, uuid)
}

</script>
