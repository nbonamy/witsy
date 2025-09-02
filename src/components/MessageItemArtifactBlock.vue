<template>
  <div class="artifact panel">
    <div class="panel-header">
      <label>{{ title }}</label>
      <ScanEyeIcon class="icon preview" @click="toggleHtml" v-if="isHtml && !previewHtml" />
      <EyeOffIcon class="icon preview" @click="toggleHtml" v-if="isHtml && previewHtml" />
      <ClipboardCheckIcon class="icon" v-if="copying" />
      <ClipboardIcon class="icon" @click="onCopy" v-else />
      <div class="icon download" @click="onDownloadClick" ref="downloadButton">
        <DownloadIcon class="icon"/>
      </div>
    </div>
    <div class="panel-body" ref="panelBody">
      <iframe sandbox="allow-scripts allow-same-origin allow-forms" v-if="isHtml && previewHtml" :srcdoc="html" style="width: 100%; height: 400px; border: none;" />
      <MessageItemBody :message="message" show-tool-calls="never" v-else />
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
import { ClipboardCheckIcon, ClipboardIcon, DownloadIcon, EyeOffIcon, ScanEyeIcon } from 'lucide-vue-next'
import { computed, onMounted, ref } from 'vue'
import Message from '../models/message'
import { exportToPdf } from '../services/pdf'
import { store } from '../services/store'
import ContextMenu from './ContextMenu.vue'
import MessageItemBody from './MessageItemBody.vue'

const previewHtml = ref(false)
const copying = ref(false)
const downloadButton = ref<HTMLElement>(null)
const panelBody = ref<HTMLElement>(null)
const showDownloadMenu = ref(false)
const downloadMenuX = ref(0)
const downloadMenuY = ref(0)

const downloadMenuActions = computed(() => {
  if (isHtml.value) {
    return [
      { label: 'HTML', action: 'raw', disabled: false },
      { label: 'PDF', action: 'pdf', disabled: false },
    ]
  } else {
    return [
      { label: 'Text', action: 'text', disabled: false },
      { label: 'Markdown', action: 'raw', disabled: false },
      { label: 'PDF', action: 'pdf', disabled: false },
    ]
  }
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
})

const isHtml = computed(() => {
  const content = props.content.trim()
  if (content.startsWith('```html') && content.endsWith('```')) {
    return true
  }
  // Also detect HTML content without language specifier
  if (content.startsWith('```') && content.endsWith('```')) {
    const innerContent = content.slice(content.indexOf('\n') + 1, -3).trim()
    return innerContent.startsWith('<!DOCTYPE html') || innerContent.startsWith('<html')
  }
  if (content.startsWith('<!DOCTYPE html') || content.startsWith('<html')) {
    return true
  }
  return false
})

const message = computed(() => new Message('assistant', props.content))

const html = computed(() => {
  const content = props.content.trim()
  if (content.startsWith('```html') && content.endsWith('```')) {
    return content.slice(8, -3).trim()
  }
  // Handle HTML content without language specifier
  if (content.startsWith('```') && content.endsWith('```')) {
    const innerContent = content.slice(content.indexOf('\n') + 1, -3).trim()
    if (innerContent.startsWith('<!DOCTYPE html') || innerContent.startsWith('<html')) {
      return innerContent
    }
  }
  if (content.startsWith('<!DOCTYPE html') || content.startsWith('<html')) {
    return content
  }
  return ''
})

onMounted(() => {
  previewHtml.value = store.config.appearance.chat.autoPreview.html ?? true
})

const content = () => {
  let content = props.content.trim()
  if (content.startsWith('```') && content.endsWith('```')) {
    content = content.slice(content.indexOf('\n') + 1, -3).trim()
  }
  return content
}

const toggleHtml = () => {
  previewHtml.value = !previewHtml.value
}

const onCopy = () => {
  copying.value = true
  navigator.clipboard.writeText(content())
  setTimeout(() => {
    copying.value = false
  }, 1000)
}

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

const addExtension = (filename: string, extension: string): string => {
  if (filename.lastIndexOf('.') <= filename.length - 5) {
    return filename + extension
  } else {
    return filename.replace(/\.[^.]+$/, extension)
  }
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
      filename = addExtension(filename, isHtml.value ? '.html' : '.md')
      break

    case 'pdf':
      try {

        // For HTML content, export the iframe content directly
        if (isHtml.value && previewHtml.value) {
          const iframe = panelBody.value?.querySelector('iframe') as HTMLIFrameElement
          if (!iframe) {
            console.error('Could not find iframe element')
            return
          }
          
          // Get the actual HTML document from inside the iframe
          const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document
          if (!iframeDoc) {
            console.error('Could not access iframe content')
            return
          }
          
          // Export the entire HTML document from the iframe
          await exportToPdf({
            title: filename.replace(/\.[^.]+$/, ''),
            element: iframeDoc.documentElement, // This gets the <html> element with all its content
          })
          
          return
        }

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

<style scoped>

.panel.artifact {
  
  margin: 1rem 0rem;
  padding: 0rem;
  background-color: var(--background-color);

  .panel-header {
    padding: 0.75rem 1rem;
    border-bottom: 1px solid var(--border-color);
    gap: 0.5rem;

    label {
      font-size: 0.95em;
    }
    
    .icon {
      fill: none;
      width: var(--icon-md);
      height: var(--icon-md);
    }
  }

  .panel-body {
    padding: 1rem;
    padding-top: 0.25rem;
    padding-bottom: 0rem;

    &:has(iframe) {
      padding: 0rem;
    }

    &:deep() {
      .text hr:first-child, .text hr:last-child {
        display: none;
      }
      h1:first-of-type {
        border-top: 0;
        margin-top: 0;
      }
    }

    iframe {
      height: 500px !important;
    }
  }
}


</style>
