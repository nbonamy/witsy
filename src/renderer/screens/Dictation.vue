<template>
  <div class="dictation" :class="{ notch: isNotchAppearance }">
    <div class="app-info" v-if="sourceApp">
      <img class="icon" :src="iconData" />
    </div>
    <div class="visualizer">
      <div class="processing" v-if="state === 'processing'">
        <Loader />
        <Loader />
        <Loader />
      </div>
      <Waveform v-else :width="200" :height="32" :foreground-color-inactive="foregroundColorInactive" :foreground-color-active="foregroundColorActive" :audio-recorder="audioRecorder" :is-recording="state === 'recording'" />
    </div>
    <div class="status">
      <CircleIcon v-if="state === 'recording'" class="recording" :size="16" color="red" fill="red" />
      <CircleIcon v-else-if="state === 'idle' || state === 'initializing'" class="idle" :size="16" :color="state === 'initializing' ? 'orange' : iconColor" :fill="state === 'initializing' ? 'orange' : 'transparent'" />
    </div>
  </div>
</template>

<script setup lang="ts">

import { computed, onMounted, onBeforeUnmount, ref, toRaw } from 'vue'
import Loader from '@components/Loader.vue'
import Waveform from '@components/Waveform.vue'
import useAudioRecorder from '../audio/audio_recorder'
import useTranscriber from '../audio/transcriber'
import { store } from '@services/store'
import { Application } from 'types/automation'
import { ExternalApp } from 'types'

import { CircleIcon } from 'lucide-vue-next'
import { L } from 'vitest/dist/chunks/reporters.d.BFLkQcL6'

// init stuff
store.loadSettings()
const { transcriber } = useTranscriber(store.config)
const audioRecorder = useAudioRecorder(store.config)

type State = 'idle' | 'initializing' | 'recording' | 'processing'

const props = defineProps({
  extra: Object
})

const state = ref<State>('idle')
const sourceApp = ref<Application | null>(null)
const appInfo = ref<ExternalApp | null>(null)
const appearance = ref<'panel' | 'notch'>('panel')
const notchHeight = ref(0)
const foregroundColorActive = ref('var(--text-color)')
const foregroundColorInactive = ref('var(--icon-color)')
let escapeTimeout: ReturnType<typeof setTimeout> | null = null

const isNotchAppearance = computed(() => appearance.value === 'notch')

const iconColor = computed(() => isNotchAppearance.value ? '#888' : 'var(--icon-color)')

const iconData = computed(() => {
  if (!appInfo.value?.icon) return ''
  return `data:${appInfo.value.icon.mimeType};base64,${appInfo.value.icon.contents}`
})

const onStopAndTranscribe = () => {
  if (state.value === 'recording') {
    stopAndTranscribe()
  }
}

onMounted(async () => {

  // parse source app from query params
  if (props.extra?.sourceApp) {
    try {
      sourceApp.value = JSON.parse(props.extra.sourceApp)
      if (sourceApp.value?.path) {
        appInfo.value = window.api.file.getAppInfo(sourceApp.value.path)
      }
    } catch (error) {
      console.error('Error parsing sourceApp', error)
    }
  }

  // parse appearance from query params
  if (props.extra?.appearance) {
    appearance.value = props.extra.appearance as 'panel' | 'notch'
  }

  // parse notch height from query params
  if (props.extra?.notchHeight) {
    notchHeight.value = parseInt(props.extra.notchHeight)
  }

  // keyboard events
  document.addEventListener('keydown', onKeyDown)

  // listen for stop-and-transcribe from main process (when shortcut pressed again)
  window.api.on('stop-and-transcribe', onStopAndTranscribe)

  // set colors based on appearance
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

  // auto-start recording
  await startRecording()

})

onBeforeUnmount(() => {
  document.removeEventListener('keydown', onKeyDown)
  window.api.off('stop-and-transcribe', onStopAndTranscribe)
  if (escapeTimeout) {
    clearTimeout(escapeTimeout)
  }
  if (state.value === 'recording') {
    audioRecorder.stop()
  }
  audioRecorder.release()
})

const startRecording = async () => {

  state.value = 'initializing'

  try {

    // initialize the transcriber
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
          await transcribeAndInsert(audioBlob)
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

  try {

    const response = await transcriber.transcribe(audioBlob)

    if (response.text && response.text.trim().length > 0) {
      const text = response.text.trim()

      // copy to clipboard if enabled
      if (store.config.stt.quickDictation?.copyToClipboard) {
        window.api.clipboard.writeText(text)
      }

      // insert text into source app
      window.api.transcribe.insert(text)
    }

  } catch (error) {
    console.error('Error transcribing:', error)
  } finally {
    closeWindow()
  }

}

const closeWindow = () => {
  window.api.dictation.close(toRaw(sourceApp.value))
}

const cancelRecording = () => {
  if (state.value !== 'recording') return
  audioRecorder.stop()
  closeWindow()
}

const onKeyDown = (event: KeyboardEvent) => {
  if (event.key === 'Escape') {
    event.preventDefault()

    if (state.value === 'recording') {
      if (escapeTimeout) {
        // Double escape = cancel recording
        clearTimeout(escapeTimeout)
        escapeTimeout = null
        cancelRecording()
      } else {
        // First escape = wait 200ms then stop and transcribe
        escapeTimeout = setTimeout(() => {
          escapeTimeout = null
          stopAndTranscribe()
        }, 200)
      }
    } else if (state.value === 'idle' || state.value === 'initializing') {
      closeWindow()
    }
  }
}

</script>

<style scoped>

.dictation {
  height: 100vh;
  display: flex;
  flex-direction: row;
  align-items: center;
  background-color: var(--source-app-bg-color);
  color: var(--source-app-text-color);
  padding: 0 16px;
  gap: 12px;
  -webkit-app-region: drag;
}

.dictation.notch {
  padding-top: 8px;
  height: calc(100vh - 8px);
  background-color: black;
  color: white;
  border-top-left-radius: 0;
  border-top-right-radius: 0;
  border-bottom-left-radius: 16px;
  border-bottom-right-radius: 16px;
}

.dictation * {
  -webkit-app-region: no-drag;
}

.app-info {
  flex: 0 0 auto;
  display: flex;
  align-items: center;

  .icon {
    width: 32px;
    height: 32px;
  }
}

.visualizer {
  flex: 1;
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

.status {
  flex: 0 0 auto;
  display: flex;
  align-items: center;

  .recording {
    animation: pulse 1s ease-in-out infinite;
  }
}

@keyframes pulse {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.5;
  }
}

</style>
