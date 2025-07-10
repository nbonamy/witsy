import { Configuration } from 'types/config'
import { STTEngine, ProgressCallback, TranscribeResponse, StreamingCallback } from './stt'

export default class STTSoniox implements STTEngine {

  config: Configuration

  private ws: WebSocket|null
  private connected: boolean;
  private queue: Array<string | BufferSource> = [];
  private streamingCallback: StreamingCallback|null = null;

  static readonly models = [
    { id: 'realtime', label: 'Soniox (realtime)' },
    { id: 'async', label: 'Soniox (async)' },
  ]

  constructor(config: Configuration) {
    this.config = config
    this.ws = null
    this.connected = false
  }

  get name(): string {
    return 'soniox'
  }

  isReady(): boolean {
    return true
  }

  isStreamingModel(model: string): boolean {
    return model === 'realtime'
  }

  requiresPcm16bits?(model: string): boolean {
    return false
  }

  static requiresDownload(): boolean {
    return false
  }

  requiresDownload(): boolean {
    return STTSoniox.requiresDownload()
  }

  async initialize(callback?: ProgressCallback): Promise<void> {
    callback?.({ status: 'ready', task: 'soniox', model: this.config.stt.model })
  }

  async transcribe(audioBlob: Blob, opts?: object): Promise<TranscribeResponse> {
    // TODO: async transcription support
  }

  async startStreaming(model: string, callback: StreamingCallback, opts?: Record<string, string>): Promise<void> {
    console.log('Starting Soniox streaming with model:', model);
    if (this.ws && this.connected) {
      return;
    }

    if (!this.config.engines.soniox?.apiKey) {
      callback({
        type: 'error',
        status: 'not_authorized',
        error: 'Missing API key. Please check your Soniox AI configuration.'
      })
      return
    }

    this.streamingCallback = callback;

    this.ws = new WebSocket('wss://stt-rt.soniox.com/transcribe-websocket');
    // All callbacks must use arrow functions to keep "this" binding
    this.ws.onopen = () => this.onWebsocketOpen();
    this.ws.onmessage = (event) => this.onWebSocketMessage(event);
    this.ws.onerror = (event) => this.onWebSocketError(event);
    this.ws.onclose = () => this.onWebSocketClose();
  }

  async sendAudioChunk(chunk: Blob): Promise<void> {
    if (this.ws && this.connected) {
      const arrayBuffer = await chunk.arrayBuffer();
      console.log("sending", arrayBuffer.byteLength)
      this.ws.send(arrayBuffer);
    }
  }

  async endStreaming(): Promise<void> {
    if (this.ws && this.connected) {
      this.ws.send(''); // End-of-stream (empty frame)
    }
  }

  async isModelDownloaded(model: string): Promise<boolean> {
    return false
  }

  deleteModel(model: string): Promise<void> {
    return
  }

  deleteAllModels(): Promise<void> {
    return
  }

  private onWebsocketOpen() {

    if (!this.ws) {
      return;
    }

    const config: Record<string, any> = {
      api_key: this.config.engines.soniox?.apiKey,
      model: "stt-rt-preview",
      audio_format: "auto",
    };

    this.ws.send(JSON.stringify(config));
    this.connected = true;
      console.log('CONNCETED');
  }

  private onWebSocketMessage(event: MessageEvent) {
    console.debug('Soniox WebSocket message received:', event);
    try {
      const data = JSON.parse(event.data);

      if (data) {
        for (const token of data.tokens) {
          this.streamingCallback?.({
            type: 'text', content: token.text
          });
        }
      }
    } catch (error) {
      console.error('Error parsing WebSocket message:', error);
    }
  }

  private onWebSocketError(event: Event) {
    this.connected = false;
    console.error('Soniox websocket error', event);
  }

  private onWebSocketClose() {
    this.connected = false;
    this.ws = null;
  }

}
