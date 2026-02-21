<template>

  <template v-if="message.type == 'text'">

    <!-- expert -->
      <div v-if="message.expert" class="expert text variable-font-size">
      <p><BrainIcon /> {{ message.expert.name }}</p>
    </div>

    <template v-if="reasoningBlocks.length">
      <div @click="onToggleReasoning" class="toggle-reasoning">
        <ChevronDownIcon v-if="showReasoning" />
        <ChevronRightIcon v-else />
        {{ isThinking ? t('message.reasoning.active') : showReasoning ? t('message.reasoning.hide') : t('message.reasoning.show') }}
        <span class="thinking-ellipsis" v-if="isThinking"></span>
      </div>
      <div class="think" v-if="showReasoning">
        <template v-for="block in reasoningBlocks">
          <MessageItemBodyBlock :block="block" :transient="message.transient" @media-loaded="onMediaLoaded(message)" />
        </template>
      </div>
    </template>

    <template v-for="block in contentBlocks">
      <MessageItemBodyBlock :block="block" :transient="message.transient" @media-loaded="onMediaLoaded(message)" />
    </template>

  </template>

</template>

<script setup lang="ts">

import Message from '@models/message'
import { SearchState } from '@screens/Chat.vue'
import { t } from '@services/i18n'
import { Block, computeBlocks, computeBlocksIncremental } from '@services/message_block_parser'
import { store } from '@services/store'
import { BrainIcon, ChevronDownIcon, ChevronRightIcon } from 'lucide-vue-next'
import { ChatToolMode } from 'types/config'
import { computed, inject, PropType, ref, watch } from 'vue'
import MessageItemBodyBlock from './MessageItemBodyBlock.vue'

const searchState = inject<SearchState>('searchState')
const showReasoning = inject('showReasoning', ref(store.config.appearance.chat.showReasoning))
const userToggleReasoning = inject('onToggleReasoning', (value: boolean) => {
  store.config.appearance.chat.showReasoning = value
  store.saveSettings()
})

const cachedContentBlocks = ref<Block[]>([])
const cachedReasoningBlocks = ref<Block[]>([])
let isComputing = false
let needsRecompute = false

const props = defineProps({
  message: {
    type: Object as PropType<Message>,
    required: true,
  },
  showToolCalls: {
    type: String as PropType<ChatToolMode>,
    required: true,
  },
})

const isThinking = computed(() => {
  return props.message.transient && props.message.reasoning?.length && !props.message.content?.length
})

const computeBlocksOptions = () => ({
  role: props.message.role as 'user' | 'assistant' | 'system',
  transient: props.message.transient ?? false,
  toolCalls: props.message.toolCalls ?? [],
  showToolCalls: props.showToolCalls,
  filter: searchState?.filter.value,
})

const emptyBlock = (): Block => ({
  type: 'empty',
  start: 0,
  end: 0,
  stable: true
})

const reasoningBlocks = computed((): Block[] => {
  return cachedReasoningBlocks.value
})

const contentBlocks = computed((): Block[] => {

  // Return cached blocks if available
  if (cachedContentBlocks.value.length > 0) {
    return cachedContentBlocks.value
  }

  // Immediate computation for initial render
  const blocks = computeBlocks(props.message.content, computeBlocksOptions())
  if (blocks.length === 0 && !props.message.transient) {
    return [emptyBlock()]
  }
  return blocks
})

const onToggleReasoning = () => {
  showReasoning.value = !showReasoning.value
  userToggleReasoning(showReasoning.value)
}

const performComputation = async () => {

  if (isComputing) {
    needsRecompute = true
    return
  }

  isComputing = true
  needsRecompute = false

  // Use nextTick to ensure this runs asynchronously
  await new Promise(resolve => setTimeout(resolve, 0))

  // Use incremental computation for transient messages to reuse stable blocks
  const options = computeBlocksOptions()
  const blocks = options.transient
    ? computeBlocksIncremental(props.message.content, options, cachedContentBlocks.value)
    : computeBlocks(props.message.content, options)

  if (blocks.length === 0 && !props.message.transient) {
    cachedContentBlocks.value = [emptyBlock()]
  } else {
    cachedContentBlocks.value = blocks
  }

  isComputing = false

  // If content changed during computation, recompute
  if (needsRecompute) {
    performComputation()
  }
}

// Watch reasoning changes and compute blocks
// Reasoning becomes stable once content starts appearing
watch(() => [props.message.reasoning, props.message.content], ([reasoning, content], oldValue) => {
  const options = computeBlocksOptions()
  const blocks = options.transient
    ? computeBlocksIncremental(reasoning as string, options, cachedReasoningBlocks.value)
    : computeBlocks(reasoning as string, options)

  // Mark all blocks as stable once content appears (reasoning phase complete)
  const prevReasoning = oldValue?.[0]
  const reasoningJustCompleted = !prevReasoning?.length && (content as string)?.length
  if (reasoningJustCompleted && blocks.length > 0) {
    for (const block of blocks) {
      block.stable = true
    }
  }

  cachedReasoningBlocks.value = blocks
}, { immediate: true })

// Watch content changes and trigger async computation
watch(() => props.message, () => {
  performComputation()
}, { deep: true, immediate: true })

const emits = defineEmits(['media-loaded'])

const onMediaLoaded = (message: Message) => {
  emits('media-loaded', message)
}

</script>

<style>
.message .message-body .katex-html {
  display: none;
}
</style>
