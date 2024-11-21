<template>
  <div v-if="message.type == 'text'">
    <div v-for="block in blocks">
      <div v-if="block.type == 'text'" v-html="mdRender(block.content!)" class="text variable-font-size"></div>
      <MessageItemImage :url="block.url!" :desc="block.desc" :prompt="block.prompt" @image-loaded="onImageLoaded(message)" v-else-if="block.type == 'image'" />
    </div>
  </div>
</template>

<script setup lang="ts">

import { computed } from 'vue'
import { store } from '../services/store'
import MessageItemImage from './MessageItemImage.vue'
import Message from '../models/message'

const props = defineProps({
  message: {
    type: Message,
    required: true,
  },
})

interface Block {
  type: 'text'|'image'
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
  const regex = /!\[([^\]]*)\]\(([^\)]*)\)/g
  while (match = regex.exec(props.message.content)) {

    // 1st add test until here
    if (match.index > lastIndex) {
      blocks.push({ type: 'text', content: props.message.content.substring(lastIndex, match.index) })
    }

    // now image
    let imageUrl = decodeURIComponent(match[2])
    if (!imageUrl.startsWith('http') && !imageUrl.startsWith('file://')) {
      imageUrl = `file://${imageUrl}`
    }

    // try to find the prompt
    let prompt = null
    if (props.message.toolCall?.calls) {
      for (const call of props.message.toolCall.calls) {
        if (call.result?.path === match[2] || call.result?.path === decodeURIComponent(match[2])) {
          prompt = call.params.prompt
        }
      }
    }

    // done
    blocks.push({ type: 'image', url: imageUrl, desc: match[1], prompt: prompt })

    // continue
    lastIndex = regex.lastIndex
  }

  // add last block
  if (lastIndex != props.message.content.length) {
    blocks.push({ type: 'text', content: props.message.content.substring(lastIndex) })
  }

  // done
  //console.log(blocks)
  return blocks

})

const emits = defineEmits(['image-loaded'])

const onImageLoaded = (message: Message) => {
  emits('image-loaded', message)
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