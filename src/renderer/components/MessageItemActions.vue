<template>
  <div class="actions" v-if="message">
    <MessageItemActionCopy v-if="isVisible('copy')" :message="message" />
    <MessageItemActionRead v-if="isVisible('read')" :message="message" :audio-state="audioState" :read-aloud="onReadAloud" />
    <template v-if="!message.transient">
      <div class="action usage" v-if="message.usage && isVisible('usage')" @click="onUsage(message)">
        <ChartNoAxesColumnIncreasingIcon /> {{ t('common.usage') }}
      </div>
      <div class="action retry" v-if="message.role == 'assistant' && isVisible('retry')" @click="onRetry(message)">
        <RotateCcwIcon /> {{ t('common.retry') }}
      </div>
      <div class="action edit" v-if="message.type == 'text' && isVisible('edit')" @click="onEdit">
        <PencilIcon /> {{ t('common.edit') }}
      </div>
      <div class="action quote" v-if="message.role == 'user' && message.type == 'text' && isVisible('quote')" @click="onQuote(message)">
        <QuoteIcon /> {{ t('common.quote') }}
      </div>
      <div class="action delete" v-if="message.role == 'user' && message.type == 'text' && isVisible('delete')" @click="onDelete(message)">
        <Trash2Icon /> {{ t('common.delete') }}
      </div>
      <MessageItemActionScratchpad v-if="isVisible('scratchpad')" :message="message" />
      <div class="action fork" v-if="isVisible('fork')" @click="onFork(message)">
        <GitBranchIcon /> {{ t('common.fork') }}
      </div>
      <div class="action tools" @click="onTools(message)" v-if="message.role == 'assistant' && store.config.appearance.chat.showToolCalls != 'always' && isVisible('tools')">
        <WrenchIcon /> {{ t('common.tools') }}
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">

import { ChartNoAxesColumnIncreasingIcon, GitBranchIcon, PencilIcon, QuoteIcon, RotateCcwIcon, Trash2Icon, WrenchIcon } from 'lucide-vue-next'
import { inject } from 'vue'
import Message from '@models/message'
import MessageItemActionCopy from '@components/MessageItemActionCopy.vue'
import MessageItemActionRead from '@components/MessageItemActionRead.vue'
import MessageItemActionScratchpad from '@components/MessageItemActionScratchpad.vue'
import { t } from '@services/i18n'
import { store } from '@services/store'
import Dialog from '@renderer/utils/dialog'
import type { ChatCallbacks } from '@screens/Chat.vue'

type ActionName = 'copy' | 'read' | 'usage' | 'retry' | 'edit' | 'quote' | 'delete' | 'scratchpad' | 'fork' | 'tools'

const chatCallbacks = inject<ChatCallbacks>('chat-callbacks')
const hiddenMessageActions = inject<ActionName[]>('hidden-message-actions', [])

const callbackMap: Partial<Record<ActionName, keyof ChatCallbacks>> = {
  retry: 'onRetryGeneration',
  quote: 'onSetPrompt',
  delete: 'onDeleteMessage',
  fork: 'onForkChat',
}

const isVisible = (action: ActionName): boolean => {
  if (hiddenMessageActions.includes(action)) return false
  const callbackName = callbackMap[action]
  if (!callbackName) return true
  return !!chatCallbacks?.[callbackName]
}

const emit = defineEmits(['show-tools', 'edit-message'])

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
    chatCallbacks?.onRetryGeneration(message)
    return
  }

  // ask
  Dialog.show({
    title: t('message.actions.retryConfirm.title'),
    text: t('message.actions.retryConfirm.text'),
    confirmButtonText: t('message.actions.retryConfirm.denyButton'),
    denyButtonText: t('message.actions.retryConfirm.confirmButton'),
    showCancelButton: true,
    showDenyButton: true,
  }).then((result) => {

    // don't ask again
    if (result.isDenied) {
      store.config.general.confirm.retryGeneration = false
      store.saveSettings()
    }

    // do it
    if (result.isConfirmed || result.isDenied) {
      chatCallbacks?.onRetryGeneration(message)
    }
  })
}

const onEdit = () => {
  emit('edit-message')
}

const onQuote = (message: Message) => {
  chatCallbacks?.onSetPrompt(message)
}

const onDelete = (message: Message) => {
  chatCallbacks?.onDeleteMessage(message)
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
  chatCallbacks?.onForkChat(message)
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

  &:deep() .action {
    display: flex;
    flex-direction: row;
    align-items: center;
    margin-left: 8px;
    gap: 0.25rem;

    &:first-child {
      margin-left: 0px;
    }

    svg {
      width: 0.75rem;
      height: 0.75rem;
    }

  }

}

</style>