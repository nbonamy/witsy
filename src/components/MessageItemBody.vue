<template>
  <div v-if="message.type == 'text'">
    <template v-if="reasoningBlocks.length">
      <div @click="onToggleReasoning" class="toggle-reasoning">
        <BIconChevronDown v-if="showReasoning" />
        <BIconChevronRight v-else />
        {{ isThinking ? t('message.reasoning.active') : showReasoning ? t('message.reasoning.hide') : t('message.reasoning.show') }}
        <span class="thinking-ellipsis" v-if="isThinking"></span>
      </div>
      <div class="think" v-if="showReasoning">
        <div v-for="block in reasoningBlocks">
          <MessageItemBodyBlock :block="block" @media-loaded="onMediaLoaded(message)" />
        </div>
      </div>
    </template>
    <div v-for="block in contentBlocks">
      <MessageItemBodyBlock :block="block" @media-loaded="onMediaLoaded(message)" />
    </div>
  </div>
</template>

<script setup lang="ts">

import { ChatToolMode } from '../types/config'
import { ref, inject, computed, onMounted, PropType } from 'vue'
import { store } from '../services/store'
import { t } from '../services/i18n'
import { closeOpenMarkdownTags, getCodeBlocks } from '../services/markdown'
import MessageItemBodyBlock, { Block } from './MessageItemBodyBlock.vue'
import Message from '../models/message'

import useEventBus from '../composables/event_bus'
const { onEvent, emitEvent } = useEventBus()

const showReasoning = inject('showReasoning', ref(store.config.appearance.chat.showReasoning))
const userToggleReasoning = inject('onToggleReasoning', (value: boolean) => {
  store.config.appearance.chat.showReasoning = value
  store.saveSettings()
})

const props = defineProps({
  message: {
    type: Message,
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

const reasoningBlocks = computed(() => {
  return computeBlocks(props.message.reasoning)
})

const contentBlocks = computed(() => {
  return computeBlocks(props.message.content)
})

const onToggleReasoning = () => {
  showReasoning.value = !showReasoning.value
  userToggleReasoning(showReasoning.value)
  emitEvent('toggle-reasoning', showReasoning.value)
}

onMounted(() => {
  onEvent('toggle-reasoning', (value: boolean) => {
    showReasoning.value = value
  })  
})

const emits = defineEmits(['media-loaded'])

const onMediaLoaded = (message: Message) => {
  emits('media-loaded', message)
}

const computeBlocks = (content: string|null): Block[] => {

  // if no content, return empty
  if (!content || content.trim().length === 0 || content.replaceAll('\n', '').trim().length === 0) {
    return []
  }

  // user message does not have this
  if (props.message.role !== 'assistant') {
    return [{ type: 'text', content }]
  }

  // if transient make sure we close markdown tags
  if (props.message.transient) {
    content = closeOpenMarkdownTags(content)
  }

  // now get the code blocks
  const codeBlocks: { start: number, end: number }[] = getCodeBlocks(content)
  //console.log('Code blocks:', codeBlocks)

  // extract each special tags in a separate block
  let match: RegExpExecArray | null
  let lastIndex = 0
  const blocks: Block[] = []
  const regexMedia1 = /!\[([^\]]*)\]\(([^\)]*)\)/g
  const regexMedia2 = /<(?:img|video)[^>]*?src="([^"]*)"[^>]*?>/g
  const regexTool1 = /<tool index="(\d*)"><\/tool>/g
  for (const regex of [ regexTool1, regexMedia1, regexMedia2 ]) {
  
    while (match = regex.exec(content)) {

      // check if we are inside a code block
      if (codeBlocks.find(block => match.index >= block.start && match.index < block.end)) {
        continue
      }

      // 1st add test until here
      if (match.index > lastIndex) {
        blocks.push({ type: 'text', content: content.substring(lastIndex, match.index) })
      }

      // tool
      if ([regexTool1].includes(regex)) {
        if (props.showToolCalls === 'always' && props.message.toolCalls.length) {
          const index = parseInt(match[1])
          const toolCall = props.message.toolCalls[index]
          if (toolCall && toolCall.done) {
            blocks.push({ type: 'tool', toolCall: toolCall })
          }
        }
        lastIndex = regex.lastIndex
        continue
      }

      // now media
      let imageUrl = decodeURIComponent(match[match.length - 1])
      if (!imageUrl.startsWith('http') && !imageUrl.startsWith('file://') && !imageUrl.startsWith('data:image/')) {
        imageUrl = `file://${imageUrl}`
      }

      // try to find the prompt
      let prompt = null
      if (props.message.toolCalls) {
        for (const call of props.message.toolCalls) {
          const toolPath = call.result?.path || call.result?.url
          if (toolPath === match[match.length - 1] || toolPath === decodeURIComponent(match[match.length - 1])) {
            prompt = call.params.prompt
            break
          }
        }
      }

      // done
      const desc = match.length === 3 ? match[1] : 'Video'
      blocks.push({ type: 'media', url: imageUrl, desc, prompt })

      // continue
      lastIndex = regex.lastIndex

    }
  
  }

  // add last block
  if (lastIndex != content.length) {
    blocks.push({ type: 'text', content: content.substring(lastIndex) })
  }

  // done
  //console.log(blocks)
  return blocks

}

</script>

<style>
.message .body .katex-html {
  display: none;
}
</style>
