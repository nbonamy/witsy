
import { Configuration } from 'types/config'
import { STTEngine, ProgressCallback, TranscribeResponse } from './stt'
import { fal } from '@fal-ai/client'

export default class STTFalAi implements STTEngine {

  config: Configuration

  static readonly models = [
    { id: 'fal-ai/whisper', label: 'Whisper' },
    { id: 'fal-ai/wizper', label: 'Whisper v3 Large' },
    { id: 'fal-ai/elevenlabs/speech-to-text', label: 'ElevenLabs' },
  ]

  constructor(config: Configuration) {
    this.config = config
  }

  get name(): string {
    return 'fal.ai'
  }

  isReady(): boolean {
    return true
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  isStreamingModel(model: string): boolean {
    return false
  }

  static requiresDownload(): boolean {
    return false
  }

  requiresDownload(): boolean {
    return STTFalAi.requiresDownload()
  }

  async initialize(callback?: ProgressCallback): Promise<void> {
    callback?.({ status: 'ready', task: 'fal.ai', model: this.config.stt.model })
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async transcribe(audioBlob: Blob, opts?: object): Promise<TranscribeResponse> {

    // set api key
    fal.config({
      credentials: this.config.engines.falai.apiKey
    });

    const response = await fal.subscribe(this.config.stt.model, {
      input: {
        audio_url: new File([audioBlob], 'audio.webm', { type: audioBlob.type }),
        ...(this.config.stt.locale ? { language: this.config.stt.locale?.substring(0, 2) } : {})
      },
    });

    // return
    return { text: response.data.text }
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async isModelDownloaded(model: string): Promise<boolean> {
    return false
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  deleteModel(model: string): Promise<void> {
    return
  }

  deleteAllModels(): Promise<void> {
    return
  }

}
