<template>
  <div v-if="message.type == 'text'">
    <div class="think" v-if="message.reasoning">
      <div v-for="block in reasoningBlocks">
        <MessageItemBodyBlock :block="block" @media-loaded="onMediaLoaded(message)" />
      </div>
    </div>
    <div v-for="block in contentBlocks">
      <MessageItemBodyBlock :block="block" @media-loaded="onMediaLoaded(message)" />
    </div>
  </div>
</template>

<script setup lang="ts">

import { computed } from 'vue'
import { store } from '../services/store'
import MessageItemBodyBlock, { Block } from './MessageItemBodyBlock.vue'
import Message from '../models/message'

const props = defineProps({
  message: {
    type: Message,
    required: true,
  },
})

const reasoningBlocks = computed(() => {
  return computeBlocks(props.message.reasoning)
})

const contentBlocks = computed(() => {
  return computeBlocks(props.message.content)
})

const emits = defineEmits(['media-loaded'])

const onMediaLoaded = (message: Message) => {
  emits('media-loaded', message)
}

const computeBlocks = (content: string): Block[] => {

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

</script>

<style>
.message .body .katex-html {
  display: none;
}
</style>

<style scoped>

.text, .text * {
  font-family: var(--messages-font);
}

</style>