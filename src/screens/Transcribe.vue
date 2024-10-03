<template>
  <div class="transcribe">
    <div class="controls">
      <BIconRecordCircle v-if="state == 'recording'" color="red" @click="onStop()" />
      <Loader class="loader" v-else-if="state == 'processing'" />
      <BIconRecordCircle v-else @click="onRecord()" />
      <canvas ref="waveForm" width="310" height="32" />
    </div>
    <div class="result">
      <textarea v-model="transcription" placeholder="Click the record button when you are ready!" />
    </div>
    <div class="actions">
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
import Loader from '../components/Loader.vue'
import getSTTEngine from '../services/stt'

// load store
store.loadSettings()

const state = ref('idle')
const transcription = ref('')
const waveForm = ref(null)

onMounted(() => {
  document.addEventListener('keydown', onKeyDown)
  initializeEngine()
  initializeAudio()
})

// stt engine
let sttEngine = null

const initializeEngine = async () => {
  sttEngine = getSTTEngine(store.config)
  await sttEngine.initialize()
}

// recording stuff
let mediaRecorder
let audioChunks = []
const silenceThreshold = 0.03

const initializeAudio = async () => {

  try {

    // init our recorder
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    mediaRecorder = new MediaRecorder(stream)
    mediaRecorder.ondataavailable = (event) => {
      audioChunks.push(event.data)
    }
    mediaRecorder.onstop = (event) => {
      transcribe(audioChunks)
    }
    
    // now connect the microphone
    const audioContext = new (window.AudioContext || window.webkitAudioContext)()
    const analyser = audioContext.createAnalyser()
    const microphone = audioContext.createMediaStreamSource(stream)
    microphone.connect(analyser)

    // and setup the analyser
    analyser.fftSize = 256
    const bufferLength = analyser.frequencyBinCount
    const dataArray = new Uint8Array(bufferLength)

    // now draw the waveform
    draw(analyser, bufferLength, dataArray, (silence) => {
      if (silence && state.value === 'recording') {
        onStop()
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
    if (sttEngine === null || sttEngine.isReady() === false) {
      alert('Speech-to-text engine not ready')
      return
    }

    // reset
    audioChunks = []

    // start the recording
    mediaRecorder.start()

    // update the status
    state.value = 'recording'

  } catch (err) {
    console.error('Error accessing microphone:', err)
    alert('Error accessing microphone')
  }

}

const onStop = () => {

  // update state now
  state.value = 'processing'

  // now we can stop
  mediaRecorder.stop()

}

// drawing constants
const bufferIncrement = 2
const horizontalScale = 1
const verticalScale = 4.0
const sampleIntervalMs = 100

// interpolation between samples
let previousDataArray = null
let currentDataArray = null
let interpolationProgress = 0
let lastSampleTime = 0

// silence detection
let lastNoise = null

const draw = (analyser, bufferLength, dataArray, silenceCallback) => {

  // request next animation
  requestAnimationFrame(() => draw(analyser, bufferLength, dataArray, silenceCallback))

  // we need a canvas
  const canvas = waveForm.value
  if (!canvas) {
    //console.error('Canvas not ready');
    return;
  }

  // sample every sampleIntervalMs
  const now = new Date().getTime()
  if (now - lastSampleTime >= sampleIntervalMs) {

    // get the data and save it
    analyser?.getByteTimeDomainData(dataArray)
    previousDataArray = currentDataArray ? [...currentDataArray] : [...dataArray]
    currentDataArray = [...dataArray]
    lastSampleTime = now
    interpolationProgress = 0

  } else {

    // we are interpolating
    interpolationProgress = (now - lastSampleTime) / sampleIntervalMs
  
  }

  // needed
  const isRecording = state.value === 'recording'

  // now init the drawing
  const canvasCtx = canvas.getContext('2d')
  canvasCtx.fillStyle = 'rgb(231, 230, 229)'
  canvasCtx.fillRect(0, 0, canvas.width, canvas.height)
  canvasCtx.fillStyle = isRecording ? 'rgb(32,32,32)' : 'rgb(128,128,128)'

  // some parameters
  const barWidth = canvas.width / bufferLength * horizontalScale
  const centerY = canvas.height / 2

  // silence detection
  let silent = true

  // now iterate
  for (let i = 0; i < bufferLength; i += bufferIncrement) {

    // default value (silence)
    let v = 1.0

    // if we can interpolate do it
    // else grab directly from dataArray
    if (previousDataArray && currentDataArray) {
      const prevV = previousDataArray[i] / 128.0
      const currV = currentDataArray[i] / 128.0
      v = prevV + (currV - prevV) * interpolationProgress
    } else {
      v = dataArray[i] / 128.0
    }

    // measure silence
    if (Math.abs(v - 1.0) > silenceThreshold) {
      silent = false
    }

    // drawing vars
    const x = i * barWidth
    let barHeight = (v - 1) * centerY * verticalScale

    // we want to draw at least a dot
    if (Math.abs(barHeight) < 1) {
      barHeight = 1
    }
    
    // now draw it
    canvasCtx.fillRect(x, centerY - Math.abs(barHeight), barWidth - 1, Math.abs(barHeight * 2))

  }

  // silence detection
  if (isRecording && silent && store.config.stt.silenceDetection) {
    if (lastNoise == null) {
      lastNoise = now
    } else if (now - lastNoise > store.config.stt.silenceDuration) {
      silenceCallback(true)
    }
  } else {
    lastNoise = null
  }
}

const transcribe = async (audioChunks) => {

  try {

    // get the chunks as audio/webm
    const audioBlob = new Blob(audioChunks, { type: 'audio/webm' })

    // now transcribe
    const response = await sttEngine.transcribe(audioBlob)

    // add a space if needed
    if (transcription.value.length && ',;.?!'.indexOf(transcription.value[transcription.value.length - 1]) !== -1) {
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