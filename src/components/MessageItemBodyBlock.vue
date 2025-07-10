<template>
  <div ref="messageItemBodyBlock">
    <div v-if="block.type == 'empty'" class="text empty variable-font-size"><p>{{ t('message.content.empty') }}</p></div>
    <div v-if="block.type == 'text'" v-html="mdRender(block.content!)" class="text variable-font-size"></div>
    <MessageItemMediaBlock v-else-if="block.type == 'media'" :url="block.url!" :desc="block.desc" :prompt="block.prompt" @media-loaded="onMediaLoaded()" />
    <MessageItemToolBlock v-else-if="block.type == 'tool'" :tool-call="block.toolCall!" />
    <MessageItemSearchResultBlock v-else-if="block.type == 'search'" :tool-call="block.toolCall!" />
  </div>
</template>

<script setup lang="ts">

import { ToolCall } from '../types/index'
import { nextTick, PropType, ref, h, render } from 'vue'
import MessageItemMermaidBlock from './MessageItemMermaidBlock.vue'
import MessageItemMediaBlock from './MessageItemMediaBlock.vue'
import MessageItemToolBlock from './MessageItemToolBlock.vue'
import MessageItemSearchResultBlock from './MessageItemSearchResultBlock.vue' 
import { store } from '../services/store'
import { t } from '../services/i18n'

export type Block = {
  type: 'empty'|'text'|'media'|'tool'|'search'
  content?: string
  url?: string
  desc?: string
  prompt?: string
  toolCall?: ToolCall
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

const messageItemBodyBlock= ref<HTMLElement>(null)
let mermaidRenderTimeout: NodeJS.Timeout|null = null

const mdRender = (content: string) => {

  // highlight code
  if (store.chatState.filter) {
    const regex = new RegExp(store.chatState.filter, 'gi')
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
      const vnode = h(MessageItemMermaidBlock, { src: block.textContent })
      block.innerHTML = ''
      render(vnode, block)
    } catch (error) {
      console.error('Error parsing mermaid block:', error)
    }
  }

}

</script>


<style scoped>

.text, .text * {
  font-family: var(--messages-font);
}

</style>