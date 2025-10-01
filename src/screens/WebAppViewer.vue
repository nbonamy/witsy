<template>
  <div class="webapp-viewer" v-show="visible">
    <webview
      ref="webviewRef"
      :data-webapp-id="webapp.id"
      partition="persist:webview"
      allowpopups
      style="width: 100%; height: 100%;"
    />
  </div>
</template>

<script setup lang="ts">

import { onMounted, onBeforeUnmount, ref, watch } from 'vue'
import { WebApp } from '../types/workspace'

const props = defineProps<{
  webapp: WebApp
  visible: boolean
}>()

const emit = defineEmits<{
  'update-last-used': []
  'navigate': [url: string]
}>()

const webviewRef = ref<HTMLElement | null>(null)
let hasLoadedSrc = false

// Update lastUsed when component becomes visible
watch(() => props.visible, (isVisible) => {
  console.log(`[WebAppViewer ${props.webapp.id}] Visibility changed:`, isVisible, 'webviewRef:', !!webviewRef.value, 'hasLoadedSrc:', hasLoadedSrc)
  if (isVisible && webviewRef.value) {
    emit('update-last-used')

    // Lazy load: only set src on first show
    if (!hasLoadedSrc) {
      const webview = webviewRef.value as any
      console.log(`[WebAppViewer ${props.webapp.id}] Setting src to:`, props.webapp.url)
      webview.src = props.webapp.url
      hasLoadedSrc = true
    }
  }
})

onMounted(() => {
  const webview = webviewRef.value as any
  if (!webview) return

  const handleDidFinishLoad = () => {
    console.log(`[WebApp ${props.webapp.id}] Page loaded`)
  }

  const handleDidNavigateInPage = (event: any) => {
    console.log(`[WebApp ${props.webapp.id}] Navigated to:`, event.url)
    emit('navigate', event.url)
  }

  const handleDomReady = async () => {
    const webviewId = webview.getWebContentsId()
    if (webviewId) {
      // Configure webview to keep links internal (not open in external browser)
      await window.api?.webview?.setLinkBehavior?.(webviewId, false)

      // Enable spell check
      await window.api?.webview?.setSpellCheckEnabled?.(webviewId, true)
    }
  }

  // Attach event listeners
  webview.addEventListener('did-finish-load', handleDidFinishLoad)
  webview.addEventListener('did-navigate-in-page', handleDidNavigateInPage)
  webview.addEventListener('dom-ready', handleDomReady)

  // Cleanup on unmount
  onBeforeUnmount(() => {
    webview.removeEventListener('did-finish-load', handleDidFinishLoad)
    webview.removeEventListener('did-navigate-in-page', handleDidNavigateInPage)
    webview.removeEventListener('dom-ready', handleDomReady)
  })

  // Set src immediately if visible on mount
  console.log(`[WebAppViewer ${props.webapp.id}] onMounted - visible:`, props.visible, 'webview:', !!webview, 'hasLoadedSrc:', hasLoadedSrc)
  if (props.visible && !hasLoadedSrc) {
    console.log(`[WebAppViewer ${props.webapp.id}] Setting src on mount to:`, props.webapp.url)
    webview.src = props.webapp.url
    hasLoadedSrc = true
  }
})

</script>

<style scoped>
.webapp-viewer {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  background-color: var(--background-color);
}
</style>
