
import { Configuration } from 'types/config'
import STTFalAi from './stt-falai'
import STTFireworks from './stt-fireworks'
import STTGladia from './stt-gladia'
import STTGroq from './stt-groq'
import STTHuggingFace from './stt-huggingface'
import STTNvidia from './stt-nvidia'
import STTOpenAI from './stt-openai'
import STTSpeechmatics from './stt-speechmatics'
import STTWhisper from './stt-whisper'

export type DownloadStatus = {
  state: 'initiate'|'download'|'done'
  name: string
  file: string
}

export type DownloadProgress = {
  status: 'progress'
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

export type STTStatus = 'connected' | 'text' | 'done' | 'not_authorized' | 'out_of_credits' | 'quota_reached' | 'error'

export type TranscribeResponse = {
  text: string
}

export type StreamingChunkText = {
  type: 'text'
  content: string
}

export type StreamingChunkStatus = {
  type: 'status'
  status: STTStatus
}

export type StreamingChunkError = {
  type: 'error'
  status: STTStatus
  error: string
}

export type StreamingChunk = StreamingChunkText | StreamingChunkStatus | StreamingChunkError

export type StreamingCallback = (chunk: StreamingChunk) => void

export interface STTEngine {

  // standard
  get name(): string
  isReady(): boolean
  initialize(callback?: ProgressCallback): Promise<void>
  transcribe(audioBlob: Blob, opts?: object): Promise<TranscribeResponse>

  // local model management
  requiresDownload(): boolean
  isModelDownloaded(model: string): Promise<boolean>
  deleteModel(model: string): Promise<void>
  deleteAllModels(): Promise<void>

  // streaming
  isStreamingModel(model: string): boolean
  requiresPcm16bits?(model: string): boolean
  startStreaming?(model: string, callback: StreamingCallback, opts?: object): Promise<void>  
  sendAudioChunk?(chunk: Blob): Promise<void>  
  endStreaming?(): Promise<void>

  // file conversion
  transcribeFile?(file: File, opts?: object): Promise<TranscribeResponse>
}

export const getSTTEngines = () => {
  return [
    { id: 'falai', label: 'fal.ai' },
    { id: 'fireworks', label: 'Fireworks.ai' },
    { id: 'gladia', label: 'Gladia' },
    { id: 'groq', label: 'Groq' },
    //{ id: 'huggingface', label: 'Hugging Face' },
    { id: 'nvidia', label: 'nVidia' },
    { id: 'openai', label: 'OpenAI' },
    { id: 'speechmatics', label: 'Speechmatics' },
    { id: 'whisper', label: 'Whisper' },
    { id: 'custom', label: 'Custom OpenAI' },
  ]
}

export const getSTTModels = (engine: string) => {
  if (engine === 'openai') {
    return STTOpenAI.models
  } else if (engine === 'falai') {
    return STTFalAi.models
  } else if (engine === 'fireworks') {
    return STTFireworks.models
  } else if (engine === 'speechmatics') {
    return STTSpeechmatics.models
  } else if (engine === 'gladia') {
    return STTGladia.models
  } else if (engine === 'groq') {
    return STTGroq.models
  } else if (engine === 'huggingface') {
    return STTHuggingFace.models
  } else if (engine === 'nvidia') {
    return STTNvidia.models
  } else if (engine === 'whisper') {
    return STTWhisper.models
  } else if (engine === 'custom') {
    return []
  }
}

export const getSTTEngine = (config: Configuration): STTEngine => {
  const engine = config.stt.engine || 'whisper'
  if (engine === 'openai') {
    return new STTOpenAI(config)
  } else if (engine === 'groq') {
    return new STTGroq(config)
  } else if (engine === 'falai') {
    return new STTFalAi(config)
  } else if (engine === 'huggingface') {
    return new STTHuggingFace(config)
  } else if (engine === 'nvidia') {
    return new STTNvidia(config)
  } else if (engine === 'whisper') {
    return new STTWhisper(config)
  } else if (engine === 'gladia') {
    return new STTGladia(config)
  } else if (engine === 'fireworks') {
    return new STTFireworks(config)
  } else if (engine === 'speechmatics') {
    return new STTSpeechmatics(config)
  } else if (engine === 'custom') {
    return new STTOpenAI(config, config.stt.customOpenAI.baseURL)
  } else {
    throw new Error(`Unknown STT engine ${engine}`)
  }
}

export const requiresDownload = (engine: string): boolean => {
  if (engine === 'openai') {
    return STTOpenAI.requiresDownload()
  } else if (engine === 'groq') {
    return STTGroq.requiresDownload()
  } else if (engine === 'falai') {
    return STTFalAi.requiresDownload()
  } else if (engine === 'huggingface') {
    return STTHuggingFace.requiresDownload()
  } else if (engine === 'nvidia') {
    return STTNvidia.requiresDownload()
  } else if (engine === 'whisper') {
    return STTWhisper.requiresDownload()
  } else if (engine === 'gladia') {
    return STTGladia.requiresDownload()
  } else if (engine === 'fireworks') {
    return STTFireworks.requiresDownload()
  } else if (engine === 'speechmatics') {
    return STTSpeechmatics.requiresDownload()
  } else if (engine === 'custom') {
    return STTOpenAI.requiresDownload()
  } else {
    throw new Error(`Unknown STT engine ${engine}`)
  }
}
