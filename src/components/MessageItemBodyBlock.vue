<template>
  <div ref="messageItemBodyBlock">
    <div v-if="block.type == 'text'" v-html="mdRender(block.content!)" class="text variable-font-size" ></div>
   <MessageItemMedia :url="block.url!" :desc="block.desc" :prompt="block.prompt" @media-loaded="onMediaLoaded()" v-else-if="block.type == 'media'" />
  </div>
</template>

<script setup lang="ts">

import { nextTick, PropType, ref, Ref, h, render } from 'vue'
import MessageItemMermaid from './MessageItemMermaid.vue'
import MessageItemMedia from './MessageItemMedia.vue'
import { store } from '../services/store'

export type Block = {
  type: 'text'|'media'
  content?: string
  url?: string
  desc?: string
  prompt?: string
}

defineProps({
  block: {
    type: Object as PropType<Block>,
    required: true,
  },
})

const emits = defineEmits(['media-loaded'])

const onMediaLoaded = () => {
  emits('media-loaded')
}

const messageItemBodyBlock: Ref<HTMLElement> = ref(null)
let mermaidRenderTimeout: NodeJS.Timeout|null = null

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

  // mermaid
  nextTick(() => {
    clearTimeout(mermaidRenderTimeout)
    mermaidRenderTimeout = setTimeout(() => {
      renderMermaidBlocks()
    }, 150)
  })

  // do it
  return html
}

const renderMermaidBlocks = async () => {

  if (!messageItemBodyBlock.value) return
  const allMermaidBlocks = messageItemBodyBlock.value.querySelectorAll<HTMLElement>('pre.mermaid')
  for (const block of allMermaidBlocks) {
    try {
      const vnode = h(MessageItemMermaid, { src: block.textContent })
      block.innerHTML = ''
      render(vnode, block)
    } catch (error) {
      console.error('Error parsing mermaid block:', error)
    }
  }

}

</script>
