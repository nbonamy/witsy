<template>
  <div class="transcribe">
    <div class="controls">
      <BIconRecordCircle v-if="state == 'recording'" color="red" @click="onStop()" />
      <Loader class="loader" v-else-if="state == 'processing'" />
      <BIconRecordCircle v-else @click="onRecord()" />
      <Waveform :width="310" :height="32" :audioRecorder="audioRecorder" :is-recording="state == 'recording'"/>
    </div>
    <div class="result">
      <textarea v-model="transcription" placeholder="Click the record button when you are ready!" />
    </div>
    <div class="actions">
      <button class="button" v-if="state == 'recording'" @click="onStop()">Stop</button>
      <button class="button" v-else @click="onRecord()">Record</button>
      <button class="button" @click="onClear()">Clear</button>
      <button class="button push" @click="onCancel()">Cancel</button>
      <button class="button" @click="onInsert()">Insert</button>
      <button class="button " @click="onCopy()">Copy</button>
    </div>
  </div>
</template>

<script setup>

import { ref, onMounted } from 'vue'
import { store } from '../services/store'
import Waveform from '../components/Waveform.vue'
import Loader from '../components/Loader.vue'
import useTranscriber from '../composables/transcriber'
import useAudioRecorder from '../composables/audio_recorder'

// init stuff
store.loadSettings()
const transcriber = useTranscriber(store.config)
const audioRecorder = useAudioRecorder(store.config)
let userStoppedDictation = false

const state = ref('idle')
const transcription = ref('')
const waveForm = ref(null)

onMounted(() => {
  document.addEventListener('keydown', onKeyDown)
  transcriber.initialize()
  initializeAudio()
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
    alert('Error accessing microphone')
  }

}

const onRecord = async () => {

  try {

    // check
    if (transcriber.isReady() === false) {
      alert('Speech-to-text engine not ready')
      return
    }

    // start the recording
    audioRecorder.start()

    // update the status
    state.value = 'recording'

  } catch (err) {
    console.error('Error accessing microphone:', err)
    alert('Error accessing microphone')
  }

}

const onStop = () => {
  stopDictation(true)
}

const stopDictation = async (userStopped) => {
  userStoppedDictation = userStopped
  state.value = 'processing'
  audioRecorder.stop()
}

const transcribe = async (audioChunks) => {

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
    alert('Error occurred during transcription')
  }

}

const onKeyDown = (event) => {
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

</script>

<style scoped>

.transcribe {
  
  height: 100vh;
  display: flex;
  flex-direction: column;
  background-color: #e7e6e5;
  font-size: 18pt;
  padding: 16px 24px;
  -webkit-app-region: drag;

  .controls {
    display: flex;
    flex-direction: row;
    justify-content: space-between;
    align-items: center;
  }

  .result {
    display: flex;
    flex: 0 0 180px;
    margin-top: 16px;
    textarea {
      flex: 1;
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

  svg, textarea, button {
    -webkit-app-region: no-drag;
  }

  .loader {
    margin: 8px;
  }
}

</style>