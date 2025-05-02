
<template>
  <canvas ref="waveform" :width="width" :height="height" />
</template>

<script setup lang="ts">

import { ref, onMounted, type Ref } from 'vue'

const props = defineProps({
  width: Number,
  height: Number,
  foregroundColorInactive: {
    type: String,
    required: true,
  },
  foregroundColorActive: {
    type: String,
    required: true,
  },
  isRecording: Boolean,
  audioRecorder: Object
})

const waveform: Ref<HTMLCanvasElement|null> = ref(null)

onMounted(() => {
  draw()
})

// drawing constants
const bufferIncrement = 2
const horizontalScale = 1
const verticalScale = 4.0
const sampleIntervalMs = 100

// interpolation between samples
let dataArray: Uint8Array|null = null
let previousDataArray: Uint8Array|null = null
let currentDataArray: Uint8Array|null = null
let interpolationProgress = 0
let lastSampleTime = 0

const draw = () => {

  try {

    // we need a canvas
    const canvas = waveform.value
    if (!canvas) {
      //console.error('Canvas not ready');
      return;
    }

    // we need an audio recorder
    if (!props.audioRecorder || !props.audioRecorder.getAnalyser()) {
      //console.error('AudioRecorder not ready');
      return;
    }

    // we need that
    const bufferLength = props.audioRecorder.getBufferLength()

    // sample every sampleIntervalMs
    const now = new Date().getTime()
    if (now - lastSampleTime >= sampleIntervalMs) {

      // allocate
      if (dataArray === null) {
        dataArray = new Uint8Array(bufferLength)
      }

      // get the data and save it
      props.audioRecorder.getAnalyser().getByteTimeDomainData(dataArray)
      if (dataArray.length === bufferLength) {
        previousDataArray = currentDataArray ? currentDataArray.slice() : dataArray.slice()
        currentDataArray = dataArray.slice()
        lastSampleTime = now
        interpolationProgress = 0
      } else {
        dataArray = null
        previousDataArray = null
        currentDataArray = null
        lastSampleTime = 0
        interpolationProgress = 0
      }

    } else {

      // we are interpolating
      interpolationProgress = (now - lastSampleTime) / sampleIntervalMs
    
    }

    // now init the drawing
    const canvasCtx = canvas.getContext('2d')
    canvasCtx!.clearRect(0, 0, canvas.width, canvas.height)
    canvasCtx!.fillStyle = props.isRecording ? props.foregroundColorActive : props.foregroundColorInactive

    // some parameters
    const barWidth = canvas.width / bufferLength * horizontalScale
    const centerY = canvas.height / 2

    // now iterate
    for (let i = 0; i < bufferLength; i += bufferIncrement) {

      // default value (silence)
      let v = 1.0

      // if we can interpolate do it
      // else grab directly from dataArray
      if (previousDataArray?.[i] && currentDataArray?.[i]) {
        const prevV = previousDataArray[i] / 128.0
        const currV = currentDataArray[i] / 128.0
        v = prevV + (currV - prevV) * interpolationProgress
      } else if (currentDataArray?.[i]) {
        v = currentDataArray[i] / 128.0
      }

      //console.log('v', v)

      // drawing vars
      const x = i * barWidth
      let barHeight = (v - 1) * centerY * verticalScale

      // we want to draw at least a dot
      if (Math.abs(barHeight) < 1) {
        barHeight = 1
      }
      
      // now draw it
      canvasCtx!.fillRect(x, centerY - Math.abs(barHeight), barWidth - 1, Math.abs(barHeight * 2))

    }

  } catch (e) {

    console.error('Error drawing waveform', e);

  } finally {

    // request next animation
    requestAnimationFrame(() => draw())

  }

}

</script>