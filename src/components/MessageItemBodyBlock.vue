<template>
  <div v-if="block.type == 'text'" v-html="mdRender(block.content!)" class="text variable-font-size"></div>
  <MessageItemMedia :url="block.url!" :desc="block.desc" :prompt="block.prompt" @media-loaded="onMediaLoaded()" v-else-if="block.type == 'media'" />
</template>

<script setup lang="ts">

import { PropType } from 'vue'
import { store } from '../services/store'
import MessageItemMedia from './MessageItemMedia.vue'

export type Block = {
  type: 'text'|'media'
  content?: string
  url?: string
  desc?: string
  prompt?: string
}

const props = defineProps({
  block: {
    type: Object as PropType<Block>,
    required: true,
  },
})

const emits = defineEmits(['media-loaded'])

const onMediaLoaded = () => {
  emits('media-loaded')
}

const mdRender = (content: string) => {

  // highlight code
  if (store.chatFilter) {
    const regex = new RegExp(store.chatFilter, 'gi')
    content = content.replace(regex, (match) => `==${match}==`);
  }

  // convert to html 
  var html = window.api.markdown.render(content)

  // deepseek@ollama outputs <think> and ultimately </think> to separate its reasoning process
  // let's render it nicely: append html with '</think>' if there is <think> in html but no '</think>'
  if (html.includes('<think>') && !html.includes('</think>')) {
    html += '</think>'
  }
  // replace <think> with <div class="think"> and </think> with </div>
  html = html.replace(/<think>/g, '<div class="text think"><p>').replace(/<\/think>/g, '</p></div>')

  // do it
  return html
}

</script>
