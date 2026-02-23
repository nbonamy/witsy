<template>
  <div v-if="block.type == 'empty'" :ref="setRef" class="text empty variable-font-size"><p>{{ t('message.content.empty') }}</p></div>
  <div v-else-if="block.type == 'user-text'" :ref="setRef" class="text variable-font-size" v-html="userTextRender(block.content!)"></div>
  <div v-else-if="block.type == 'text'" :ref="setRef" v-html="mdRender(block.content!)" class="text variable-font-size"></div>
  <MessageItemArtifactBlock v-else-if="block.type == 'artifact'" :ref="setRef" :title="block.title!" :content="block.content!" :transient="props.transient" />
  <MessageItemHtmlBlock v-else-if="block.type == 'html'" :ref="setRef" :title="block.title!" :content="block.content!" :transient="props.transient" />
  <MessageItemTableBlock v-else-if="block.type == 'table'" :ref="setRef" :content="block.content!" />
  <MessageItemMediaBlock v-else-if="block.type == 'media'" :ref="setRef" :url="block.url!" :desc="block.desc" :prompt="block.prompt" @media-loaded="onMediaLoaded()" />
  <MessageItemToolBlock v-else-if="block.type == 'tool'" :ref="setRef" :tool-call="block.toolCall!" />
  <MessageItemSearchResultBlock v-else-if="block.type == 'search'" :ref="setRef" :tool-call="block.toolCall!" />
</template>

<script setup lang="ts">

import Dialog from '@renderer/utils/dialog'
import { SearchState } from '@screens/Chat.vue'
import { t } from '@services/i18n'
import { Block } from '@services/message_block_parser'
import { InfoIcon } from 'lucide-vue-next'
import { h, inject, nextTick, PropType, ref, render } from 'vue'
import MessageItemArtifactBlock from './MessageItemArtifactBlock.vue'
import MessageItemHtmlBlock from './MessageItemHtmlBlock.vue'
import MessageItemMediaBlock from './MessageItemMediaBlock.vue'
import MessageItemMermaidBlock from './MessageItemMermaidBlock.vue'
import MessageItemSearchResultBlock from './MessageItemSearchResultBlock.vue'
import MessageItemTableBlock from './MessageItemTableBlock.vue'
import MessageItemToolBlock from './MessageItemToolBlock.vue'

const searchState = inject<SearchState>('searchState')

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

const messageItemBodyBlock = ref<HTMLElement | null>(null)
let customRenderTimeout: NodeJS.Timeout|null = null

const setRef = (el: any) => {
  // For Vue components, get the root element via $el
  // For regular HTML elements, use them directly
  messageItemBodyBlock.value = el?.$el || el
}
const userTextRender = (content: string) => {
  // escape HTML, then render inline code and convert newlines to <br>
  const escaped = content
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
  return `<p>${escaped.replace(/\n/g, '<br>')}</p>`
}

const mdRender = (content: string) => {

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

  // highlight search
  if (searchState?.filter.value) {
    const regex = new RegExp(searchState.filter.value, 'gi')
    html = html.replace(regex, (match) => `<mark>${match}</mark>`);
  }

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
  font-family: var(--font-family-base);
}

</style>