
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
    callback?.({ status: 'ready', task: 'openai', model: this.config.stt.model })
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async transcribe(audioBlob: Blob, opts?: object): Promise<TranscribeResponse> {

    // call
    const response = await this.client.audio.transcriptions.create({
      file: new File([audioBlob], 'audio.webm', { type: audioBlob.type }),
      model: this.config.stt.model.replace('openai/', ''),
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
