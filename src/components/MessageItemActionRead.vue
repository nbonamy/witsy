<template>
  <div class="action read" v-if="message.role == 'assistant' && message.type == 'text' && !message.transient" @click="onToggleRead(message)">
    <span v-if="mgsAudioState(message) == 'playing'"><BIconStopCircle/> {{ t('common.stop') }}</span>
    <span v-else-if="mgsAudioState(message) == 'loading'"><BIconXCircle/> {{ t('common.cancel') }}</span>
    <span v-else><BIconPlayCircle /> {{ t('common.read') }}</span>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
const { t } = useI18n()

import Message from '../models/message'

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