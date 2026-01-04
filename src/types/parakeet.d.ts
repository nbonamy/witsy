declare module 'parakeet.js' {

  export interface ProgressInfo {
    file: string
    loaded: number
    total: number
  }

  export interface GetParakeetModelOptions {
    backend?: 'webgpu' | 'wasm'
    encoderQuant?: 'fp32' | 'int8'
    decoderQuant?: 'fp32' | 'int8'
    preprocessor?: string
    revision?: string
    progress?: (info: ProgressInfo) => void
  }

  export interface ParakeetModelUrls {
    encoderUrl: string
    decoderUrl: string
    tokenizerUrl: string
    preprocessorUrl: string
    encoderDataUrl?: string | null
    decoderDataUrl?: string | null
  }

  export interface ParakeetModelFilenames {
    encoder: string
    decoder: string
  }

  export interface GetParakeetModelResult {
    urls: ParakeetModelUrls
    filenames: ParakeetModelFilenames
    quantisation: {
      encoder: string
      decoder: string
    }
  }

  export interface FromUrlsConfig extends ParakeetModelUrls {
    filenames?: ParakeetModelFilenames
    backend?: 'webgpu' | 'webgpu-hybrid' | 'webgpu-strict' | 'wasm'
    wasmPaths?: string
    subsampling?: number
    windowStride?: number
    verbose?: boolean
    enableProfiling?: boolean
    enableGraphCapture?: boolean
    cpuThreads?: number
  }

  export interface TranscribeOptions {
    returnTimestamps?: boolean
    returnConfidences?: boolean
    temperature?: number
    frameStride?: number
  }

  export interface TranscribeResult {
    utterance_text: string
    words?: Array<{
      word: string
      start: number
      end: number
      confidence: number
    }>
    tokens?: Array<{
      token: string
      start: number
      end: number
      confidence: number
    }>
    confidence_scores?: {
      overall: number
      per_word?: number[]
    }
    metrics?: {
      rtf: number
      total_ms: number
      preprocess_ms: number
      encode_ms: number
      decode_ms: number
      tokenize_ms: number
    }
    is_final?: boolean
  }

  export class ParakeetModel {
    static fromUrls(config: FromUrlsConfig): Promise<ParakeetModel>
    transcribe(
      audio: Float32Array,
      sampleRate: number,
      options?: TranscribeOptions
    ): Promise<TranscribeResult>
  }

  export function getParakeetModel(
    repoId: string,
    options?: GetParakeetModelOptions
  ): Promise<GetParakeetModelResult>

  export function getModelFile(
    repoId: string,
    filename: string,
    options?: { revision?: string; subfolder?: string; progress?: (info: ProgressInfo) => void }
  ): Promise<string>

  export function getModelText(
    repoId: string,
    filename: string,
    options?: { revision?: string; subfolder?: string }
  ): Promise<string>

  export function fromUrls(config: FromUrlsConfig): Promise<ParakeetModel>

  export function fromHub(
    repoId: string,
    options?: GetParakeetModelOptions & Partial<FromUrlsConfig>
  ): Promise<ParakeetModel>
}
