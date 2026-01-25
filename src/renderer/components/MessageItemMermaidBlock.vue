
<template>
  <div class="media-container" :class="theme" v-if="render">
    <div class="diagram" v-html="render.svg" @click="onFullscreen" />
    <div class="media-actions">
      <SunMoonIcon class="action theme" @click="onTheme" />
      <CodeXmlIcon class="action code" @click="onViewCode" />
      <DownloadIcon class="action download" @click="onDownload" />
    </div>
  </div>
  <div v-if="viewCode">
    <pre class="hljs"><code class="hljs variable-font-size">{{ src }}</code></pre>
    <a @click="onCopyCode">{{ copyLabel }}</a>
  </div>
</template>

<script setup lang="ts">

import { CodeXmlIcon, DownloadIcon, SunMoonIcon } from 'lucide-vue-next'
import mermaid, { RenderResult } from 'mermaid'
import { onMounted, ref } from 'vue'

import useEventBus from '@composables/event_bus'
const { emitBusEvent } = useEventBus()

const props = defineProps({
  src: {
    type: String,
    required: true,
  },
})

const render= ref<RenderResult|null>(null)
const viewCode = ref(false)
const copyLabel = ref('Copy Code')
const theme = ref('light')

mermaid.initialize({
  startOnLoad: false,
  theme: 'base',
  // themeVariables: {
  //   darkMode: 'true',
  //   background: '#282a35',
  //   primaryColor: '#404145',
  //   lineColor: '#F8B229'
  // }
})

onMounted(async () => {
  try {
    render.value = await mermaid.render(`mermaid-${Date.now()}`, props.src)
  } catch (error) {
    viewCode.value = true
  }
})

const onFullscreen = () => {
  const blob = new Blob([render.value.svg], { type: 'image/svg+xml' });
  const url = URL.createObjectURL(blob);
  emitBusEvent('fullscreen', { url, theme: theme.value });
  setTimeout(() => URL.revokeObjectURL(url), 500);  
}

const onTheme = () => {
  theme.value = theme.value === 'light' ? 'dark' : 'light'
}

const onDownload = () => {
  const blob = new Blob([render.value.svg], { type: 'image/svg+xml' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'diagram.svg'
  a.click()
  URL.revokeObjectURL(url)
}

const onViewCode = () => {
  viewCode.value = !viewCode.value
}

const onCopyCode = () => {
  navigator.clipboard.writeText(props.src)
  copyLabel.value = 'Copied!'
  setTimeout(() => {
    copyLabel.value = 'Copy Code'
  }, 1000)
}

</script>

<style scoped>

a {
  cursor: pointer;
}

.message .media-container {
  
  display: flex;
  flex-direction: column;
  justify-content: center;
  cursor: pointer;
  width: fit-content !important;
  padding: 8px 48px 8px 8px;
  border-radius: 4px;
  min-height: 108px;

  &.dark {
    background-color: black;
  }

  .media-actions {
    flex-direction: column;
    top: 8px;
  }
}

@media (prefers-color-scheme: dark) {
  .message .media-container {
    background-color: white;
    &.dark {
      background-color: transparent;
    }
  }
}

</style>