<template>
  <div ref="messageItemBodyBlock">
    <div v-if="block.type == 'empty'" class="text empty variable-font-size"><p>{{ t('message.content.empty') }}</p></div>
    <div v-if="block.type == 'text'" v-html="mdRender(block.content!)" class="text variable-font-size"></div>
    <MessageItemArtifactBlock v-else-if="block.type == 'artifact'" :title="block.title!" :content="block.content!" :transient="props.transient" />
    <MessageItemHtmlBlock v-else-if="block.type == 'html'" :title="block.title!" :content="block.content!" :transient="props.transient" />
    <MessageItemTableBlock v-else-if="block.type == 'table'" :content="block.content!" />
    <MessageItemMediaBlock v-else-if="block.type == 'media'" :url="block.url!" :desc="block.desc" :prompt="block.prompt" @media-loaded="onMediaLoaded()" />
    <MessageItemToolBlock v-else-if="block.type == 'tool'" :tool-call="block.toolCall!" />
    <MessageItemSearchResultBlock v-else-if="block.type == 'search'" :tool-call="block.toolCall!" />
  </div>
</template>

<script setup lang="ts">

import { h, nextTick, PropType, ref, render } from 'vue'
import { InfoIcon } from 'lucide-vue-next'
import Dialog from '../utils/dialog'
import { t } from '../services/i18n'
import { store } from '../services/store'
import { ToolCall } from 'types/index'
import MessageItemArtifactBlock from './MessageItemArtifactBlock.vue'
import MessageItemHtmlBlock from './MessageItemHtmlBlock.vue'
import MessageItemMediaBlock from './MessageItemMediaBlock.vue'
import MessageItemMermaidBlock from './MessageItemMermaidBlock.vue'
import MessageItemSearchResultBlock from './MessageItemSearchResultBlock.vue'
import MessageItemTableBlock from './MessageItemTableBlock.vue'
import MessageItemToolBlock from './MessageItemToolBlock.vue'

type BlockEmpty = {
  type: 'empty'
}

type BlockText = {
  type: 'text'
  content: string
}

type BlockMedia = {
  type: 'media'
  url: string
  desc?: string
  prompt?: string
}

type BlockArtifact = {
  type: 'artifact'
  title: string
  content: string
}

type BlockHtml = {
  type: 'html'
  title: string
  content: string
}

type BlockTool = {
  type: 'tool'
  toolCall: ToolCall
}

type BlockSearch = {
  type: 'search'
  toolCall: ToolCall
}

type BlockTable = {
  type: 'table'
  content: string
}

export type Block = BlockEmpty | BlockText | BlockMedia | BlockArtifact | BlockHtml | BlockTool | BlockSearch | BlockTable

const props = defineProps({
  block: {
    type: Object as PropType<Block>,
    required: true,
  },
  transient: {
    type: Boolean,
    required: true,
  },
})

const emits = defineEmits(['media-loaded'])

const onMediaLoaded = () => {
  emits('media-loaded')
}

const messageItemBodyBlock= ref<HTMLElement>(null)
let customRenderTimeout: NodeJS.Timeout|null = null

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

  // replace <error>...</error> with a span with class error
  html = html.replace(/&lt;error&gt;([ \t]*?)&lt;\/error&gt;/g, '')
  html = html.replace(/&lt;error&gt;([\s\S]*?)&lt;\/error&gt;/g, `
    <span class="error-icon-placeholder" data-error="$1"></span>
  `)

  // render error icons and mermaid blocks
  nextTick(() => {
    clearTimeout(customRenderTimeout)
    customRenderTimeout = setTimeout(() => {
      renderErrorIcons()
      renderMermaidBlocks()
    }, 150)
  })

  // do it
  return html
}

const renderErrorIcons = () => {
  if (!messageItemBodyBlock.value) return

  const allErrorPlaceholders = messageItemBodyBlock.value.querySelectorAll<HTMLElement>('.error-icon-placeholder')
  for (const placeholder of allErrorPlaceholders) {
    const errorContent = placeholder.getAttribute('data-error') || ''

    // Create a Vue component that renders the icon with click handler
    const ErrorIconWrapper = {
      setup() {
        return () => h('span', {
          style: 'cursor: pointer; vertical-align: middle;',
          class: 'text variable-font-size',
          onClick: () => showError(errorContent)
        }, [
          h(InfoIcon, { size: 24 })
        ])
      }
    }

    // Render the component in place of the placeholder
    const vnode = h(ErrorIconWrapper)
    placeholder.innerHTML = ''
    render(vnode, placeholder)
  }
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

const showError = (errorContent: string) => {
  Dialog.show({
    title: t('chat.error.title'),
    text: errorContent
  })
}

</script>


<style scoped>

.text, .text * {
  font-family: var(--messages-font);
}

</style>