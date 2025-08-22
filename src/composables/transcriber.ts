
import { type Configuration } from '../types/config'
import { getSTTEngine, StreamingChunk, StreamingChunkError, STTEngine, TranscribeResponse } from '../voice/stt'
import { t } from '../services/i18n'
import Dialog from './dialog'

class Transcriber {

  config: Configuration
  engine: STTEngine|null
  streaming: boolean
  
  constructor(config: Configuration) {
    this.config = config
    this.engine = null
    this.streaming = false
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

  transcribe(audioBlob: Blob, opts?: object): Promise<TranscribeResponse> {
    if (!this.engine) {
      throw new Error('Transcriber not initialized')
    }
    return this.engine.transcribe(audioBlob, opts)
  }

  transcribeFile(file: File, opts?: object): Promise<TranscribeResponse> {
    if ('transcribeFile' in this.engine && typeof this.engine.transcribeFile === 'function') {
      return this.engine.transcribeFile(file, opts)
    } else {
      const blob = new Blob([file], { type: file.type })
      return this.transcribe(blob, opts)
    }
  }

  async startStreaming(callback: (chunk: StreamingChunk) => void): Promise<void> {

    if (!this.requiresStreaming || !this.engine?.startStreaming) {
      throw new Error('Streaming not supported by this engine')
    }

    this.streaming = true
    await this.engine.startStreaming(this.model, (chunk: StreamingChunk) => {
      callback(chunk)
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
  return {
    transcriber: new Transcriber(config),
    processStreamingError: async (chunk: StreamingChunkError) => {

      // process
      console.error('Error in streaming:', chunk.status, chunk.error)
      if (chunk.status === 'not_authorized') {
      
        const result = await Dialog.show({
          title: t('transcribe.errors.notAuthorized.title'),
          text: t('transcribe.errors.notAuthorized.text'),
          showCancelButton: true,
        })

        if (result.isConfirmed) {
          window.api.settings.open({ initialTab: 'voice', engine: 'stt' })
        }
      
      } else if (chunk.status === 'out_of_credits' || chunk.status === 'quota_reached') {
        Dialog.alert(t('transcribe.errors.outOfCredits'))
      } else {
        Dialog.alert(t('transcribe.errors.unknown'))
      }

    }
  }
}
