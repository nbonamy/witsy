<template>
  <div
    ref="dictationEl"
    class="dictation"
    :class="{ notch: isNotchAppearance, visible: isVisible, closing: isClosing, 'show-overlay': showOverlay }"
    @animationend="onAnimationEnd"
    @mousemove="onMouseMove"
    @mouseleave="onMouseLeave"
  >
    <div class="app-info">
      <img v-if="sourceApp" class="icon" :src="iconData" />
      <ClipboardIcon v-else-if="showClipboardIcon" class="clipboard-icon" :color="clipboardIconColor" />
    </div>
    <div class="visualizer">
      <div class="processing" v-if="state === 'processing'">
        <Loader />
        <Loader />
        <Loader />
      </div>
      <Waveform v-else :width="isNotchAppearance ? 240 : 200" :height="32" :foreground-color-inactive="foregroundColorInactive" :foreground-color-active="foregroundColorActive" :audio-recorder="audioRecorder" :is-recording="state === 'recording'" />
    </div>
    <div class="status">
      <CircleIcon v-if="state === 'recording'" class="recording" :size="16" color="red" fill="red" />
      <CircleIcon v-else-if="state === 'idle' || state === 'initializing'" class="idle" :size="16" :color="state === 'initializing' ? 'orange' : iconColor" :fill="state === 'initializing' ? 'orange' : 'transparent'" />
    </div>
    <div class="hint">{{ t('dictation.hint') }}</div>

    <!-- Overlay with action buttons -->
    <div class="actions-overlay" v-if="state === 'recording'">
      <div class="actions">
        <button class="action-btn finish-btn" @click="stopAndTranscribe">
          <CheckIcon :size="16" />
        </button>
        <button class="action-btn cancel-btn" @click="cancelRecording">
          <XIcon :size="16" />
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">

import Loader from '@components/Loader.vue'
import Waveform from '@components/Waveform.vue'
import { t } from '@services/i18n'
import { store } from '@services/store'
import { ExternalApp } from 'types'
import { Application } from 'types/automation'
import { computed, onBeforeUnmount, onMounted, ref, toRaw } from 'vue'
import useAudioRecorder from '../audio/audio_recorder'
import useTranscriber from '../audio/transcriber'

import { CircleIcon, ClipboardIcon, CheckIcon, XIcon } from 'lucide-vue-next'

// init stuff
store.loadSettings()
const { transcriber, reinitialize } = useTranscriber(store.config)
const audioRecorder = useAudioRecorder(store.config)

type State = 'idle' | 'initializing' | 'recording' | 'processing'

const props = defineProps({
  extra: Object
})

const dictationEl = ref<HTMLElement | null>(null)
const state = ref<State>('idle')
const sourceApp = ref<Application | null>(null)
const appInfo = ref<ExternalApp | null>(null)
const appearance = ref<'panel' | 'notch'>('panel')
const notchHeight = ref(0)
const foregroundColorActive = ref('var(--text-color)')
const foregroundColorInactive = ref('var(--icon-color)')
const cancelled = ref(false)
const isVisible = ref(false)
const isClosing = ref(false)
const showOverlay = ref(false)
const hasMouseMoved = ref(false)
let configHash = ''
let pendingCloseText: string | undefined
let pendingCloseSourceApp: Application | null = null

const isNotchAppearance = computed(() => appearance.value === 'notch')

const iconColor = computed(() => isNotchAppearance.value ? '#888' : 'var(--icon-color)')

const clipboardIconColor = computed(() => isNotchAppearance.value ? '#666' : 'var(--faded-text-color)')

const showClipboardIcon = computed(() => !sourceApp.value && store.config.stt.quickDictation?.copyToClipboard)

const iconData = computed(() => {
  if (!appInfo.value?.icon) return ''
  return `data:${appInfo.value.icon.mimeType};base64,${appInfo.value.icon.contents}`
})

// compute a hash of the STT config to detect changes
const getConfigHash = () => {
  const stt = store.config.stt
  return JSON.stringify({ engine: stt.engine, model: stt.model, locale: stt.locale })
}

const onShow = async (params: any) => {

  // reset overlay state - only show on actual mouse enter
  showOverlay.value = false
  hasMouseMoved.value = false

  // parse source app
  if (params?.sourceApp) {
    try {
      sourceApp.value = JSON.parse(params.sourceApp)
      if (sourceApp.value?.path) {
        appInfo.value = window.api.file.getAppInfo(sourceApp.value.path)
      }
    } catch (error) {
      console.error('Error parsing sourceApp', error)
      sourceApp.value = null
      appInfo.value = null
    }
  } else {
    sourceApp.value = null
    appInfo.value = null
  }

  // parse appearance
  if (params?.appearance) {
    appearance.value = params.appearance as 'panel' | 'notch'
  }

  // parse notch height
  if (params?.notchHeight) {
    notchHeight.value = parseInt(params.notchHeight)
  }

  // set colors based on appearance
  updateColors()

  // trigger animation for notch appearance
  if (isNotchAppearance.value) {
    isVisible.value = false
    // use requestAnimationFrame to ensure initial state is rendered
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        isVisible.value = true
      })
    })
  } else {
    isVisible.value = true
  }

  // start recording
  cancelled.value = false
  await startRecording()

}

const onStopAndTranscribe = () => {
  if (state.value === 'recording') {
    stopAndTranscribe()
  }
}

const onFileModified = (file: string) => {
  if (file === 'settings') {
    store.loadSettings()
    // check if STT config changed
    const newHash = getConfigHash()
    if (newHash !== configHash) {
      console.log('[dictation] STT config changed, reinitializing engine')
      configHash = newHash
      reinitialize()
    }
  }
}

const updateColors = () => {
  if (appearance.value === 'notch') {
    foregroundColorInactive.value = '#888'
    foregroundColorActive.value = 'white'
  } else {
    // grab colors from CSS for panel appearance
    try {
      const dictationEl = document.querySelector('.dictation')
      if (dictationEl) {
        foregroundColorInactive.value = window.getComputedStyle(dictationEl).getPropertyValue('color')
        foregroundColorActive.value = window.getComputedStyle(dictationEl).getPropertyValue('color')
      }
    } catch (error) {
      console.error('Error getting colors:', error)
    }
  }
}

onMounted(async () => {

  // store initial config hash
  configHash = getConfigHash()

  // keyboard events
  document.addEventListener('keydown', onKeyDown)

  // listen for show event from main process (when window is shown)
  window.api.on('show', onShow)

  // listen for stop-and-transcribe from main process (when shortcut pressed again)
  window.api.on('stop-and-transcribe', onStopAndTranscribe)

  // listen for settings changes
  window.api.on('file-modified', onFileModified)

  // pre-initialize the transcriber only (no microphone access yet)
  // this loads the model so subsequent shows are faster
  try {
    await transcriber.initialize()
  } catch (error) {
    console.error('Error pre-initializing transcriber:', error)
  }

  // NOTE: Don't start recording here based on initial props
  // The window may be created hidden (background prep), so we wait for
  // explicit 'show' event from main process to start recording

})

onBeforeUnmount(() => {
  document.removeEventListener('keydown', onKeyDown)
  window.api.off('show', onShow)
  window.api.off('stop-and-transcribe', onStopAndTranscribe)
  window.api.off('file-modified', onFileModified)
  if (state.value === 'recording') {
    audioRecorder.stop()
  }
  audioRecorder.release()
})

const startRecording = async () => {

  state.value = 'initializing'

  try {

    // initialize the transcriber (will reuse if already initialized)
    await transcriber.initialize()

    // init our recorder
    await audioRecorder.initialize({

      pcm16bitStreaming: transcriber.requiresPcm16bits,
      listener: {

        onNoiseDetected: () => {
          // nothing to do
        },

        onAudioChunk: async (chunk) => {
          if (transcriber.streaming) {
            await transcriber.sendStreamingChunk(chunk)
          }
        },

        onSilenceDetected: () => {
          // auto stop on silence
          stopAndTranscribe()
        },

        onRecordingComplete: async (audioBlob: Blob, noiseDetected: boolean) => {
          // if no noise, just close
          if (!noiseDetected) {
            closeWindow()
            return
          }
          // transcribe and insert
          if (!cancelled.value) {
            await transcribeAndInsert(audioBlob)
          }
        }

      }

    })

    // start recording
    const useStreaming = transcriber.requiresStreaming
    audioRecorder.start(useStreaming)
    state.value = 'recording'

  } catch (err) {
    console.error('Error starting recording:', err)
    closeWindow()
  }

}

const stopAndTranscribe = () => {
  if (state.value !== 'recording') return
  state.value = 'processing'
  transcriber.endStreaming()
  audioRecorder.stop()
}

const transcribeAndInsert = async (audioBlob: Blob) => {

  let text = ''

  try {
    const response = await transcriber.transcribe(audioBlob)
    if (response.text && response.text.trim().length > 0) {
      text = response.text.trim()
    }
  } catch (error) {
    console.error('Error transcribing:', error)
  }

  // copy to clipboard if enabled
  if (text && store.config.stt.quickDictation?.copyToClipboard) {
    window.api.clipboard.writeText(text)
  }

  // close window, release focus, and paste text
  closeWindow(text)

}

const closeWindow = (text?: string) => {

  // stop and release recording to free the microphone
  if (state.value === 'recording') {
    audioRecorder.stop()
  }
  audioRecorder.release()
  state.value = 'idle'

  // reset overlay state
  showOverlay.value = false
  hasMouseMoved.value = false

  // animate collapse for notch appearance
  if (isNotchAppearance.value) {
    isClosing.value = true
    pendingCloseText = text
    pendingCloseSourceApp = toRaw(sourceApp.value)
    // actual close happens in onAnimationEnd
  } else {
    window.api.dictation.close(text || '', toRaw(sourceApp.value))
  }
}

const onAnimationEnd = () => {
  if (isClosing.value) {
    // animation complete, now actually close the window
    isClosing.value = false
    isVisible.value = false
    window.api.dictation.close(pendingCloseText || '', pendingCloseSourceApp)
    pendingCloseText = undefined
    pendingCloseSourceApp = null
  }
}

const cancelRecording = () => {
  if (state.value !== 'recording') return
  cancelled.value = true
  audioRecorder.stop()
  closeWindow()
}

const onMouseMove = () => {
  if (!hasMouseMoved.value) {
    hasMouseMoved.value = true
  }
  showOverlay.value = true
}

const onMouseLeave = () => {
  showOverlay.value = false
  hasMouseMoved.value = false
}

const onKeyDown = (event: KeyboardEvent) => {
  if (event.key === ' ') {
    event.preventDefault()
    if (state.value === 'recording') {
      stopAndTranscribe()
    }
  } else if (event.key === 'Escape') {
    event.preventDefault()
    if (state.value === 'recording') {
      cancelRecording()
    } else if (state.value === 'idle' || state.value === 'initializing') {
      closeWindow()
    }
  }
}

</script>

<style scoped>

body {
  background-color: var(--source-app-bg-color);
}

.dictation {

  --padding-top: 1rem;
  --padding-bottom: 0.5rem;
  padding-top: var(--padding-top);
  padding-bottom: var(--padding-bottom);
  height: calc(100vh + var(--padding-top) + var(--padding-bottom));

  background-color: var(--source-app-bg-color);

  display: grid;
  grid-template-columns: 2rem 1fr 2rem;
  grid-template-rows: 48px auto;
  align-items: center;
  color: var(--source-app-text-color);
  padding: 0 1rem;
  column-gap: 0.75rem;
  -webkit-app-region: drag;
  position: relative;
}

.dictation.notch {

  --padding-top: 0px;
  --padding-bottom: 0.5rem;
  padding-top: var(--padding-top);
  padding-bottom: var(--padding-bottom);
  height: calc(100vh - var(--padding-top) - var(--padding-bottom));

  grid-template-rows: 2rem 2rem auto;
  background-color: black;
  color: white;
  border-top-left-radius: 0;
  border-top-right-radius: 0;
  border-bottom-left-radius: 1rem;
  border-bottom-right-radius: 1rem;

  /* animation setup - start hidden at notch size */
  transform-origin: top center;
  transform: scale(0.625, 0.25);
  opacity: 0;
}

.dictation.notch.visible {
  animation: notch-grow 0.2s cubic-bezier(0.4, 0, 0.2, 1) forwards;
}

.dictation.notch.closing {
  animation: notch-shrink 0.2s cubic-bezier(0.4, 0, 0.2, 1) forwards;
}

@keyframes notch-grow {
  from {
    transform: scale(0.625, 0.25);
    opacity: 0;
  }
  to {
    transform: scale(1, 1);
    opacity: 1;
  }
}

@keyframes notch-shrink {
  from {
    transform: scale(1, 1);
    opacity: 1;
  }
  to {
    transform: scale(0.625, 0.25);
    opacity: 0;
  }
}

.dictation * {
  -webkit-app-region: no-drag;
}

.app-info {
  grid-column: 1;
  grid-row: 1;
  display: flex;
  align-items: center;
  justify-content: center;

  .icon {
    width: 32px;
    height: 32px;
  }

  svg.clipboard-icon {
    width: 24px;
    height: 24px;
  }
}

.visualizer {
  grid-column: 2;
  grid-row: 1;
  display: flex;
  justify-content: center;
  align-items: center;

  .processing {
    display: flex;
    gap: 1.5rem;
    .loader {
      width: 0.75rem;
      height: 0.75rem;
    }
  }

  .loader {
    width: 24px;
    height: 24px;
  }
}

.dictation.notch .visualizer {
  grid-row: 2;
  grid-column: 1 / -1;
}

.status {
  grid-column: 3;
  grid-row: 1;
  display: flex;
  align-items: center;
  justify-content: center;

  .recording, .idle {
    animation: pulse 1s ease-in-out infinite;
  }
}

.hint {
  grid-row: 2;
  grid-column: 1 / -1;
  margin-top: -2.5rem;
  font-size: var(--font-size-12);
  text-align: center;
  color: var(--faded-text-color);
}

.dictation.notch .hint {
  grid-row: 3;
  margin-top: 0rem;
}

.actions-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding-top: 1rem;
  background-color: transparent;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.15s ease-in-out, background-color 0.15s ease-in-out;
  border-radius: inherit;
}

.dictation.show-overlay .actions-overlay {
  opacity: 1;
  pointer-events: auto;
  background-color: rgba(0, 0, 0, 0.66);
}

.dictation.notch .actions-overlay {
  align-items: center;
  padding-top: 0;
}

.dictation.notch.show-overlay .actions-overlay {
  background-color: rgba(0, 0, 0, 0.8);
}

.actions {
  display: flex;
  gap: 0.5rem;
  justify-content: center;
  align-items: center;
}

.action-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0.5rem 1rem;
  border: none;
  border-radius: 0.5rem;
  font-size: var(--font-size-12);
  cursor: pointer;
  transition: all 0.15s ease-in-out;
  gap: 0.375rem;
}

.finish-btn {
  background-color: color-mix(in srgb, var(--color-primary) 80%, transparent);
  color: white;
}

.finish-btn:hover {
  background-color: color-mix(in srgb, var(--color-primary) 100%, transparent);
}

.cancel-btn {
  background-color: color-mix(in srgb, var(--color-error) 80%, transparent);
  color: white;
}

.cancel-btn:hover {
  background-color: color-mix(in srgb, var(--color-error) 100%, transparent);
}

@keyframes pulse {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.75;
  }
}

</style>
