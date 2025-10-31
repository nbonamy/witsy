<template>
  <div class="artifact panel">
    <div class="panel-header">
      <ChevronDownIcon class="icon toggle" @click.stop="togglePanel" />
      <label>{{ title }}</label>
      <ButtonIcon>
        <ClipboardCheckIcon v-if="copying" />
        <ClipboardIcon @click="onCopy" v-else />
      </ButtonIcon>
      <ContextMenuTrigger class="download" position="below-right" ref="downloadButton">
        <template #trigger>
          <DownloadIcon />
        </template>
        <template #menu>
          <div class="item" @click="onDownloadFormat('text')">Text</div>
          <div class="item" @click="onDownloadFormat('raw')">Markdown</div>
          <div class="item" @click="onDownloadFormat('pdf')">PDF</div>
        </template>
      </ContextMenuTrigger>
    </div>
    <div class="panel-body variable-font-size" ref="panelBody">
      <MessageItemBody :message="message" show-tool-calls="never" />
    </div>

  </div>
</template>

<script setup lang="ts">

import { removeMarkdown } from '@excalidraw/markdown-to-text'
import { ChevronDownIcon, ClipboardCheckIcon, ClipboardIcon, DownloadIcon } from 'lucide-vue-next'
import { computed, ref } from 'vue'
import { useArtifactCopy } from '../composables/artifact_copy'
import { togglePanel } from '../composables/panel'
import Message from '../models/message'
import { addExtension, extractCodeBlockContent } from '../services/markdown'
import { exportToPdf } from '../services/pdf'
import ButtonIcon from './ButtonIcon.vue'
import ContextMenuTrigger from './ContextMenuTrigger.vue'
import MessageItemBody from './MessageItemBody.vue'

const content = () => extractCodeBlockContent(props.content)
const { copying, onCopy } = useArtifactCopy(content)

const downloadButton = ref<HTMLElement>(null)
const panelBody = ref<HTMLElement>(null)

const props = defineProps({
  title: {
    type: String,
    required: true,
  },
  content: {
    type: String,
    required: true,
  },
  transient: {
    type: Boolean,
    required: true,
  },
})

const message = computed(() => new Message('assistant', props.content))

const onDownloadFormat = async (action: string) => {

  let filename = props.title
  let fileContent = ''

  switch (action) {
    case 'text':
      fileContent = removeMarkdown(content(), {
        listUnicodeChar: false,
        gfm: true,
        useImgAltText: true,
      })
      const index = filename.lastIndexOf('.')
      if (index === -1 || index < filename.length - 5) {
        filename = addExtension(filename, '.txt')
      }
      break

    case 'raw':
      fileContent = content()
      filename = addExtension(filename, '.md')
      break

    case 'pdf':
      try {
        // For markdown content, create proper message structure
        const message = panelBody.value.closest('.message') as HTMLElement
        const classList = Array.from(message.classList)

        // dummy message
        const msg = document.createElement('div')
        classList.forEach(cls => msg.classList.add(cls))
        const body = msg.appendChild(document.createElement('div'))
        body.classList.add('body')
        const content = body.appendChild(document.createElement('div'))
        content.classList.add('message-content')
        content.innerHTML =
          (props.title.length ? `<div class="text variable-font-size"><h1>${props.title}</h1></div>` : '')
          + panelBody.value.outerHTML

        await exportToPdf({
          title: filename.replace(/\.[^.]+$/, ''),
          element: msg,
        })

      } catch (error) {
        console.error('Failed to generate PDF:', error)
        return
      }

      // exportToPdf is already doing the save
      return
  }

  // Save file using the API for text and markdown
  window.api.file.save({
    contents: window.api.base64.encode(fileContent),
    properties: {
      filename,
      prompt: true
    }
  })
}

</script>
