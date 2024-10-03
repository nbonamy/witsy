

import { Configuration } from 'types/config.d'
import { store } from '../services/store'

export interface AudioRecorderListener {
  onSilenceDetected: () => void
  onRecordingComplete: (audioChunks: any[]) => void
}

class AudioRecorder {

  readonly silenceThreshold = 2

  config: Configuration
  listener: AudioRecorderListener
  mediaRecorder: MediaRecorder
  audioChunks: any[]
  analyser: AnalyserNode
  bufferLength: number
  dataArray: Uint8Array
  sampler: NodeJS.Timeout
  lastNoise: number

  constructor(config: Configuration) {
    this.config = config
    this.mediaRecorder = null
    this.audioChunks = []
  }

  getAnalyser(): AnalyserNode {
    return this.analyser
  }
  
  getBufferLength(): number {
    return this.bufferLength
  }

  async initialize(listener: AudioRecorderListener): Promise<void> {

    // save the listener
    this.listener = listener

    // the media recorder
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    this.mediaRecorder = new MediaRecorder(stream)
    this.mediaRecorder.ondataavailable = (event) => {
      this.audioChunks.push(event.data)
    }
    this.mediaRecorder.onstop = () => {
      this.listener.onRecordingComplete(this.audioChunks)
    }

    // now connect the microphone
    const audioContext = new window.AudioContext()
    const microphone = audioContext.createMediaStreamSource(stream)
    this.analyser = audioContext.createAnalyser()
    microphone.connect(this.analyser)

    // and setup the analyser
    this.analyser.fftSize = 256
    this.bufferLength = this.analyser.frequencyBinCount
    this.dataArray = new Uint8Array(this.bufferLength)

  }

  start(): void {
    if (this.mediaRecorder) {
      this.audioChunks = []
      this.mediaRecorder.start()
      this.lastNoise = new Date().getTime()
      this.sampler = setInterval(() => this.detectSilence(), 250)
    }
  }

  stop(): void {
    if (this.mediaRecorder) {
      clearInterval(this.sampler)
      this.mediaRecorder.stop()
    }
  }

  private detectSilence(): void {
    
    // get the data
    let silence = true
    const now = new Date().getTime()
    this.analyser.getByteTimeDomainData(this.dataArray)

    // scan
    for (let i = 0; i < this.dataArray.length; i++) {
      if (Math.abs(this.dataArray[i] - 128) > this.silenceThreshold) {
        silence = false
        break
      }
    }

    // not silence
    if (!silence) {
      this.lastNoise = now
      return
    }

    // if silence detected
    if (now - this.lastNoise > this.config.stt.silenceDuration) {
      this.listener.onSilenceDetected()
    }

  }

}

export default function useAudioRecorder() {
  return new AudioRecorder(store.config)
}
