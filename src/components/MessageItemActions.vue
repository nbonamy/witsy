<template>
  <div class="actions">
    <MessageItemActionCopy :message="message" />
    <MessageItemActionRead :message="message" :audio-state="audioState" :read-aloud="onReadAloud" />
    <div class="action usage" v-if="message.usage" @click="onUsage(message)">
      <BIconBarChartFill /> Usage
    </div>
    <div class="action retry" v-if="message.role == 'assistant' && !message.transient" @click="onRetry(message)">
      <BIconArrowCounterclockwise /> Retry
    </div>
    <div class="action edit" v-if="message.role == 'user' && message.type == 'text' && !message.transient" @click="onEdit(message)">
      <BIconPencil /> Edit
    </div>
    <div class="action fork" v-if="!message.transient" @click="onFork(message)">
      <ForIcon /> Fork
    </div>
  </div>
</template>

<script setup lang="ts">

import { store } from '../services/store'
import Message from '../models/message'
import Dialog from '../composables/dialog'
import MessageItemActionCopy from '../components/MessageItemActionCopy.vue'
import MessageItemActionRead from '../components/MessageItemActionRead.vue'
import ForIcon from '../../assets/fork.svg?component'

import useEventBus from '../composables/event_bus'
const { emitEvent } = useEventBus()

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

const onReadAloud = async (message: Message) => {
  props.readAloud(message)
}

const onRetry = (message: Message) => {

  // if already confirmed
  if (!store.config.general.confirm.retryGeneration) {
    emitEvent('retry-generation', message)
    return
  }

  // ask
  Dialog.show({
    title: 'Are you sure you want to generate this message again?',
    text: 'Current version will be lost.',
    customClass: { denyButton: 'alert-neutral' },
    confirmButtonText: 'OK. Don\'t ask again.',
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

const onEdit = (message: Message) => {
  emitEvent('set-prompt', message)
}

const onUsage = (message: Message) => {
  
  // check
  if (!message.usage) return
  
  // build text
  const totalTokens = message.usage.prompt_tokens + message.usage.completion_tokens
  let text = `Prompt tokens: ${message.usage.prompt_tokens}`
  text += `\nResponse tokens: ${message.usage.completion_tokens}`
  if (message.usage.completion_tokens_details?.reasoning_tokens) {
    text += `\nReasoning tokens: ${message.usage.completion_tokens_details.reasoning_tokens}`
  }

  // show
  Dialog.show({
    title: `Total tokens: ${totalTokens}`,
    text: text,
  })
}

const onFork = (message: Message) => {
  emitEvent('fork-chat', message)
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
      height: 12px;
    }

    &.read svg {
      position: relative;
      top: 1.5px;
    }

  }

}

</style>