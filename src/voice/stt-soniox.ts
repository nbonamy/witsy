
import { anyDict } from '../types/index'
import { Configuration } from '../types/config'
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
    { id: 'async-transcription', label: 'Async Transcription' },
    { id: 'realtime-transcription', label: 'Real-Time Transcription' },
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

  requiresPcm16bits(model: string): boolean {
    // For now, use PCM for realtime streaming (more reliable)
    // Could be made configurable to allow WebM alternative
    return model === 'realtime-transcription'
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

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async transcribe(audioBlob: Blob, opts?: Record<string, any>): Promise<TranscribeResponse> {
    const apiKey = this.config.engines?.soniox?.apiKey
    if (!apiKey) {
      throw new Error('Missing Soniox API key. Please configure your API key in Settings > Audio > Speech to Text.')
    }

    try {
      // Step 1: Upload the audio file first
      const fileId = await this.uploadAudioFile(audioBlob, apiKey)
      
      // Step 2: Create transcription with file_id and user settings
      const requestBody: any = {
        file_id: fileId,
        model: 'stt-async-preview'
      }
      
      // Add language hints for better recognition
      const locale = this.config.stt?.locale
      if (locale && locale.trim().length > 0) {
        const langCode = locale.split('-')[0].toLowerCase()
        requestBody.language_hints = [langCode]
      }
      
      // Add vocabulary context for improved recognition
      const vocabularyWords = this.config.stt?.vocabulary?.map(v => v.text)?.filter(text => text.trim().length > 0)
      if (vocabularyWords && vocabularyWords.length > 0) {
        requestBody.context = vocabularyWords.join(', ')
      }
      
      const response = await fetch('https://api.soniox.com/v1/transcriptions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      })

      if (!response.ok) {
        const errorText = await response.text()
        console.error('Soniox transcription failed:', errorText)
        throw new Error(`Soniox transcription failed: ${response.status} ${response.statusText} - ${errorText}`)
      }

      const transcriptionData = await response.json()
      
      const transcriptionId = transcriptionData.transcription_id || transcriptionData.id
      if (!transcriptionId) {
        throw new Error(`Soniox API response missing transcription_id. Response: ${JSON.stringify(transcriptionData)}`)
      }

      // Step 3: Poll for completion
      const result = await this.pollTranscriptionStatus(transcriptionId, apiKey)
      
      // Step 4: Optionally clean up the uploaded file
      if (this.config.stt?.soniox?.cleanup) {
        await this.deleteUploadedFile(fileId, apiKey)
      }
      
      return result
      
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

  private async uploadAudioFile(audioBlob: Blob, apiKey: string): Promise<string> {
    let filename = 'audio.webm'
    const mimeType = audioBlob.type
    if (mimeType.includes('wav')) {
      filename = 'audio.wav'
    } else if (mimeType.includes('mp3')) {
      filename = 'audio.mp3'
    } else if (mimeType.includes('mp4') || mimeType.includes('m4a')) {
      filename = 'audio.m4a'
    } else if (mimeType.includes('ogg')) {
      filename = 'audio.ogg'
    } else if (mimeType.includes('flac')) {
      filename = 'audio.flac'
    }

    const formData = new FormData()
    formData.append('file', audioBlob, filename)

    if (filename === 'audio.webm' && (audioBlob as any)._audioDuration) {
      console.log(`Uploading WebM with duration: ${(audioBlob as any)._audioDuration}ms`)
    }
    
    const response = await fetch('https://api.soniox.com/v1/files', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`
      },
      body: formData
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`File upload failed: ${response.status} ${response.statusText} - ${errorText}`)
    }

    const responseData = await response.json()
    
    // The response contains an 'id' field with the file identifier
    const fileId = responseData.id
    if (!fileId) {
      throw new Error(`Upload response missing id field. Response: ${JSON.stringify(responseData)}`)
    }

    return fileId
  }

  private async deleteUploadedFile(fileId: string, apiKey: string): Promise<void> {
    try {
      await fetch(`https://api.soniox.com/v1/files/${fileId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${apiKey}` }
      })
    } catch (error) {
      console.warn('Failed to delete uploaded file:', error)
    }
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

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
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
        // Send initial configuration message with correct audio format for WebSocket
        const configMessage: anyDict = {
          api_key: apiKey,
          model: 'stt-rt-preview-v2',
          audio_format: 'pcm_s16le', // PCM 16-bit little-endian for WebSocket streaming
          sample_rate: 16000, // Standard sample rate for speech recognition
          num_channels: 1, // Mono audio (single channel)
          enable_non_final_tokens: false,
          enable_profanity_filter: false,
          enable_dictation: true
        }
        
        // Add language hints for better recognition
        const locale = this.config.stt?.locale
        if (locale && locale.trim().length > 0) {
          const langCode = locale.split('-')[0].toLowerCase()
          configMessage.language_hints = [langCode]
        }
        
        // Add vocabulary context for improved recognition
        const vocabularyWords = this.config.stt?.vocabulary?.map(v => v.text)?.filter(text => text.trim().length > 0)
        if (vocabularyWords && vocabularyWords.length > 0) {
          configMessage.context = vocabularyWords.join(', ')
        }
        
        //console.log('Soniox realtime config:', configMessage)
        this.ws?.send(JSON.stringify(configMessage))
        callback({ type: 'status', status: 'connected' })
      }

      this.ws.onmessage = (event: MessageEvent) => {
        try {
          const data = JSON.parse(event.data)
          
          // Handle server errors
          if (data.error_code || data.error_message) {
            const errorMsg = `Soniox error ${data.error_code}: ${data.error_message}`
            console.error('Soniox server error:', data)
            callback({ 
              type: 'error', 
              status: 'error', 
              error: errorMsg 
            })
            return
          }
          
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
        // console.log('Soniox WebSocket closed:', event.code, event.reason)
        
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
    if (tokens.length === 0) {
      return
    }
    
    let finalText = ''
    let hasFinalTokens = false
    
    // Process only final tokens since enable_non_final_tokens is false
    for (const token of tokens) {
      if (token.is_final) {
        finalText += token.text
        hasFinalTokens = true
      }
    }
    
    // Send callback only for final tokens
    if (hasFinalTokens) {
      this.finalTranscript += finalText
      callback({ 
        type: 'text', 
        content: this.finalTranscript.trim()
      })
    }
  }

  async sendAudioChunk(chunk: Blob): Promise<void> {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      // For PCM streaming, we expect the chunk to be raw PCM data (ArrayBuffer or Uint8Array)
      if (chunk instanceof ArrayBuffer) {
        // Direct PCM data from audio worklet
        this.ws.send(chunk)
      } else {
        // Convert Blob to ArrayBuffer if needed
        const buf = await chunk.arrayBuffer()
        this.ws.send(buf)
      }
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

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async transcribeFile(file: File, opts?: object): Promise<TranscribeResponse> {
    // Convert File to Blob and use the existing transcribe method
    // Do NOT pass opts as it might contain conflicting audio_url field
    const blob = new Blob([file], { type: file.type })
    return this.transcribe(blob)
  }
}
