
import { Configuration } from 'types/config'
import { STTEngine, ProgressCallback, TranscribeResponse } from './stt'

export default class STTGladia implements STTEngine {

  config: Configuration
 
  static readonly models = [
    { id: 'solaria', label: 'Solaria (online)' },
  ]

  constructor(config: Configuration) {
    this.config = config
  }

  get name(): string {
    return 'gladia'
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
    return STTGladia.requiresDownload()
  }

  async initialize(callback?: ProgressCallback): Promise<void> {
    callback?.({ status: 'ready', task: 'gladia', model: this.config.stt.model })
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async transcribe(audioBlob: Blob, opts?: object): Promise<TranscribeResponse> {

    // First, upload the audio chunks
    const uploadFormData = new FormData()
    uploadFormData.append('audio', audioBlob, 'audio.webm')
  
    const uploadOptions = {
      method: 'POST',
      headers: { 'x-gladia-key': this.config.engines.gladia?.apiKey, },
      body: uploadFormData
    }

    const uploadResponse = await fetch('https://api.gladia.io/v2/upload', uploadOptions)
    const uploadJson = await uploadResponse.json()
    if (!uploadJson.audio_url) {
      throw new Error(uploadJson.message || 'Failed to upload audio file')
    }

    // we can translate
    const queueBody = {
      audio_url: uploadJson.audio_url,
      language: this.config.stt.locale?.substring(0, 2) || undefined,
    }

    // queue
    const queueOptions: Record<string, any> = {
      method: 'POST',
      headers: {
        'x-gladia-key': this.config.engines.gladia?.apiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(queueBody)
    };

    const queueResponse = await fetch('https://api.gladia.io/v2/pre-recorded', queueOptions)
    const queueJson = await queueResponse.json()
    const pollUrl = queueJson.result_url
    if (!pollUrl) {
      throw new Error(queueJson.message)
    }

    // now we need to poll the result_url until we get a result
    const pollOptions = {
      method: 'GET',
      headers: {
        'x-gladia-key': this.config.engines.gladia?.apiKey,
      }
    };

    while (true) {

      const pollResponse = await fetch(pollUrl, pollOptions)
      const pollJson = await pollResponse.json()

      if (pollJson.status === 'done') {
        return {
          text: pollJson.result.transcription.full_transcript
        }
      }

      if (pollJson.status === 'error') {
        throw new Error(pollJson.message)
      }

      // wait 1 second before checking again
      await new Promise((resolve) => setTimeout(resolve, 1000));

    }

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
