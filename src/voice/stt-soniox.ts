
import { Configuration } from 'types/config'
import { STTEngine, ProgressCallback, TranscribeResponse, StreamingCallback } from './stt'

/**
 * Soniox speech-to-text engine supporting both async and real-time transcription.
 * 
 * Async API:
 *   - POST /v1/transcriptions with direct audio data
 *   - GET /v1/transcriptions/{id} for status polling
 *   - GET /v1/transcriptions/{id}/transcript for final text
 *
 * Real-time API:
 *   - WebSocket wss://stt-rt.soniox.com/transcribe-websocket
 *   - JSON config message followed by binary audio chunks
 *   - Receives tokens with is_final flag for progressive display
 */
export default class STTSoniox implements STTEngine {

  static readonly models = [
    { id: 'file-transcription', label: 'File Transcription (async)' },
    { id: 'realtime-transcription', label: 'Real-time Transcription' },
  ]

  private config: Configuration
  private ws: WebSocket | null
  private finalTranscript = ''
  private pendingError: string | null = null

  constructor(config: Configuration) {
    this.config = config
    this.ws = null
  }

  get name(): string {
    return 'soniox'
  }

  isReady(): boolean {
    return true
  }

  isStreamingModel(model: string): boolean {
    return model === 'realtime-transcription'
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  requiresPcm16bits(model: string): boolean {
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

  async transcribe(audioBlob: Blob, opts?: Record<string, any>): Promise<TranscribeResponse> {
    const apiKey = this.config.engines?.soniox?.apiKey
    if (!apiKey) {
      throw new Error('Missing Soniox API key. Please configure your API key in Settings > Audio > Speech to Text.')
    }

    try {
      // Convert blob to base64 for direct API submission
      const base64Audio = await this.blobToBase64(audioBlob)
      const audioFormat = this.detectAudioFormat(audioBlob)
      const languageHints = this.config.stt?.vocabulary?.map(v => v.text) || []
      
      // Create transcription with direct audio data
      const response = await fetch('https://api.soniox.com/v1/transcriptions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          audio_data: base64Audio,
          model: 'stt-async-preview',
          audio_format: audioFormat,
          ...(languageHints.length > 0 && { language_hints: languageHints })
        })
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`Soniox transcription failed: ${response.status} ${response.statusText} - ${errorText}`)
      }

      const { transcription_id } = await response.json()
      if (!transcription_id) {
        throw new Error('Soniox API response missing transcription_id')
      }

      // Poll for completion
      return await this.pollTranscriptionStatus(transcription_id, apiKey)
      
    } catch (error) {
      console.error('Soniox transcription error:', error)
      throw error
    }
  }

  private async blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          // Remove data URL prefix (e.g., "data:audio/webm;base64,")
          const base64 = reader.result.split(',')[1]
          resolve(base64)
        } else {
          reject(new Error('Failed to convert blob to base64'))
        }
      }
      reader.onerror = () => reject(new Error('FileReader error'))
      reader.readAsDataURL(blob)
    })
  }

  private detectAudioFormat(blob: Blob): string {
    // Try to detect format from MIME type
    if (blob.type) {
      if (blob.type.includes('webm')) return 'webm'
      if (blob.type.includes('wav')) return 'wav'
      if (blob.type.includes('mp3')) return 'mp3'
      if (blob.type.includes('mp4') || blob.type.includes('m4a')) return 'm4a'
      if (blob.type.includes('ogg')) return 'ogg'
      if (blob.type.includes('flac')) return 'flac'
    }
    // Default to auto-detection
    return 'auto'
  }

  private async pollTranscriptionStatus(transcriptionId: string, apiKey: string): Promise<TranscribeResponse> {
    const maxAttempts = 60 // 60 seconds max
    
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const statusResponse = await fetch(`https://api.soniox.com/v1/transcriptions/${transcriptionId}`, {
        headers: { 'Authorization': `Bearer ${apiKey}` }
      })

      if (!statusResponse.ok) {
        throw new Error(`Status check failed: ${statusResponse.status} ${statusResponse.statusText}`)
      }

      const statusData = await statusResponse.json()
      
      if (statusData.status === 'completed') {
        // Get the final transcript
        const transcriptResponse = await fetch(`https://api.soniox.com/v1/transcriptions/${transcriptionId}/transcript`, {
          headers: { 'Authorization': `Bearer ${apiKey}` }
        })

        if (!transcriptResponse.ok) {
          throw new Error(`Transcript retrieval failed: ${transcriptResponse.status} ${transcriptResponse.statusText}`)
        }

        const transcriptData = await transcriptResponse.json()
        
        // Optional cleanup
        if (this.config.stt?.soniox?.cleanup) {
          this.cleanupTranscription(transcriptionId, apiKey)
        }
        
        return { text: transcriptData.text || '' }
      } else if (statusData.status === 'error') {
        throw new Error(`Transcription failed: ${statusData.error_message || 'Unknown error'}`)
      }
      
      // Wait 1 second before next poll
      await new Promise(resolve => setTimeout(resolve, 1000))
    }
    
    throw new Error('Transcription timed out - please try again with a shorter audio file')
  }

  private async cleanupTranscription(transcriptionId: string, apiKey: string): Promise<void> {
    try {
      await fetch(`https://api.soniox.com/v1/transcriptions/${transcriptionId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${apiKey}` }
      })
    } catch (error) {
      console.warn('Failed to cleanup transcription:', error)
    }
  }

  async startStreaming(model: string, callback: StreamingCallback, opts?: Record<string, any>): Promise<void> {
    if (this.ws) {
      console.warn('WebSocket already active')
      return
    }

    const apiKey = this.config.engines?.soniox?.apiKey
    if (!apiKey) {
      callback({ 
        type: 'error', 
        status: 'not_authorized', 
        error: 'Missing Soniox API key. Please configure your API key in Settings > Audio > Speech to Text.' 
      })
      return
    }

    this.finalTranscript = ''
    this.pendingError = null
    
    try {
      this.ws = new WebSocket('wss://stt-rt.soniox.com/transcribe-websocket')
      
      this.ws.onopen = () => {
        // Send initial configuration message
        const configMessage = {
          api_key: apiKey, // Use direct API key, no temporary keys
          model: 'stt-rt-preview',
          audio_format: 'auto',
          enable_non_final_tokens: true
        }
        
        // Add language hints if available
        const languageHints = this.config.stt?.vocabulary?.map(v => v.text)
        if (languageHints && languageHints.length > 0) {
          configMessage.language_hints = languageHints
        }
        
        this.ws?.send(JSON.stringify(configMessage))
        callback({ type: 'status', status: 'connected' })
      }

      this.ws.onmessage = (event: MessageEvent) => {
        try {
          const data = JSON.parse(event.data)
          
          // Handle tokens array
          if (data.tokens && Array.isArray(data.tokens)) {
            this.handleTokens(data.tokens, callback)
          }
          
          // Handle completion
          if (data.finished) {
            callback({ type: 'status', status: 'done' })
          }
          
        } catch (error) {
          console.error('Error parsing WebSocket message:', error)
          callback({ 
            type: 'error', 
            status: 'error', 
            error: 'Failed to parse server response' 
          })
        }
      }

      this.ws.onerror = (event: Event) => {
        const errorMsg = (event as ErrorEvent)?.message || 'WebSocket connection failed'
        console.error('Soniox WebSocket error:', errorMsg)
        this.pendingError = errorMsg
      }

      this.ws.onclose = (event: CloseEvent) => {
        console.log('Soniox WebSocket closed:', event.code, event.reason)
        
        if (this.pendingError) {
          callback({ type: 'error', status: 'error', error: this.pendingError })
        } else if (event.code !== 1000) {
          // Abnormal closure
          callback({ 
            type: 'error', 
            status: 'error', 
            error: `Connection closed unexpectedly (${event.code}: ${event.reason || 'Unknown'})` 
          })
        } else {
          callback({ type: 'status', status: 'done' })
        }
        
        this.ws = null
      }
      
    } catch (error) {
      console.error('Failed to create WebSocket:', error)
      callback({ 
        type: 'error', 
        status: 'error', 
        error: `Failed to establish connection: ${error.message}` 
      })
    }
  }

  private handleTokens(tokens: any[], callback: StreamingCallback): void {
    let partialText = ''
    
    // Process tokens: final tokens are added to permanent transcript,
    // non-final tokens are collected as temporary text
    for (const token of tokens) {
      if (token.is_final) {
        this.finalTranscript += token.text
      } else {
        partialText += token.text
      }
    }
    
    // Combine final transcript with current partial text
    const content = (this.finalTranscript + partialText).trim()
    
    if (content) {
      callback({ type: 'text', content })
    }
  }

  async sendAudioChunk(chunk: Blob): Promise<void> {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      const buf = await chunk.arrayBuffer()
      this.ws.send(buf)
    }
  }

  async endStreaming(): Promise<void> {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      // Send empty binary frame to signal end of stream
      this.ws.send(new Uint8Array())
      // Close connection after a brief delay to allow final processing
      setTimeout(() => {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
          this.ws.close(1000, 'Stream ended')
        }
      }, 100)
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
