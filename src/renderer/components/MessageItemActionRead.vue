<template>
  <div class="action read" v-if="message.role == 'assistant' && message.type == 'text' && !message.transient" @click="onToggleRead(message)">
    <template v-if="mgsAudioState(message) == 'playing'"><SquareIcon/> {{ t('common.stop') }}</template>
    <template v-else-if="mgsAudioState(message) == 'loading'"><XIcon/> {{ t('common.cancel') }}</template>
    <template v-else><PlayIcon /> {{ t('common.read') }}</template>
  </div>
</template>

<script setup lang="ts">

import { PlayIcon, SquareIcon, XIcon } from 'lucide-vue-next'
import Message from '@models/message'
import { t } from '@services/i18n'

const props = defineProps({
  message: {
    type: Message,
    required: true,
  },
  audioState: {
    type: Object,
    required: false,
  },
  readAloud: {
    type: Function,
    required: false,
  },
})

const mgsAudioState = (message: Message) => {
  return message.uuid == props.audioState?.messageId ? props.audioState?.state : 'idle'
}

const onToggleRead = async (message: Message) => {
  props.readAloud?.(message)
}

</script>
