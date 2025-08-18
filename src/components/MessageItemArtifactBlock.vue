<template>
  <div class="artifact panel">
    <div class="panel-header">
      <label>{{ title }}</label>
      <ClipboardCheck class="icon" v-if="copying" />
      <Clipboard class="icon" @click="onCopy" v-else />
      <Download class="icon" @click="onDownload" />
    </div>
    <div class="panel-body">
      <MessageItemBody :message="message" show-tool-calls="never" />
    </div>
  </div>
</template>

<script setup lang="ts">

import { ref, computed } from 'vue'
import MessageItemBody from './MessageItemBody.vue'
import Message from '../models/message'
import { Clipboard, ClipboardCheck, Download } from 'lucide-vue-next'

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

const message = computed(() => new Message('assistant', props.content))

const content = () => {
  let content = props.content.trim()
  if (content.startsWith('```') && content.endsWith('```')) {
    content = content.slice(3, -3).trim()
  }
  return content
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

  .panel-header {
    padding: 0.75rem 1rem;
    background-color: var(--background-color);
    border-bottom: 1px solid var(--border-color);
    gap: 0.25rem;

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

    &:deep() {
      .text hr:first-child, .text hr:last-child {
        display: none;
      }
    }
  }
}


</style>
