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

import { ref, inject, computed, onMounted } from 'vue'
import { store } from '../services/store'
import { t } from '../services/i18n'
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

  // // if transient make sure we close markdown tags
  // if (props.message.transient) {
  //   content = closeOpenMarkdownTags(content)
  // }

  // user message does not have this
  if (props.message.role !== 'assistant') {
    return [{ type: 'text', content }]
  }

  // extract each <img> in a separate block
  let match
  let lastIndex = 0
  const blocks: Block[] = []
  const regex1 = /!\[([^\]]*)\]\(([^\)]*)\)/g
  const regex2 = /<(?:img|video)[^>]*?src="([^"]*)"[^>]*?>/g
  for (const regex of [ regex1, regex2 ]) {
  
    while (match = regex.exec(content)) {

      // 1st add test until here
      if (match.index > lastIndex) {
        blocks.push({ type: 'text', content: content.substring(lastIndex, match.index) })
      }

      // now image
      let imageUrl = decodeURIComponent(match[match.length - 1])
      if (!imageUrl.startsWith('http') && !imageUrl.startsWith('file://')) {
        imageUrl = `file://${imageUrl}`
      }

      // try to find the prompt
      let prompt = null
      if (props.message.toolCall?.calls) {
        for (const call of props.message.toolCall.calls) {
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

const closeOpenMarkdownTags = (input: string): string => {
  
  const tagPairs: { tag:string }[] = [
    { tag: '```' },
    { tag: '~~~' },
    { tag: '**' },
    { tag: '__' },
    { tag: '*'},
    { tag: '_'},
    { tag: '`' }
  ];

  let i :number = 0;
  const stack: { tag: string; index: number }[] = [];

  // Track active tags
  while (i < input.length) {

    let matched = false;
    for (const { tag } of tagPairs) {
      
      if (input.startsWith(tag, i)) {
        // Check if top of stack has same tag (closing)
        const top = stack[stack.length - 1];
        if (top && top.tag === tag) {
          stack.pop();
        } else {
          stack.push({ tag, index: i });
        }
        i += tag.length;
        matched = true;
        break;
      }
    }

    if (!matched) {
      i++;
    }
  }

  // Handle mismatched inline like **t* -> **t**
  if (input.match(/\*\*[^*]+?\*$/)) {
    input += '*';
    return input;
  }
  if (input.match(/__[^_]+?_$/)) {
    input += '_';
    return input;
  }

  // Close any remaining tags
  while (stack.length > 0) {
    const { tag } = stack.pop();
    input += tag;
  }

  // Handle links and images
  const unmatchedLeftBracket = input.lastIndexOf('[');
  const unmatchedRightBracket = input.lastIndexOf(']');
  const unmatchedLeftParen = input.lastIndexOf('](');
  const unmatchedRightParen = input.lastIndexOf(')');

  if (unmatchedLeftBracket > unmatchedRightBracket) {
    input += ']';
  }

  if (unmatchedLeftParen > unmatchedRightParen) {
    input += ')';
  }

  return input;
}

</script>

<style>
.message .body .katex-html {
  display: none;
}
</style>
