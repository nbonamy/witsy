
import { Configuration } from 'types/config.d'
import STTOpenAI from './stt-openai'
import STTGroq from './stt-groq'
import STTWhisper from './stt-whisper'

export type DownloadStatus = {
  state: 'initiate'|'download'|'done'
  name: string
  file: string
}

export type DownloadProgress = {
  state: 'progress'
  name: string
  file: string
  progress: number
  loaded: number,
  total: number
}

export type TaskStatus = {
  status: string
  task?: string
  model?: string
  message?: string
}

export type ProgressInfo = DownloadStatus | DownloadProgress | TaskStatus

export type ProgressCallback = (data: ProgressInfo) => void

export type TranscribeResponse = {
  text: string
}

export interface STTEngine {
  //constructor(config: Configuration): STTBase
  isReady(): boolean
  requiresDownload(): boolean
  initialize(callback?: ProgressCallback): Promise<void>
  transcribe(audioBlob: Blob, opts?: object): Promise<TranscribeResponse>
  deleteModel(model: string): Promise<void>
  deleteAllModels(): Promise<void>
}

const getSTTEngine = (config: Configuration): STTEngine => {
  const engine = config.stt.engine || 'whisper'
  if (engine === 'openai') {
    return new STTOpenAI(config)
  } else if (engine === 'groq') {
    return new STTGroq(config)
  } else if (engine === 'whisper') {
    return new STTWhisper(config)
  } else {
    throw new Error(`Unknown STT engine ${engine}`)
  }
}

export default getSTTEngine
