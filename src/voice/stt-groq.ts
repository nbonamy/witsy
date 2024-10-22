
import { Configuration } from 'types/config.d'
import { STTEngine, ProgressCallback, TranscribeResponse } from './stt'
import Groq from 'groq-sdk'

export default class implements STTEngine {

  config: Configuration
  client: Groq

  static readonly models: any[] = [
    { id: 'whisper-large-v3-turbo', label: 'Groq OpenAI Whisper Large V3 Turbo Multilingual (online)' },
    { id: 'distil-whisper-large-v3-en', label: 'Groq OpenAI Whisper Large V3 English (online)' },
    { id: 'whisper-large-v3', label: 'Groq OpenAI Whisper Large V3 Multilingual (online)' },
  ]

  constructor(config: Configuration) {
    this.config = config
    this.client = new Groq({
      apiKey: config.engines.groq?.apiKey || '',
      dangerouslyAllowBrowser: true,
    })
  }

  isReady(): boolean {
    return true
  }

  requiresDownload(): boolean {
    return false
  }

  async initialize(callback?: ProgressCallback): Promise<void> {
    callback?.({ status: 'ready', task: 'groq', model: this.config.stt.model })
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async transcribe(audioBlob: Blob, opts?: object): Promise<TranscribeResponse> {

    // call
    const response = await this.client.audio.transcriptions.create({
      file: new File([audioBlob], 'audio.webm', { type: audioBlob.type }),
      model: this.config.stt.model,
    });

    // return
    return response
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  deleteModel(model: string): Promise<void> {
    return
  }

  deleteAllModels(): Promise<void> {
    return
  }

}
