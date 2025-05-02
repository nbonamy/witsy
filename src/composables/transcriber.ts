
import { type Configuration } from '../types/config'
import getSTTEngine, { StreamingResponse, type STTEngine, type TranscribeResponse } from '../voice/stt'

class Transcriber {

  config: Configuration
  engine: STTEngine|null
  streaming: boolean
  streamingCallback: (text: string) => void

  constructor(config: Configuration) {
    this.config = config
    this.engine = null
    this.streaming = false
    this.streamingCallback = null
  }

  get model(): string {
    return this.config.stt.model
  }

  async initialize() {
    this.engine = getSTTEngine(this.config)
    await this.engine.initialize()
  }

  get ready(): boolean {
    return this.engine != null && this.engine.isReady()
  }
   
  get requiresStreaming(): boolean {
    return this.engine && this.engine.isStreamingModel(this.model)
  }

  get requiresPcm16bits(): boolean {
    return this.requiresStreaming && this.engine.requiresPcm16bits(this.model)
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  transcribe(audioChunks: any[], opts?: object): Promise<TranscribeResponse> {

    // check
    if (!this.engine) {
      throw new Error('Transcriber not initialized')
    }

    // get the chunks as audio/webm
    const audioBlob = new Blob(audioChunks, { type: 'audio/webm' })

    // now transcribe
    return this.engine.transcribe(audioBlob)

  }

  async startStreaming(callback: (text: string) => void): Promise<void> {

    if (!this.requiresStreaming || !this.engine?.startStreaming) {
      throw new Error('Streaming not supported by this engine')
    }

    this.streaming = true
    this.streamingCallback = callback
    await this.engine.startStreaming((response: StreamingResponse) => {
      if (response.type === 'text') {
        this.streamingCallback(response.content)
      }
    })
  }

  async sendStreamingChunk(chunk: Blob): Promise<void> {
    if (this.streaming && this.engine?.sendAudioChunk) {
      this.engine.sendAudioChunk(chunk)
    }
  }

  async endStreaming(): Promise<void> {
    if (this.streaming && this.engine?.endStreaming) {
      this.streaming = false
      await this.engine.endStreaming()
    }
  }

}

export default function useTranscriber(config: Configuration) {
  return new Transcriber(config)
}
