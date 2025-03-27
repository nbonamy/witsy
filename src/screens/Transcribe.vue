<template>
  <div class="transcribe">
    <div class="controls">
      <BIconRecordCircle v-if="state == 'recording'" color="red" @click="onStop()" />
      <Loader class="loader" v-else-if="state == 'processing'" />
      <BIconRecordCircle v-else @click="onRecord()" />
      <Waveform :width="350" :height="32" :foreground-color-inactive="foregroundColorInactive" :foreground-color-active="foregroundColorActive" :audio-recorder="audioRecorder" :is-recording="state == 'recording'"/>
    </div>
    <div class="result">
      <textarea v-model="transcription" :placeholder="t('transcribe.clickToRecord')" />
    </div>
    <div class="actions">
      <button class="button" v-if="state == 'recording'" @click="onStop()">{{ t('common.stop') }}</button>
      <button class="button" v-else @click="onRecord()">{{ t('common.record') }}</button>
      <button class="button" @click="onClear()">{{ t('common.clear') }}</button>
      <button class="button push" @click="onCancel()">{{ t('common.cancel') }}</button>
      <button class="button" @click="onInsert()" v-if="!isMas">{{ t('common.insert') }}</button>
      <button class="button" @click="onCopy()">{{ t('common.copy') }}</button>
    </div>
    <form class="option">
      <div class="group">
        <input type="checkbox" v-model="autoStart" @change="save" />
        <label>{{ t('transcribe.autoStart') }}</label>
      </div>
    </form>
  </div>
</template>

<script setup lang="ts">

import { Ref, ref, onMounted } from 'vue'
import { store } from '../services/store'
import { t } from '../services/i18n'
import Waveform from '../components/Waveform.vue'
import Loader from '../components/Loader.vue'
import useTranscriber from '../composables/transcriber'
import useAudioRecorder from '../composables/audio_recorder'
import Dialog from '../composables/dialog'

// init stuff
store.loadSettings()
const transcriber = useTranscriber(store.config)
const audioRecorder = useAudioRecorder(store.config)
let userStoppedDictation = false

const isMas = ref(false)
const state: Ref<'idle'|'recording'|'processing'> = ref('idle')
const transcription = ref('')
const autoStart = ref(false)
const foregroundColorActive = ref(null)
const foregroundColorInactive = ref(null)

onMounted(async () => {

  // events
  document.addEventListener('keydown', onKeyDown)

  // init
  await transcriber.initialize()
  await initializeAudio()
  
  // grab colors
  try {
    foregroundColorInactive.value = window.getComputedStyle(document.querySelector('.transcribe')).getPropertyValue('color')
    foregroundColorActive.value = window.getComputedStyle(document.querySelector('.controls')).getPropertyValue('color')
  } catch (error) {
    if (!process.env.TEST) {
      console.error('Error getting colors:', error)
    }
  }

  // other stuff
  autoStart.value = store.config.stt.autoStart
  isMas.value = window.api.isMasBuild

  // auto start?
  if (autoStart.value) {
    onRecord()
  }

})

const initializeAudio = async () => {

  try {

    // init our recorder
    await audioRecorder.initialize({

      onNoiseDetected: () => {
      },

      onSilenceDetected: () => {

        // // depends on configuration
        // if (store.config.stt.silenceAction === 'nothing') {
        //   return
        // }

        // stop
        stopDictation(false)

      },
      onRecordingComplete: async (audioChunks, noiseDetected) => {

        // if no noise stop everything
        if (!noiseDetected) {
          state.value = 'idle'
          return
        }

        // transcribe
        await transcribe(audioChunks)

        // execute?
        if (userStoppedDictation === false/* && store.config.stt.silenceAction === 'execute_continue'*/) {
          onRecord()
        }
      }

    })
    
  } catch (err) {
    console.error('Error accessing microphone:', err)
    Dialog.alert(t('transcribe.errorMicrophone'))
  }

}

const onRecord = async () => {

  try {

    // check
    if (transcriber.isReady() === false) {
      Dialog.alert(t('transcribe.errorSTTNotReady'))
      return
    }

    // start the recording
    audioRecorder.start()

    // update the status
    state.value = 'recording'

  } catch (err) {
    console.error('Error accessing microphone:', err)
    Dialog.alert(t('transcribe.errorMicrophone'))
  }

}

const onStop = () => {
  stopDictation(true)
}

const stopDictation = async (userStopped: boolean) => {
  userStoppedDictation = userStopped
  state.value = 'processing'
  audioRecorder.stop()
}

const transcribe = async (audioChunks: any[]) => {

  try {

    const response = await transcriber.transcribe(audioChunks)

    // add a space if needed
    if (transcription.value.length && ',;.?!'.indexOf(transcription.value[transcription.value.length - 1]) !== -1 && response.text[0] !== ' ') {
      transcription.value += ' '
    }
    transcription.value += response.text

    // done
    state.value = 'idle'

  } catch (error) {
    console.error('Error:', error)
    Dialog.alert(t('transcribe.errorTranscription'))
  }

}

const onKeyDown = (event: KeyboardEvent) => {
  if (event.key === 'Escape') {
    onCancel()
  }
  if (event.key === 'c' && event.metaKey) {
    onCopy()
  }
  if (event.key === 'v' && event.metaKey) {
    onInsert()
  }
}

const onClear = () => {
  transcription.value = ''
}

const onCopy = async () => {
  await navigator.clipboard.writeText(transcription.value)
  onCancel()
}

const onInsert = () => {
  window.api.transcribe.insert(transcription.value)
}

const onCancel = () => {
  window.api.transcribe.cancel()
}

const save = () => {
  store.config.stt.autoStart = autoStart.value
  store.saveSettings()
}

</script>

<style scoped>
@import '../../css/form.css';
</style>

<style scoped>

.transcribe {
  
  height: 100vh;
  display: flex;
  flex-direction: column;
  background-color: var(--window-bg-color);
  color: var(--control-placeholder-text-color);
  font-size: 10pt;
  padding: 16px 24px;
  -webkit-app-region: drag;

  > *:last-child {
    margin-bottom: 32px;
  }

  textarea {
    outline: none;
  }

  .controls {
    display: flex;
    flex-direction: row;
    justify-content: flex-start;
    font-size: 18pt;
    gap: 32px;
    align-items: center;
    color: var(--text-color);
  }

  .result {
    display: flex;
    flex: 1;
    margin-top: 16px;
    textarea {
      flex: 1;
      background-color: var(--control-textarea-bg-color);
      color: var(--text-color);
      border-radius: 6px;
      font-size: 11.5pt;
      padding: 8px;
      border: none;
      resize: none;
    }
  }

  .actions {
    margin-top: 8px;
    display: flex;
    flex-direction: row;

    .push {
      margin-left: auto;
    }
  }

  .option {
    margin-top: 8px;
    .group {
      padding: 0;
      margin: 0;
      display: flex;
      gap: 4px;
    }
    input[type=checkbox] {
      flex: 0 0 14px;
    }
  }

  svg, input, textarea, button {
    -webkit-app-region: no-drag;
  }

  .loader {
    margin: 8px;
  }
}

</style>