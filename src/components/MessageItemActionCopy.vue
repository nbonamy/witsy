<template>
  <div class="action copy" v-if="message.role == 'assistant' && !message.transient" @click="copy">
    <BIconClipboard /> {{ copyLabel }}
  </div>
</template>

<script setup lang="ts">

import { ref } from 'vue'
import Message from '../models/message'

const props = defineProps({
  message: {
    type: Message,
    required: true,
  }
})

const copyLabel = ref('Copy')

const copy = () => {
  if (props.message.type == 'text') {
    window.api.clipboard.writeText(props.message.content)
  } else if (props.message.type == 'image') {
    window.api.clipboard.writeImage(props.message.content)
  }
  copyLabel.value = 'Copied!'
  setTimeout(() => copyLabel.value = 'Copy', 1000)
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