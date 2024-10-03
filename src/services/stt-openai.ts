
import { Configuration } from 'types/config.d'
import { STTEngine, ProgressCallback, TranscribeResponse } from './stt'
import OpenAI from 'openai'

export default class implements STTEngine {

  config: Configuration
  client: OpenAI

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

  requiresDownload(): boolean {
    return false
  }

  async initialize(callback?: ProgressCallback): Promise<void> {
    callback({ status: 'ready', task: 'openai', model: this.config.stt.model })
  }

  async transcribe(audioBlob: Blob, opts?: { } ): Promise<TranscribeResponse> {

    // call
    const response = await this.client.audio.transcriptions.create({
      file: new File([audioBlob], 'audio.webm', { type: audioBlob.type }),
      model: this.config.stt.model.replace('openai/', ''),
    });

    // return
    return response
  }

  deleteModel(model: string): Promise<void> {
    return
  }

  deleteAllModels(): Promise<void> {
    return
  }

}
