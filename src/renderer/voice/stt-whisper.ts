
import { Configuration } from 'types/config'
import { STTEngine, ProgressCallback, ProgressInfo, TaskStatus, TranscribeResponse } from './stt'

// importing from @xenova/transformers leads to a runtime error
import { env, pipeline } from '@huggingface/transformers'

export default class STTWhisper implements STTEngine {

  config: Configuration
  transcriber?: any
  ready = false

  static readonly models: any[] = [
    { id: 'Xenova/whisper-tiny', label: 'Whisper Turbo Tiny (requires download)' },
    { id: 'Xenova/whisper-base', label: 'Whisper Turbo Base (requires download)' },
    { id: 'Xenova/whisper-small', label: 'Whisper Turbo Small (requires download)' },
    { id: 'Xenova/whisper-medium', label: 'Whisper Turbo Medium (requires download)' },
  ]

  constructor(config: Configuration) {
    this.config = config
    env.allowLocalModels = false
  }

  get name(): string {
    return 'whisper'
  }

  isReady(): boolean {
    return this.ready
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  isStreamingModel(model: string): boolean {
    return false
  }

  static requiresDownload(): boolean {
    return true
  }

  requiresDownload(): boolean {
    return STTWhisper.requiresDownload()
  }

  async initialize(callback?: ProgressCallback): Promise<void> {

    try {

      const model = this.config.stt.model || 'Xenova/whisper-tiny'
      this.transcriber = await pipeline('automatic-speech-recognition', model, {
        ...(this.config.stt.whisper.gpu ? {
          dtype: 'fp32',
          device: 'webgpu',
        } : {
          dtype: 'q8',
        }),
        progress_callback: (data: ProgressInfo) => {
          if ((data as TaskStatus).status === 'ready') {
            this.ready = true
          }
          if (callback) {
            callback(data)
          }
        },
        // for medium models, we need to load the `no_attentions` revision to avoid running out of memory
        revision: model.includes('/whisper-medium') ? 'no_attentions' : 'main'
      })

    } catch (error) {
      console.error(['[whisper] error when initializing:', error])
      callback?.({ status: 'error', message: error.message })
    }

  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async transcribe(audioBlob: Blob, opts?: object): Promise<TranscribeResponse> {

    return new Promise((resolve, reject) => {

      try {

        // we need to decode the audio file
        const fileReader = new FileReader()
        fileReader.onloadend = async () => {
          const audioCTX = new AudioContext({
            sampleRate: 16000,
          })
          const arrayBuffer = fileReader.result as ArrayBuffer
          const decoded = await audioCTX.decodeAudioData(arrayBuffer)

          // now we can send the audio data to the transcriber
          const output = await this.transcriber(decoded.getChannelData(0), {
            language: this.config.stt.locale?.substring(0, 2),
          })
          resolve(output)

        }
        fileReader.readAsArrayBuffer(audioBlob);

      } catch (error) {
        console.error(error);
        reject(error);
      }
    })
  }

  async isModelDownloaded(model: string): Promise<boolean> {
    const storage = await caches.open('transformers-cache')
    const keys = await storage.keys()
    for (const key of keys) {
      if (key.url.includes(`/${model}/`)) {
        return true
      }
    }
    return false
  }

  async deleteModel(model: string): Promise<void> {
    const storage = await caches.open('transformers-cache')
    const keys = await storage.keys()
    for (const key of keys) {
      if (key.url.includes(`/${model}/`)) {
        await storage.delete(key)
      }
    }
  }

  async deleteAllModels(): Promise<void> {
    await caches.delete('transformers-cache')
  }

}
