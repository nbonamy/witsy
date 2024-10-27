<template>
  <div class="action copy" v-if="message.role == 'assistant' && !message.transient" @click="onCopy(message)">
    <BIconClipboard /> {{ copyLabel }}
  </div>
</template>

<script setup>

import { ref } from 'vue'
import Message from '../models/message'

const props = defineProps({
  message: Object,
})

const copyLabel = ref('Copy')

const onCopy = (message) => {
  if (message.type == 'text') {
    window.api.clipboard.writeText(message.content)
  } else if (message.type == 'image') {
    window.api.clipboard.writeImage(message.content)
  }
  copyLabel.value = 'Copied!'
  setTimeout(() => copyLabel.value = 'Copy', 1000)
}

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