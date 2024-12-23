<template>
  <div v-if="message.type == 'text'">
    <div v-for="block in blocks">
      <div v-if="block.type == 'text'" v-html="mdRender(block.content!)" class="text variable-font-size"></div>
      <MessageItemMedia :url="block.url!" :desc="block.desc" :prompt="block.prompt" @media-loaded="onMediaLoaded(message)" v-else-if="block.type == 'media'" />
    </div>
  </div>
</template>

<script setup lang="ts">

import { computed } from 'vue'
import { store } from '../services/store'
import MessageItemMedia from './MessageItemMedia.vue'
import Message from '../models/message'

const props = defineProps({
  message: {
    type: Message,
    required: true,
  },
})

interface Block {
  type: 'text'|'media'
  content?: string
  url?: string
  desc?: string
  prompt?: string
}

const blocks = computed(() => {

  // extract each <img> in a separate block
  let match
  let lastIndex = 0
  const blocks: Block[] = []
  const regex1 = /!\[([^\]]*)\]\(([^\)]*)\)/g
  const regex2 = /<(?:img|video)[^>]*?src="([^"]*)"/g
  for (const regex of [ regex1, regex2 ]) {
  
    while (match = regex.exec(props.message.content)) {

      // 1st add test until here
      if (match.index > lastIndex) {
        blocks.push({ type: 'text', content: props.message.content.substring(lastIndex, match.index) })
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
  if (lastIndex != props.message.content.length) {
    blocks.push({ type: 'text', content: props.message.content.substring(lastIndex) })
  }

  // done
  //console.log(blocks)
  return blocks

})

const emits = defineEmits(['media-loaded'])

const onMediaLoaded = (message: Message) => {
  emits('media-loaded', message)
}

const mdRender = (content: string) => {

  // highlight code
  if (store.chatFilter) {
    const regex = new RegExp(store.chatFilter, 'gi')
    content = content.replace(regex, (match) => `==${match}==`);
  }

  // do it
  return window.api.markdown.render(content)
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