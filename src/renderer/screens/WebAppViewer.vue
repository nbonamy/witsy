<template>
  <div class="webapp-viewer" v-show="visible">
    <div v-if="isLoading" class="loading">
      <Loader />
      <Loader />
      <Loader />
    </div>
    <webview
      ref="webviewRef"
      :data-webapp-id="webapp.id"
      :partition="partition"
      allowpopups
      :style="{ width: '100%', height: '100%', display: isLoading ? 'none' : 'flex' }"
    />
  </div>
</template>

<script setup lang="ts">

import { onMounted, onBeforeUnmount, ref, watch, computed } from 'vue'
import Loader from '../components/Loader.vue'
import { WebApp } from 'types/workspace'

const props = defineProps<{
  webapp: WebApp
  visible: boolean
}>()

const emit = defineEmits<{
  'update-last-used': []
  'navigate': [url: string]
}>()

const webviewRef = ref<HTMLElement | null>(null)
const isLoading = ref(false)
let hasLoadedSrc = false

const partition = computed(() => `persist:webapp_${props.webapp.name}`)

// Update lastUsed when component becomes visible
watch(() => props.visible, (isVisible) => {
  if (isVisible && webviewRef.value) {
    emit('update-last-used')

    // Lazy load: only set src on first show
    if (!hasLoadedSrc) {
      const webview = webviewRef.value as any
      isLoading.value = true
      webview.src = props.webapp.url
      hasLoadedSrc = true
    }
  }
})

onMounted(() => {
  const webview = webviewRef.value as any
  if (!webview) return

  const handleDidFinishLoad = () => {
    //console.log(`[WebApp ${props.webapp.id}] Page loaded`)
    isLoading.value = false
  }

  const handleDidNavigateInPage = (event: any) => {
    //console.log(`[WebApp ${props.webapp.id}] Navigated to:`, event.url)
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
  if (props.visible && !hasLoadedSrc) {
    isLoading.value = true
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
  position: relative;

  .loading {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 32px;
    background-color: var(--background-color);
    z-index: 10;

    .loader {
      width: 24px;
      height: 24px;
    }
  }
}
</style>
