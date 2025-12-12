<template>
  <div class="webapp-viewer" v-show="visible">
    <div v-if="isLoading" class="loading">
      <Loader />
      <Loader />
      <Loader />
    </div>

    <!-- Navigation Toolbar -->
    <div v-if="!isLoading" class="webapp-toolbar">
      <ButtonIcon
        @click="goHome"
        v-tooltip="{ text: 'Go to home page', position: 'bottom' }"
      >
        <HomeIcon :size="16" />
      </ButtonIcon>

      <div class="toolbar-separator"></div>

      <ButtonIcon
        @click="goBack"
        :disabled="!canGoBack"
        v-tooltip="{ text: 'Go back', position: 'bottom' }"
      >
        <ArrowLeftIcon :size="16" />
      </ButtonIcon>
      <ButtonIcon
        @click="goForward"
        :disabled="!canGoForward"
        v-tooltip="{ text: 'Go forward', position: 'bottom' }"
      >
        <ArrowRightIcon :size="16" />
      </ButtonIcon>

      <div class="toolbar-separator"></div>

      <ButtonIcon
        @click="reload"
        v-tooltip="{ text: 'Reload', position: 'bottom' }"
      >
        <RotateCwIcon :size="16" />
      </ButtonIcon>
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
import Loader from '@components/Loader.vue'
import ButtonIcon from '@components/ButtonIcon.vue'
import { ArrowLeftIcon, ArrowRightIcon, HomeIcon, RotateCwIcon } from 'lucide-vue-next'
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

// Navigation state
const canGoBack = ref(false)
const canGoForward = ref(false)

// Navigation methods
const goHome = () => {
  const webview = webviewRef.value as any
  if (webview) {
    webview.loadURL(props.webapp.url)
  }
}

const goBack = () => {
  const webview = webviewRef.value as any
  if (webview && canGoBack.value) {
    webview.goBack()
  }
}

const goForward = () => {
  const webview = webviewRef.value as any
  if (webview && canGoForward.value) {
    webview.goForward()
  }
}

const reload = () => {
  const webview = webviewRef.value as any
  if (webview) {
    webview.reload()
  }
}

// Update navigation state
const updateNavigationState = () => {
  const webview = webviewRef.value as any
  if (webview) {
    canGoBack.value = webview.canGoBack()
    canGoForward.value = webview.canGoForward()
  }
}

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
    updateNavigationState()
  }

  const handleDidNavigate = () => {
    updateNavigationState()
  }

  const handleDidNavigateInPage = (event: any) => {
    //console.log(`[WebApp ${props.webapp.id}] Navigated to:`, event.url)
    emit('navigate', event.url)
    updateNavigationState()
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
  webview.addEventListener('did-navigate', handleDidNavigate)
  webview.addEventListener('did-navigate-in-page', handleDidNavigateInPage)
  webview.addEventListener('dom-ready', handleDomReady)

  // Cleanup on unmount
  onBeforeUnmount(() => {
    webview.removeEventListener('did-finish-load', handleDidFinishLoad)
    webview.removeEventListener('did-navigate', handleDidNavigate)
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

/* Toolbar */
.webapp-toolbar {
  display: flex;
  flex-wrap: wrap;
  align-self: center;
  gap: var(--space-1);
  padding: var(--space-2) var(--space-4);
  border: 1px solid var(--color-outline-variant);
  border-radius: var(--radius-md);
  margin-bottom: var(--space-4);
  margin-top: var(--space-4);
  background-color: var(--background-color);

  svg {
    width: var(--icon-lg);
    height: var(--icon-lg);
  }
}

.toolbar-separator {
  width: 1px;
  height: 24px;
  background-color: var(--color-outline-variant);
  margin: 0 var(--space-2);
}

/* Disabled button state */
.webapp-toolbar :deep(.button-icon:disabled) {
  opacity: 0.4;
  cursor: not-allowed;
  pointer-events: none;
}
</style>
