<template>
  <div ref="messageItemBodyBlock">
    <div v-if="block.type == 'text'" v-html="mdRender(block.content!)" class="text variable-font-size" ></div>
   <MessageItemMedia :url="block.url!" :desc="block.desc" :prompt="block.prompt" @media-loaded="onMediaLoaded()" v-else-if="block.type == 'media'" />
  </div>
</template>

<script setup lang="ts">

import { nextTick, PropType, ref, Ref, h, render } from 'vue'
import { store } from '../services/store'
import mermaid, { RenderResult } from 'mermaid'
import MessageItemMedia from './MessageItemMedia.vue'
import { BIconDownload } from 'bootstrap-icons-vue'

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

// Initialize mermaid
mermaid.initialize({ 
  startOnLoad: false,
  theme: 'default'
})

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

  // we only want valid mermaid blocks (some of them can be transient)
  let mermaidBlocks: HTMLElement[] = []
  const allMermaidBlocks = messageItemBodyBlock.value.querySelectorAll<HTMLElement>('.mermaid')
  for (const block of allMermaidBlocks) {
    try {
      if (!block.textContent) continue
      if (!block.textContent.trim().length) continue
      if (await mermaid.parse(block.textContent, { suppressErrors: true })) {
        mermaidBlocks.push(block)
      }
    } catch (error) {
      console.error('Error parsing mermaid block:', error)
    }
  }

  // check
  if (mermaidBlocks.length === 0) {
    return
  }


  try {
    // Process blocks in parallel but maintain order
    await Promise.all(mermaidBlocks.map(async (block) => {
      
      try {

        // the svg
        let svgRender: RenderResult = await mermaid.render(`mermaid-${Date.now()}`, block.textContent!)
        if (!svgRender) {
          return
        }

        // now create a media-container
        const vnode = h('div', { class: 'media-container fit' }, [
          h('div', { class: 'mermaid-rendered', innerHTML: svgRender.svg, }),
          h('div', { class: 'media-actions' }, [
            h(BIconDownload, {
              class: 'action download',
              onClick: () => {
                const blob = new Blob([svgRender.svg], { type: 'image/svg+xml' })
                const url = URL.createObjectURL(blob)
                const a = document.createElement('a')
                a.href = url
                a.download = 'mermaid.svg'
                a.click()
                URL.revokeObjectURL(url)
              }
            })
          ])
        ])

        // render it
        const target = document.createElement('div')
        render(vnode, target)
        
        // amd add it to the dom
        block.parentNode?.insertBefore(target, block.nextSibling)
        //block.parentNode?.removeChild(block)

      } catch (error) {
        console.error('Error rendering mermaid diagram:', error)
        block.classList.add('mermaid-error')
      }

    }))
  } catch (error) {
    console.error('Error processing mermaid blocks:', error)
  }

}

</script>
