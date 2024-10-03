
import { Configuration } from 'types/config.d'
import { STTEngine, ProgressCallback, ProgressInfo, TaskStatus, TranscribeResponse } from './stt'

// importing from @xenova/transformers leads to a runtime error
import { env, pipeline } from '@xenova/transformers/dist/transformers'

export default class implements STTEngine {

  config: Configuration
  transcriber?: any
  ready: boolean = false

  constructor(config: Configuration) {
    this.config = config
    env.allowLocalModels = false
  }

  isReady(): boolean {
    return this.ready
  }

  requiresDownload(): boolean {
    return true
  }

  async initialize(callback?: ProgressCallback): Promise<void> {

    try {

      const model = this.config.stt.model || 'Xenova/whisper-tiny'
      this.transcriber = await pipeline('automatic-speech-recognition', model, {
        quantized: false,
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
      console.error(error)
      callback?.({ status: 'error', message: error.message })
    }

  }

  async transcribe(audioBlob: Blob, opts?: {}): Promise<TranscribeResponse> {

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
          const output = await this.transcriber(decoded.getChannelData(0))
          resolve(output)

        }
        fileReader.readAsArrayBuffer(audioBlob);

      } catch (error) {
        console.error(error);
        reject(error);
      }
    })
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
