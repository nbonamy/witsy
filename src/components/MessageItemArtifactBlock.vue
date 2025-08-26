<template>
  <div class="artifact panel">
    <div class="panel-header">
      <label>{{ title }}</label>
      <ScanEyeIcon class="icon preview" @click="toggleHtml" v-if="isHtml && !previewHtml" />
      <EyeOffIcon class="icon preview" @click="toggleHtml" v-if="isHtml && previewHtml" />
      <ClipboardCheckIcon class="icon" v-if="copying" />
      <ClipboardIcon class="icon" @click="onCopy" v-else />
      <DownloadIcon class="icon" @click="onDownload" />
    </div>
    <div class="panel-body">
      <iframe sandbox="allow-scripts allow-same-origin allow-forms" v-if="isHtml && previewHtml" :srcdoc="html" style="width: 100%; height: 400px; border: none;" />
      <MessageItemBody :message="message" show-tool-calls="never" v-else />
    </div>
  </div>
</template>

<script setup lang="ts">

import { ClipboardCheckIcon, ClipboardIcon, DownloadIcon, EyeOffIcon, ScanEyeIcon } from 'lucide-vue-next'
import { computed, onMounted, ref } from 'vue'
import Message from '../models/message'
import { store } from '../services/store'
import MessageItemBody from './MessageItemBody.vue'

const previewHtml = ref(false)
const copying = ref(false)

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

const onDownload = () => {

  // filename: if there is no extension, add .md
  let filename = props.title
  if (filename.lastIndexOf('.') <= filename.length - 5) {
    filename += '.md'
  }

  // now download
  window.api.file.save({
    contents: window.api.base64.encode(content()),
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
      width: 1rem;
      height: 1rem;
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
    }
  }
}


</style>
