
import { Configuration } from 'types/config'
import { STTEngine, ProgressCallback, ProgressInfo, TaskStatus, TranscribeResponse } from './stt'
import { getParakeetModel, ParakeetModel, ProgressInfo as ParakeetProgressInfo } from 'parakeet.js'

export default class STTParakeet implements STTEngine {

  config: Configuration
  model?: ParakeetModel
  ready = false

  static readonly models: { id: string; label: string }[] = [
    { id: 'istupakov/parakeet-tdt-0.6b-v2-onnx', label: 'Parakeet TDT 0.6B v2 (English, requires download)' },
    { id: 'istupakov/parakeet-tdt-0.6b-v3-onnx', label: 'Parakeet TDT 0.6B v3 (Multilingual, requires download)' },
  ]

  constructor(config: Configuration) {
    this.config = config
  }

  get name(): string {
    return 'parakeet'
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
    return STTParakeet.requiresDownload()
  }

  async initialize(callback?: ProgressCallback): Promise<void> {

    try {

      const modelId = this.config.stt.model || 'istupakov/parakeet-tdt-0.6b-v2-onnx'
      const useGpu = this.config.stt.parakeet?.gpu ?? false
      const backend = useGpu ? 'webgpu' : 'wasm'

      // get model URLs with progress tracking
      callback?.({ status: 'initiate', name: modelId, file: '' } as ProgressInfo)

      const { urls, filenames } = await getParakeetModel(modelId, {
        backend,
        encoderQuant: useGpu ? 'fp32' : 'int8',
        decoderQuant: 'int8',
        preprocessor: 'nemo128',
        progress: ({ file, loaded, total }: ParakeetProgressInfo) => {
          callback?.({
            status: 'progress',
            name: modelId,
            file,
            progress: total > 0 ? (loaded / total) * 100 : 0,
            loaded,
            total
          } as ProgressInfo)
        }
      })

      // create model instance
      this.model = await ParakeetModel.fromUrls({
        ...urls,
        filenames,
        backend,
        cpuThreads: navigator.hardwareConcurrency ? Math.max(1, navigator.hardwareConcurrency - 2) : 4,
        verbose: false
      })

      // warm up the model with a short silent audio
      const warmupAudio = new Float32Array(16000) // 1 second of silence
      await this.model.transcribe(warmupAudio, 16000)

      this.ready = true
      callback?.({ status: 'ready' } as TaskStatus)

    } catch (error) {
      console.error('[parakeet] error when initializing:', error)
      callback?.({ status: 'error', message: (error as Error).message })
    }

  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async transcribe(audioBlob: Blob, opts?: object): Promise<TranscribeResponse> {

    return new Promise((resolve, reject) => {

      try {

        // we need to decode the audio file to PCM Float32 @ 16kHz
        const fileReader = new FileReader()
        fileReader.onloadend = async () => {
          const audioCTX = new AudioContext({
            sampleRate: 16000,
          })
          const arrayBuffer = fileReader.result as ArrayBuffer
          const decoded = await audioCTX.decodeAudioData(arrayBuffer)
          const pcmData = decoded.getChannelData(0)

          // transcribe with parakeet
          const result = await this.model!.transcribe(pcmData, 16000, {
            returnTimestamps: false,
            returnConfidences: false,
            frameStride: 2 // balance between speed and accuracy
          })

          resolve({ text: result.utterance_text || '' })

        }
        fileReader.readAsArrayBuffer(audioBlob)

      } catch (error) {
        console.error(error)
        reject(error)
      }
    })
  }

  async isModelDownloaded(model: string): Promise<boolean> {
    // parakeet.js uses IndexedDB for caching
    // check if the model files exist in IndexedDB
    try {
      const dbName = 'parakeet-models'
      const request = indexedDB.open(dbName)

      return new Promise((resolve) => {
        request.onsuccess = () => {
          const db = request.result
          if (!db.objectStoreNames.contains('models')) {
            db.close()
            resolve(false)
            return
          }

          const tx = db.transaction('models', 'readonly')
          const store = tx.objectStore('models')
          const getRequest = store.get(model)

          getRequest.onsuccess = () => {
            db.close()
            resolve(!!getRequest.result)
          }

          getRequest.onerror = () => {
            db.close()
            resolve(false)
          }
        }

        request.onerror = () => {
          resolve(false)
        }
      })
    } catch {
      return false
    }
  }

  async deleteModel(model: string): Promise<void> {
    try {
      const dbName = 'parakeet-models'
      const request = indexedDB.open(dbName)

      return new Promise((resolve) => {
        request.onsuccess = () => {
          const db = request.result
          if (!db.objectStoreNames.contains('models')) {
            db.close()
            resolve()
            return
          }

          const tx = db.transaction('models', 'readwrite')
          const store = tx.objectStore('models')
          store.delete(model)

          tx.oncomplete = () => {
            db.close()
            resolve()
          }

          tx.onerror = () => {
            db.close()
            resolve()
          }
        }

        request.onerror = () => {
          resolve()
        }
      })
    } catch {
      // ignore errors
    }
  }

  async deleteAllModels(): Promise<void> {
    try {
      await indexedDB.deleteDatabase('parakeet-models')
    } catch {
      // ignore errors
    }
  }

}
