<template>
  <div class="action read" v-if="message.role == 'assistant' && message.type == 'text' && !message.transient" @click="onToggleRead(message)">
    <span v-if="mgsAudioState(message) == 'playing'"><StopCircleIcon/> {{ t('common.stop') }}</span>
    <span v-else-if="mgsAudioState(message) == 'loading'"><XCircleIcon/> {{ t('common.cancel') }}</span>
    <span v-else><PlayCircleIcon /> {{ t('common.read') }}</span>
  </div>
</template>

<script setup lang="ts">

import { PlayCircleIcon, StopCircleIcon, XCircleIcon } from 'lucide-vue-next'
import Message from '../models/message'
import { t } from '../services/i18n'

const props = defineProps({
  message: {
    type: Message,
    required: true,
  },
  audioState: {
    type: Object,
    required: true,
  },
  readAloud: {
    type: Function,
    required: true,
  },
})

const mgsAudioState = (message: Message) => {
  return message.uuid == props.audioState.messageId ? props.audioState.state : 'idle'
}

const onToggleRead = async (message: Message) => {
  props.readAloud(message)
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
  position: relative;
  top: 1.5px;
}

</style>