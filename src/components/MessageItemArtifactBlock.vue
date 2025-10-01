<template>
  <div class="artifact panel">
    <div class="panel-header">
      <label>{{ title }}</label>
      <ClipboardCheckIcon class="icon" v-if="copying" />
      <ClipboardIcon class="icon" @click="onCopy" v-else />
      <div class="icon download" @click="onDownloadClick" ref="downloadButton">
        <DownloadIcon class="icon"/>
      </div>
    </div>
    <div class="panel-body variable-font-size" ref="panelBody">
      <MessageItemBody :message="message" show-tool-calls="never" />
    </div>

    <ContextMenu
      v-if="showDownloadMenu"
      @close="closeDownloadMenu"
      :actions="downloadMenuActions"
      @action-clicked="onDownloadFormat"
      :x="downloadMenuX"
      :y="downloadMenuY"
      position="below"
    />

  </div>
</template>

<script setup lang="ts">

import { removeMarkdown } from '@excalidraw/markdown-to-text'
import { ClipboardCheckIcon, ClipboardIcon, DownloadIcon } from 'lucide-vue-next'
import { computed, ref } from 'vue'
import { useArtifactCopy } from '../composables/artifact_copy'
import Message from '../models/message'
import { addExtension, extractCodeBlockContent } from '../services/markdown'
import { exportToPdf } from '../services/pdf'
import ContextMenu from './ContextMenu.vue'
import MessageItemBody from './MessageItemBody.vue'

const content = () => extractCodeBlockContent(props.content)
const { copying, onCopy } = useArtifactCopy(content)

const downloadButton = ref<HTMLElement>(null)
const panelBody = ref<HTMLElement>(null)
const showDownloadMenu = ref(false)
const downloadMenuX = ref(0)
const downloadMenuY = ref(0)

const downloadMenuActions = computed(() => {
  return [
    { label: 'Text', action: 'text', disabled: false },
    { label: 'Markdown', action: 'raw', disabled: false },
    { label: 'PDF', action: 'pdf', disabled: false },
  ]
})

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

const onDownloadClick = () => {
  if (showDownloadMenu.value) {
    closeDownloadMenu()
  } else {
    showDownloadContextMenu()
  }
}

const showDownloadContextMenu = () => {
  showDownloadMenu.value = true
  const rcButton = downloadButton.value.getBoundingClientRect()
  downloadMenuX.value = rcButton.left - 120
  downloadMenuY.value = rcButton.bottom + 5
}

const closeDownloadMenu = () => {
  showDownloadMenu.value = false
}

const onDownloadFormat = async (action: string) => {
  // close menu
  closeDownloadMenu()

  let filename = props.title
  let fileContent = ''

  switch (action) {
    case 'text':
      fileContent = removeMarkdown(content(), {
        listUnicodeChar: false,
        gfm: true,
        useImgAltText: true,
      })
      filename = addExtension(filename, '.txt')
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
