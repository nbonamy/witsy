<template>
  <div class="actions">
    <MessageItemActionCopy :message="message" />
    <MessageItemActionRead :message="message" :audio-state="audioState" :read-aloud="onReadAloud" />
    <div class="action usage" v-if="message.usage" @click="onUsage(message)">
      <BIconBarChartFill /> {{ t('common.usage') }}
    </div>
    <div class="action retry" v-if="message.role == 'assistant' && !message.transient" @click="onRetry(message)">
      <BIconArrowCounterclockwise /> {{ t('common.retry') }}
    </div>
    <div class="action edit" v-if="message.role == 'user' && message.type == 'text' && !message.transient" @click="onEdit(message)">
      <BIconPencil /> {{ t('common.edit') }}
    </div>
    <div class="action fork" v-if="!message.transient" @click="onFork(message)">
      <ForIcon /> {{ t('common.fork') }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
const { t } = useI18n()

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
    title: t('message.actions.retryConfirm.title'),
    text: t('message.actions.retryConfirm.text'),
    customClass: { denyButton: 'alert-neutral' },
    confirmButtonText: t('message.actions.retryConfirm.confirmButton'),
    denyButtonText: t('message.actions.retryConfirm.denyButton'),
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
  const text = [
    t('message.actions.usage.prompt', { prompt: message.usage.prompt_tokens }),
    t('message.actions.usage.response', { completion: message.usage.completion_tokens }),
    message.usage.completion_tokens_details?.reasoning_tokens ? 
      t('message.actions.usage.reasoning', { reasoning: message.usage.completion_tokens_details.reasoning_tokens }) : 
      null
  ].filter(Boolean).join('\n')

  Dialog.show({
    title: t('message.actions.usage.title', { total: totalTokens }),
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