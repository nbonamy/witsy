<template>
  <div class="actions">
    <div class="action copy" v-if="message.role == 'assistant' && !message.transient" @click="onCopy(message)">
      <BIconClipboard /> {{ copyLabel }}
    </div>
    <div class="action read" v-if="message.role == 'assistant' && message.type == 'text' && !message.transient" @click="onToggleRead(message)">
      <span v-if="mgsAudioState(message) == 'playing'"><BIconStopCircle/> Stop</span>
      <span v-else-if="mgsAudioState(message) == 'loading'"><BIconXCircle/> Cancel</span>
      <span v-else><BIconPlayCircle /> Read</span>
      <audio/>
    </div>
    <div class="action edit" v-if="message.role == 'user' && message.type == 'text' && !message.transient" @click="onEdit(message)">
      <BIconPencil /> Edit
    </div>
  </div>
</template>

<script setup>

import { ref, onMounted, onUnmounted } from 'vue'
import { store } from '../services/store'
import useAudioPlayer from '../composables/audio_player'
import Message from '../models/message'

import useEventBus from '../composables/event_bus'
const { emitEvent } = useEventBus()

// init stuff
const audioPlayer = useAudioPlayer(store.config)

const props = defineProps({
  message: Message
})

const copyLabel = ref('Copy')
const audioState = ref({
  state: 'idle',
  messageId: null,
})

onMounted(() => {
  audioPlayer.addListener(onAudioPlayerStatus)
})

onUnmounted(() => {
  audioPlayer.removeListener(onAudioPlayerStatus)
})

const mgsAudioState = (message) => {
  return message.uuid == audioState.value.messageId ? audioState.value.state : 'idle'
}

const onCopy = (message) => {
  if (message.type == 'text') {
    window.api.clipboard.writeText(message.content)
  } else if (message.type == 'image') {
    window.api.clipboard.writeImage(message.content)
  }
  copyLabel.value = 'Copied!'
  setTimeout(() => copyLabel.value = 'Copy', 1000)
}

const onAudioPlayerStatus = (status) => {
  audioState.value = { state: status.state, messageId: status.uuid }
}

const onToggleRead = async (message) => {
  await audioPlayer.play(document.querySelector('.read audio'), message.uuid, message.content)
}

const onEdit = (message) => {
  emitEvent('set-prompt', message)
}

</script>

<style scoped>

.actions {

  .action {
    display: flex;
    flex-direction: row;
    align-items: center;
    margin-left: 8px;

    &:first-child {
      margin-left: 0px;
    }

    svg {
      margin-right: 4px;
    }

    &.read svg {
      position: relative;
      top: 1.5px;
    }
  }

}

</style>