<template>
  <div class="actions">
    <div class="action copy" v-if="message.role == 'assistant' && !message.transient" @click="onCopy(message)">
      <BIconClipboard /> {{ copyLabel }}
    </div>
    <div class="action read" v-if="message.role == 'assistant' && message.type == 'text' && !message.transient" @click="onToggleRead(message)">
      <span v-if="mgsAudioState(message) == 'playing'"><BIconStopCircle/> Stop</span>
      <span v-else-if="mgsAudioState(message) == 'loading'"><BIconXCircle/> Cancel</span>
      <span v-else><BIconPlayCircle /> Read</span>
    </div>
    <div class="action retry" v-if="message.role == 'assistant' && !message.transient" @click="onRetry(message)">
      <BIconArrowCounterclockwise /> Retry
    </div>
    <div class="action edit" v-if="message.role == 'user' && message.type == 'text' && !message.transient" @click="onEdit(message)">
      <BIconPencil /> Edit
    </div>
  </div>
</template>

<script setup>

import { ref } from 'vue'
import { store } from '../services/store'
import Message from '../models/message'
import Dialog from '../composables/dialog'

import useEventBus from '../composables/event_bus'
const { emitEvent, onEvent } = useEventBus()

const props = defineProps({
  message: Message,
  audioState: Object,
  readAloud: Function
})

const copyLabel = ref('Copy')

const mgsAudioState = (message) => {
  return message.uuid == props.audioState.messageId ? props.audioState.state : 'idle'
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

const onToggleRead = async (message) => {
  props.readAloud(message)
}

const onRetry = (message) => {

  // if already confirmed
  if (!store.config.general.confirm.retryGeneration) {
    emitEvent('retry-generation', message)
    return
  }

  // ask
  Dialog.show({
    title: 'Are you sure you want to generate this messaage again?',
    text: 'Current version will be lost.',
    customClass: { denyButton: 'swal2-cancel' },
    confirmButtonText: 'OK. Don\'t ask again',
    denyButtonText: 'OK',
    showCancelButton: true,
    showDenyButton: true,
  }).then((result) => {
    
    // don't ask again
    if (result.isConfirmed) {
      store.config.general.confirm.retryGeneration = false
      store.saveSettings()
    }

    // do it
    if (result.isConfirmed || result.isDenied) {
      emitEvent('retry-generation', message)
    }
  })
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