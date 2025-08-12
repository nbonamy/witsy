<template>
  <div class="actions" v-if="message">
    <MessageItemActionCopy :message="message" />
    <MessageItemActionRead :message="message" :audio-state="audioState" :read-aloud="onReadAloud" />
    <template v-if="!message.transient">
      <div class="action usage" v-if="message.usage" @click="onUsage(message)">
        <BIconBarChartFill /> {{ t('common.usage') }}
      </div>
      <div class="action retry" v-if="message.role == 'assistant'" @click="onRetry(message)">
        <BIconArrowCounterclockwise /> {{ t('common.retry') }}
      </div>
      <div class="action edit" v-if="message.role == 'user' && message.type == 'text'" @click="onEdit(message)">
        <BIconPencil /> {{ t('common.edit') }}
      </div>
      <div class="action delete" v-if="message.role == 'user' && message.type == 'text'" @click="onDelete(message)">
        <BIconTrash /> {{ t('common.delete') }}
      </div>
      <div class="action fork" @click="onFork(message)">
        <ForkIcon /> {{ t('common.fork') }}
      </div>
      <div class="action tools" @click="onTools(message)" v-if="message.role == 'assistant' && store.config.appearance.chat.showToolCalls != 'always'">
        <BIconTools /> {{ t('common.tools') }}
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">

import { store } from '../services/store'
import { t } from '../services/i18n'
import Message from '../models/message'
import Dialog from '../composables/dialog'
import MessageItemActionCopy from '../components/MessageItemActionCopy.vue'
import MessageItemActionRead from '../components/MessageItemActionRead.vue'
import ForkIcon from '../../assets/fork.svg?component'

import useEventBus from '../composables/event_bus'
const { emitEvent } = useEventBus()

const emit = defineEmits(['show-tools'])

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

const onDelete = (message: Message) => {
  emitEvent('delete-message', message)
}

const onUsage = (message: Message) => {
  
  // check
  if (!message.usage) return
  
  // build text
  const totalTokens = message.usage.prompt_tokens + message.usage.completion_tokens
  const text = [
    t('message.actions.usage.prompt', { prompt: message.usage.prompt_tokens }),
    message.usage?.prompt_tokens_details?.cached_tokens ? 
      t('message.actions.usage.cached', { cached: message.usage.prompt_tokens_details.cached_tokens }) : 
      null,
    t('message.actions.usage.response', { completion: message.usage.completion_tokens }),
    message.usage.completion_tokens_details?.reasoning_tokens ? 
      t('message.actions.usage.reasoning', { reasoning: message.usage.completion_tokens_details.reasoning_tokens }) : 
      null,
  ].filter(Boolean).join('<br/>')

  Dialog.show({
    title: t('message.actions.usage.title', { total: totalTokens }),
    html: text,
  })
}

const onFork = (message: Message) => {
  emitEvent('fork-chat', message)
}

const onTools = (message: Message) => {

  if (message.toolCalls.length === 0) {
    Dialog.show({
      title: t('message.actions.tools.noTools.title'),
      text: t('message.actions.tools.noTools.text'),
    })
    return
  }
  
  // default
  emit('show-tools')
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