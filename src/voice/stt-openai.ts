
import { Configuration } from 'types/config'
import { STTEngine, ProgressCallback, TranscribeResponse } from './stt'
import OpenAI from 'openai'

export default class STTOpenAI implements STTEngine {

  config: Configuration
  client: OpenAI

  static readonly models = [
    { id: 'gpt-4o-transcribe', label: 'GPT-4o Transcribe (online)' },
    { id: 'gpt-4o-mini-transcribe', label: 'GPT-4o Mini Transcribe (online)' },
    { id: 'whisper-1', label: 'OpenAI Whisper V2 (online)' },
  ]

    constructor(config: Configuration) {
    this.config = config
    this.client = new OpenAI({
      apiKey: config.engines.openai.apiKey,
      dangerouslyAllowBrowser: true
    })
  }

  isReady(): boolean {
    return true
  }

  static requiresDownload(): boolean {
    return false
  }

  requiresDownload(): boolean {
    return STTOpenAI.requiresDownload()
  }

  async initialize(callback?: ProgressCallback): Promise<void> {
    callback?.({ status: 'ready', task: 'openai', model: this.config.stt.model })
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async transcribe(audioBlob: Blob, opts?: object): Promise<TranscribeResponse> {

    // call
    const response = await this.client.audio.transcriptions.create({
      file: new File([audioBlob], 'audio.webm', { type: audioBlob.type }),
      model: this.config.stt.model,
      language: this.config.stt.locale?.substring(0, 2)
    });

    // return
    return response
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
