import { Configuration } from 'types/config'
import { STTEngine, ProgressCallback, TranscribeResponse, StreamingCallback } from './stt'

type FireworksWord = {
  word: string,
  language: string,
  probability: number,
  hallucination_score: number,
  is_final: boolean,
}

type FireworksSegment = {
  id: string,
  seek: number,
  text: string,
  language: string,
  words: FireworksWord[],
}

type FireworksDataMessage = {
  task: 'transcribe',
  language: string,
  text: string,
  words: FireworksWord[],
  segments: FireworksSegment[],
}

export default class STTFireworks implements STTEngine {

  config: Configuration
  streamingSession: WebSocket

  static readonly models = [
    { id: 'realtime', label: 'Fireworks (realtime)' },
  ]

  constructor(config: Configuration) {
    this.config = config
    this.streamingSession = null
  }

  get name(): string {
    return 'fireworks'
  }

  isReady(): boolean {
    return true
  }

  isStreamingModel(model: string): boolean {
    return model === 'realtime'
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  requiresPcm16bits?(model: string): boolean {
    return true
  }

  static requiresDownload(): boolean {
    return false
  }

  requiresDownload(): boolean {
    return STTFireworks.requiresDownload()
  }

  async initialize(callback?: ProgressCallback): Promise<void> {
    callback?.({ status: 'ready', task: 'fireworks', model: this.config.stt.model })
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async transcribe(audioBlob: Blob, opts?: object): Promise<TranscribeResponse> {
    throw new Error('Transcription not supported in Fireworks STT engine')
  }

  async startStreaming(model: string, callback: StreamingCallback, opts?: Record<string, string>): Promise<void> {

    // check for API key before attempting connection
    if (!this.config.engines.fireworks?.apiKey) {
      callback({ 
        type: 'error', 
        status: 'not_authorized', 
        error: 'Missing API key. Please check your Fireworks AI configuration.' 
      })
      return
    }

    const baseWsUrl = 'wss://audio-streaming.us-virginia-1.direct.fireworks.ai'
    const wsPath = '/v1/audio/transcriptions/streaming'

    const queryParams = new URLSearchParams()
    queryParams.append('Authorization', `Bearer ${this.config.engines.fireworks.apiKey}`)
    queryParams.append('response_format', 'verbose_json')
    queryParams.append('language', this.config.stt.locale?.substring(0, 2) || 'en')
    if (opts?.prompt) {
      queryParams.append('prompt', opts.prompt)
    } else if (this.config.stt.vocabulary.length > 0) {
      queryParams.append('prompt', this.config.stt.vocabulary.map((vocab) => vocab.text).join(', '))
    }
    if (opts?.temperature !== undefined) queryParams.append('temperature', opts.temperature.toString())

    // The final WebSocket URL
    const wsUrl = `${baseWsUrl}${wsPath}?${queryParams.toString()}`
    this.streamingSession = new WebSocket(wsUrl)

    this.streamingSession.onerror = (error) => {
      console.log('[fireworks] websocket error', error)
      callback({ type: 'error', status: 'error', error: 'WebSocket connection error' })
    }

    this.streamingSession.onopen = () => {
      console.log('[fireworks] websocket connected')
      callback({ type: 'status', status: 'connected' })
    }

    const segments: Record<string, any> = {}

    this.streamingSession.onmessage = (event) => {

      // parse the event data
      const data: FireworksDataMessage = JSON.parse(event.data)
      if (data?.task !== 'transcribe') {
        return
      }

      // store the segments
      if (data.segments) {
        data.segments.forEach((segment: FireworksSegment) => {
          segments[segment.id] = segment
        })
      }

      // send the whole text by joining all segments
      callback({ type: 'text', content: Object.values(segments).map((s: FireworksSegment) => s.text).join(' ') })

    }

    this.streamingSession.onclose = () => {
      console.log('[fireworks] websocket closed')
      callback({ type: 'status', status: 'done' })
    }

  }

  async sendAudioChunk(chunk: Blob): Promise<void> {
    if (this.streamingSession && this.streamingSession.readyState === WebSocket.OPEN) {
      // const size = chunk.size % 2 == 0 ? chunk.size : chunk.size - 1
      // console.log('Sending audio chunk of size:', size)
      this.streamingSession.send(chunk)
    }
  }

  async endStreaming(): Promise<void> {
    this.streamingSession.close()
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