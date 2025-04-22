<template>
  <div class="transcribe">
    <div class="controls">
      <BIconRecordCircle v-if="state == 'recording'" class="stop" color="red" @click="onStop()" />
      <Loader class="loader" v-else-if="state === 'processing'" />
      <BIconRecordCircle v-else class="record" @click="onRecord(false)" />
      <Waveform :width="350" :height="32" :foreground-color-inactive="foregroundColorInactive" :foreground-color-active="foregroundColorActive" :audio-recorder="audioRecorder" :is-recording="state == 'recording'"/>
    </div>
    <div class="result">
      <textarea v-model="transcription" :placeholder="t('transcribe.clickToRecord') + ' ' + t(pushToTalk ? 'transcribe.spaceKeyHint.pushToTalk' : 'transcribe.spaceKeyHint.toggle')" />
    </div>
    <div class="actions">
      <button name="stop" class="button" v-if="state == 'recording'" @click="onStop()">{{ t('common.stop') }}</button>
      <button name="record" class="button" v-else @click="onRecord(false)" :disabled="state === 'processing'">{{ t('common.record') }}</button>
      <button name="clear" class="button" @click="onClear()" :disabled="state === 'processing'">{{ t('common.clear') }}</button>
      <button name="cancel" class="button push" @click="onCancel()">{{ t('common.cancel') }}</button>
      <button name="insert" class="button" @click="onInsert()" v-if="!isMas">{{ t('common.insert') }}</button>
      <button name="copy" class="button" @click="onCopy()">{{ t('common.copy') }}</button>
    </div>
    <form class="option">
      <div class="group">
        <input type="checkbox" name="autoStart" v-model="autoStart" @change="save" :disabled="pushToTalk" />
        <label class="no-colon">{{ t('transcribe.autoStart') }}</label>
      </div>
      <div class="group">
        <input type="checkbox" name="pushToTalk" v-model="pushToTalk" @change="save" :disabled="autoStart" />
        <label class="no-colon">{{ t('transcribe.spaceToTalk') }}</label>
      </div>
    </form>
  </div>
</template>

<script setup lang="ts">

import { Ref, ref, onMounted, onUnmounted } from 'vue'
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
let pushToTalkMode = false

const isMas = ref(false)
const pushToTalk = ref(false)
const state: Ref<'idle'|'recording'|'processing'> = ref('idle')
const transcription = ref('')
const autoStart = ref(false)
const foregroundColorActive = ref('')
const foregroundColorInactive = ref('')

onMounted(async () => {

  // events
  document.addEventListener('keydown', onKeyDown)
  document.addEventListener('keyup', onKeyUp)
  window.api.on('start-dictation', toggleRecord)

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
  pushToTalk.value = store.config.stt.pushToTalk
  isMas.value = window.api.isMasBuild

  // auto start?
  if (autoStart.value) {
    onRecord(false)
  }

})

onUnmounted(() => {
  document.removeEventListener('keydown', onKeyDown)
  document.removeEventListener('keyup', onKeyUp)
  window.api.off('start-dictation', toggleRecord)
})

const toggleRecord = () => {
  if (state.value === 'processing') {
    return
  } else if (state.value === 'recording') {
    onStop()
  } else {
    onRecord(false)
  }
  refocus()
}

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
        if (!pushToTalkMode) {
          stopDictation(false)
        }

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
          onRecord(false)
        }
      }

    })
    
  } catch (err) {
    console.error('Error accessing microphone:', err)
    Dialog.alert(t('transcribe.errorMicrophone'))
  }

}

const onRecord = async (ptt: boolean) => {

  try {

    // check
    if (transcriber.isReady() === false) {
      Dialog.alert(t('transcribe.errorSTTNotReady'))
      return
    }

    // start the recording
    pushToTalkMode = ptt
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
  refocus()
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
    Dialog.alert(t('transcribe.errorTranscription'), error.message)
  }

}

const onKeyDown = (event: KeyboardEvent) => {
  const isCommand = !event.shiftKey && !event.altKey && (event.metaKey || event.ctrlKey)
  if (event.key === 'Escape') {
    onCancel()
  } else if (event.code === 'Space') {
    if (state.value !== 'recording') {
      onRecord(pushToTalk.value)
    } else if (!pushToTalk.value) {
      onStop()
    }
  } else if (event.key === 'Enter' && isCommand) {
    event.preventDefault()
    onInsert()
  } else if (event.key === 'Backspace') {
    transcription.value = transcription.value.slice(0, -1)
  } else if (event.key === 'Delete') {
    onClear()
  } else if (event.key === 'c' && isCommand) {
    onCopy()
  } else if (event.key === 'i' && isCommand) {
    onInsert()
  }
}

const onKeyUp = (event: KeyboardEvent) => {
  //const isCommand = !event.shiftKey && !event.altKey && (event.metaKey || event.ctrlKey)
  if (event.code === 'Space') {
    if (pushToTalkMode && state.value === 'recording') {
      onStop()
    }
  }
}

const onClear = () => {
  transcription.value = ''
  refocus()
}

const onCopy = async () => {
  window.api.clipboard.writeText(transcription.value)
  if (window.api.clipboard.readText() != transcription.value) {
    Dialog.alert(t('transcribe.errorCopy'))
    return
  }
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
  store.config.stt.pushToTalk = pushToTalk.value
  store.saveSettings()
  refocus()
}

const refocus = () => {
  const focusedElement = document.activeElement as HTMLElement
  focusedElement?.blur()
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

  input, textarea, button {
    outline: none;
  }

  .controls {
    margin-left: 8px;
    display: flex;
    flex-direction: row;
    justify-content: flex-start;
    font-size: 18pt;
    gap: 24px;
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

      &::placeholder {
        padding: 32px;
        position: relative !important;
        top: 50% !important;
        transform: translateY(-50%) !important; 
        text-align: center;
        line-height: 140%;
        font-family: Garamond, Georgia, Times, 'Times New Roman', serif;
        font-size: 14pt;
      }
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
      margin: 4px 0px;
      display: flex;
      gap: 4px;
    }
    input[type=checkbox] {
      flex: 0 0 14px;
    }
    label {
      margin-left: 4px;
      min-width: fit-content;
    }
    select {
      flex: 0;
      width: auto;
      outline: none;
    }
  }

  svg, input, textarea, button, select {
    -webkit-app-region: no-drag;
  }

  .loader {
    margin: 8px;
    background-color: orange;
  }
}

</style>