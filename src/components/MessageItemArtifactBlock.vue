<template>
  <div class="artifact panel">
    <div class="panel-header">
      <label>{{ title }}</label>
      <BIconClipboardCheck class="icon" v-if="copying" />
      <BIconClipboard class="icon" @click="onCopy" v-else />
      <BIconDownload class="icon" @click="onDownload" />
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
import { BIconClipboardCheck } from 'bootstrap-icons-vue'

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

const onCopy = () => {
  copying.value = true
  navigator.clipboard.writeText(props.content)
  setTimeout(() => {
    copying.value = false
  }, 1000)
}

const onDownload = () => {
  const blob = new Blob([props.content], { type: 'text/plain' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${props.title}.md`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

</script>

<style scoped>

.panel.artifact {
  
  margin: 1rem 0rem;
  padding: 0rem;

  .panel-header {
    padding: 0.75rem 1rem;
    background-color: var(--message-list-bg-color);
    gap: 0.25rem;

    label {
      font-size: 0.95em;
    }
    
    .icon {
      transform: scale(0.75);
    }
  }

  .panel-body {
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
