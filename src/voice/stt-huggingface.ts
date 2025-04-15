
import { Configuration } from 'types/config'
import { STTEngine, ProgressCallback, TranscribeResponse } from './stt'
import { HfInference } from '@huggingface/inference'

export default class STTHuggingFace implements STTEngine {

  config: Configuration

  static readonly models = [
    { id: 'microsoft/Phi-4-multimodal-instruct', label: 'Microsoft Phi-4' },
    { id: 'nvidia/canary-1b-flash', label: 'nVidia Canary Flash' },
    { id: 'nvidia/canary-1b', label: 'nVidia Canary' },
  ]

  constructor(config: Configuration) {
    this.config = config
  }

  isReady(): boolean {
    return true
  }

  static requiresDownload(): boolean {
    return false
  }

  requiresDownload(): boolean {
    return STTHuggingFace.requiresDownload()
  }

  async initialize(callback?: ProgressCallback): Promise<void> {
    callback?.({ status: 'ready', task: 'huggingface', model: this.config.stt.model })
  }

   
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async transcribe(audioBlob: Blob, opts?: object): Promise<TranscribeResponse> {

    // init
    const client = new HfInference(this.config.engines.huggingface.apiKey)

    // call
    const result = await client.automaticSpeechRecognition({
      model: this.config.stt.model,
      data: audioBlob,
    })

    // return
    return { text: result.text }
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
