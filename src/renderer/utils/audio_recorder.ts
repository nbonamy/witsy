import { type Configuration } from 'types/config'
import fixWebmDuration from 'fix-webm-duration'

export type AudioRecorderInitOptions = {
  listener: AudioRecorderListener
  pcm16bitStreaming: boolean
}

export interface AudioRecorderListener {
  onNoiseDetected: () => void
  onSilenceDetected: () => void
  onRecordingComplete: (audioBlob: Blob, noiseDetected: boolean) => void
  onAudioChunk: (chunk: Blob) => void
}

const closeStream = (stream: MediaStream) => {
  stream?.getTracks().forEach(function(track) {
    track.stop();
  });
}

export const isAudioRecordingSupported = (): boolean => {
  // First check if the API is available
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    return false;
  }
  
  // Then check if the browser supports audio constraints
  const supportedConstraints = navigator.mediaDevices.getSupportedConstraints();
  if (!supportedConstraints.echoCancellation || !supportedConstraints.autoGainControl) {
    // These are common audio constraints that should be supported
    return false;
  }
  
  // Check for MediaRecorder API support
  if (typeof MediaRecorder === 'undefined') {
    return false;
  }
  
  // Check MIME type support if possible
  if (MediaRecorder.isTypeSupported && 
      !MediaRecorder.isTypeSupported('audio/webm') && 
      !MediaRecorder.isTypeSupported('audio/mp4')) {
    return false;
  }
  
  return true;
}

class AudioRecorder {

  readonly silenceThreshold = 2
  readonly waitForNoise = 10000

  config: Configuration
  listener: AudioRecorderListener
  streamingMode: boolean
  stream: MediaStream
  mediaRecorder: MediaRecorder
  audioContext: AudioContext
  microphone: MediaStreamAudioSourceNode
  audioChunks: Blob[]
  analyser: AnalyserNode
  bufferLength: number
  dataArray: Uint8Array<ArrayBuffer>
  sampler: NodeJS.Timeout
  startRecordingTime: number
  lastNoise: number

  constructor(config: Configuration) {
    this.config = config
    this.mediaRecorder = null
    this.microphone = null
    this.audioChunks = []
  }

  getAnalyser(): AnalyserNode {
    return this.analyser
  }
  
  getBufferLength(): number {
    return this.bufferLength
  }

  /* v8 ignore start */
  async initialize(opts: AudioRecorderInitOptions): Promise<void> {

    // clear
    this.release()

    // save the listener
    this.listener = opts.listener

    // we need an audio stream
    this.stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    if (!this.stream) {
      throw new Error('Failed to get audio stream')
    }

    // the media recorder - prefer audio MIME types
    const options: MediaRecorderOptions = {}
    if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
      options.mimeType = 'audio/webm;codecs=opus'
    } else if (MediaRecorder.isTypeSupported('audio/webm')) {
      options.mimeType = 'audio/webm'
    } else if (MediaRecorder.isTypeSupported('audio/mp4')) {
      options.mimeType = 'audio/mp4'
    }
    
    this.mediaRecorder = new MediaRecorder(this.stream, options)
    this.mediaRecorder.ondataavailable = (event) => {

      // in streaming: pcm16bits is handled in the worklet
      if (this.streamingMode) {
        if (!opts.pcm16bitStreaming) {
          this.listener.onAudioChunk(event.data)
        }
      } else {
        this.audioChunks.push(event.data)
      }
    }

    this.mediaRecorder.onstop = async () => {
      console.log('[audio] recording stopped')
      const duration = new Date().getTime() - this.startRecordingTime
      let mimeType = this.mediaRecorder.mimeType || 'audio/webm'
      
      // Ensure we use audio MIME type for better compatibility
      if (mimeType === 'video/webm' || mimeType === 'video/webm;codecs=opus') {
        mimeType = 'audio/webm'
      }
      let audioBlob = new Blob(this.audioChunks, { type: mimeType })
      
      if (audioBlob.type.includes('webm')) {
        const originalMimeType = audioBlob.type
        audioBlob = await fixWebmDuration(audioBlob, duration)
        // Preserve original MIME type as fixWebmDuration may revert to video/webm
        if (audioBlob.type !== originalMimeType) {
          audioBlob = new Blob([audioBlob], { type: originalMimeType })
        }
        // store duration for debugging
        ;(audioBlob as any)._audioDuration = duration
      }
      this.listener.onRecordingComplete(audioBlob, this.lastNoise != null)
    }

    // now connect the microphone
    this.audioContext = new window.AudioContext(opts.pcm16bitStreaming ? { sampleRate: 44100 } : {})
    this.microphone = this.audioContext.createMediaStreamSource(this.stream)
    this.analyser = this.audioContext.createAnalyser()
    this.microphone.connect(this.analyser)

    // for pcm 16 bits we need to use a worklet
    if (opts.pcm16bitStreaming) {

      // TODO: fix load issue with worklet code stored in file:
      // await audioContext.audioWorklet.addModule('pcm-processor.js');

      const workletCode = `
      class PCMProcessor extends AudioWorkletProcessor {
        constructor() {
          super();
          this.sampleRate = 16000;
          this.bufferSize = 800;
          this.buffer = new Float32Array(this.bufferSize);
          this.bufferIndex = 0;
          this.resampleRatio = 1;
        }
      
        process(inputs, outputs, parameters) {
          const input = inputs[0][0];
          if (!input) return true;
          
          if (sampleRate !== this.sampleRate) {
            this.resampleRatio = sampleRate / this.sampleRate;
          }
          
          for (let i = 0; i < input.length; i++) {
            const targetIndex = Math.floor(i * this.resampleRatio);
            if (targetIndex < input.length) {
              this.buffer[this.bufferIndex++] = input[targetIndex];
              
              if (this.bufferIndex >= this.bufferSize) {
                const pcmData = new Int16Array(this.bufferSize);
                for (let j = 0; j < this.bufferSize; j++) {
                  pcmData[j] = Math.max(-1, Math.min(1, this.buffer[j])) * 0x7FFF;
                }
                
                this.port.postMessage({
                  type: 'pcm',
                  data: pcmData
                });
                
                this.bufferIndex = 0;
              }
            }
          }
          
          return true;
        }
      }
      
      registerProcessor('pcm-processor', PCMProcessor);
      `;

      const blob = new Blob([workletCode], { type: 'text/javascript' });
      const workletUrl = URL.createObjectURL(blob);

      await this.audioContext.audioWorklet.addModule(workletUrl)
      const audioWorkletNode = new AudioWorkletNode(this.audioContext, 'pcm-processor')
      audioWorkletNode.port.onmessage = (event) => {
        //console.log('Received message from worklet:', event.data);
        if (event.data.type === 'pcm') {
          // Send PCM data over WebSocket
          this.listener.onAudioChunk(event.data.data.buffer);
        }
      };
      
      // Connect nodes
      this.microphone.connect(audioWorkletNode);
    
    }

    // and setup the analyser
    this.analyser.fftSize = 256
    this.bufferLength = this.analyser.frequencyBinCount
    this.dataArray = new Uint8Array(this.bufferLength)

  }

  start(streaming: boolean = false): void {
    if (this.mediaRecorder) {
      this.audioChunks = []
      this.streamingMode = streaming
      this.mediaRecorder.start(streaming ? 200 : undefined)
      this.lastNoise = null
      this.startRecordingTime = new Date().getTime()
      this.sampler = setInterval(() => this.detectSilence(), 250)
    }
  }

  stop(): void {
    if (this.mediaRecorder) {
      clearInterval(this.sampler)
      this.mediaRecorder.stop()
    }
  }

  release(): void {
    this.stop()
    closeStream(this.stream)
    this.analyser?.disconnect()
    this.microphone?.disconnect()
    this.audioContext?.close()
    this.audioContext = null
    this.mediaRecorder = null
    this.analyser = null
    this.sampler = null
    this.stream = null
  }

  private detectSilence(): void {

    // if we are streaming, we don't need to check for silence
    if (this.streamingMode) {
      return
    }

    // check
    if (!this.analyser) {
      clearInterval(this.sampler)
      return
    }
    
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
      if (this.lastNoise === null) {
        this.listener.onNoiseDetected()
      }
      this.lastNoise = now
      return
    }

    // if silence detected
    if (this.config.stt.silenceDuration && this.lastNoise && now - this.lastNoise > this.config.stt.silenceDuration) {
      this.listener.onSilenceDetected()
    }

    // // if we have been waiting for too long
    // if (this.lastNoise === null && now - this.startRecordingTime > this.waitForNoise) {
    //   this.listener.onRecordingComplete(this.audioChunks, false)
    // }

  }
  /* v8 ignore stop */

}

export default function useAudioRecorder(config: Configuration) {
  return new AudioRecorder(config)
}
