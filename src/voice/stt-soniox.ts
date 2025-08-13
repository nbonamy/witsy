
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
    let finalBlob: Blob
    let filename: string
    
    // Convert WebM to OGG Vorbis for universal compatibility 
    if (audioBlob.type.includes('webm')) {
      try {
        // Convert WebM to WAV using Web Audio API for maximum compatibility
        finalBlob = await this.convertWebmToOgg(audioBlob)
        filename = 'audio.wav'
      } catch (error) {
        console.warn('WebM to OGG conversion failed, using original WebM:', error)
        finalBlob = audioBlob
        filename = 'audio.webm'
      }
    } else {
      // For other audio formats, use as-is
      finalBlob = audioBlob
      const mimeType = finalBlob.type
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
      } else {
        filename = 'audio.webm' // Default to WebM for unknown types
      }
    }
    
    const formData = new FormData()
    formData.append('file', finalBlob, filename)
    
    // Add additional metadata to help Soniox process the file
    if (filename === 'audio.webm' && (finalBlob as any)._audioDuration) {
      console.log(`Uploading WebM with duration: ${(finalBlob as any)._audioDuration}ms`)
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

  /**
   * Convert WebM to OGG Vorbis for better compatibility
   * Uses Web Audio API to decode WebM and re-encode as OGG
   */
  private async convertWebmToOgg(webmBlob: Blob): Promise<Blob> {
    try {
      // Decode WebM audio using Web Audio API
      const audioContext = new window.AudioContext()
      const arrayBuffer = await webmBlob.arrayBuffer()
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer)
      
      // console.log(`Converting WebM: ${audioBuffer.duration}s, ${audioBuffer.numberOfChannels} channels, ${audioBuffer.sampleRate}Hz`)
      
      // Create offline context for rendering
      const offlineContext = new OfflineAudioContext(
        audioBuffer.numberOfChannels,
        audioBuffer.length,
        audioBuffer.sampleRate
      )
      
      // Create buffer source
      const source = offlineContext.createBufferSource()
      source.buffer = audioBuffer
      source.connect(offlineContext.destination)
      source.start(0)
      
      // Render audio
      const renderedBuffer = await offlineContext.startRendering()
      
      // Convert to WAV format (more reliable than OGG for now)
      const wavBlob = await this.audioBufferToWav(renderedBuffer)
      
      audioContext.close()
      return wavBlob
      
    } catch (error) {
      console.error('WebM to OGG conversion failed:', error)
      throw error
    }
  }

  /**
   * Convert AudioBuffer to WAV Blob
   * This creates a proper WAV file with all metadata
   */
  private async audioBufferToWav(audioBuffer: AudioBuffer): Promise<Blob> {
    const numberOfChannels = audioBuffer.numberOfChannels
    const sampleRate = audioBuffer.sampleRate
    const length = audioBuffer.length * numberOfChannels * 2 // 16-bit samples
    
    // Create WAV file buffer
    const buffer = new ArrayBuffer(44 + length)
    const view = new DataView(buffer)
    
    // WAV header
    const writeString = (offset: number, string: string) => {
      for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i))
      }
    }
    
    // RIFF header
    writeString(0, 'RIFF')
    view.setUint32(4, 36 + length, true) // file length - 8
    writeString(8, 'WAVE')
    
    // fmt chunk
    writeString(12, 'fmt ')
    view.setUint32(16, 16, true) // fmt chunk length
    view.setUint16(20, 1, true) // PCM format
    view.setUint16(22, numberOfChannels, true)
    view.setUint32(24, sampleRate, true)
    view.setUint32(28, sampleRate * numberOfChannels * 2, true) // byte rate
    view.setUint16(32, numberOfChannels * 2, true) // block align
    view.setUint16(34, 16, true) // bits per sample
    
    // data chunk
    writeString(36, 'data')
    view.setUint32(40, length, true)
    
    // Convert audio data
    let offset = 44
    for (let i = 0; i < audioBuffer.length; i++) {
      for (let channel = 0; channel < numberOfChannels; channel++) {
        const sample = Math.max(-1, Math.min(1, audioBuffer.getChannelData(channel)[i]))
        const intSample = sample < 0 ? sample * 0x8000 : sample * 0x7FFF
        view.setInt16(offset, intSample, true)
        offset += 2
      }
    }
    
    return new Blob([buffer], { type: 'audio/wav' })
  }

  /**
   * Fix WebM duration metadata by injecting EBML duration element
   * MediaRecorder in browsers creates WebM files without duration metadata
   * This method determines duration and writes it into the WebM file structure
   */
  private async fixWebmDurationMetadata(webmBlob: Blob): Promise<Blob> {
    try {
      // Get audio duration using Web Audio API
      const durationSeconds = (await this.getAudioDuration(webmBlob)) / 1000
      console.log(`WebM duration calculated: ${durationSeconds}s`)
      
      // Read the original WebM file as array buffer
      const originalBuffer = await webmBlob.arrayBuffer()
      const uint8Array = new Uint8Array(originalBuffer)
      
      // Try to inject duration metadata into WebM EBML structure
      // If injection fails, fall back to original file
      try {
        const fixedBuffer = await this.injectWebmDuration(uint8Array, durationSeconds)
        
        // warning in vscode but if we put a @ts-expect-error, tsc complains...
        const fixedBlob = new Blob([fixedBuffer], { 
          type: 'audio/webm;codecs=opus'
        })
        
        console.log(`WebM metadata injected - original: ${uint8Array.length}, fixed: ${fixedBuffer.length}`)
        return fixedBlob
      } catch (injectionError) {
        console.warn('WebM EBML injection failed, using original with proper MIME type:', injectionError)
        
        const fixedBlob = new Blob([uint8Array], { 
          type: 'audio/webm;codecs=opus'
        })
        
        return fixedBlob
      }
      
    } catch (error) {
      console.error('Error fixing WebM metadata:', error)
      // Fallback to original with corrected MIME type
      return new Blob([webmBlob], { 
        type: 'audio/webm;codecs=opus'
      })
    }
  }

  /**
   * Inject duration metadata into WebM EBML structure
   * This is a simplified implementation of WebM duration injection
   */
  private async injectWebmDuration(originalData: Uint8Array, durationSeconds: number): Promise<Uint8Array> {
    // WebM EBML element IDs
    const EBML_ID_SEGMENT = 0x18538067
    const EBML_ID_INFO = 0x1549A966  
    const EBML_ID_DURATION = 0x4489
    
    // Find the Segment element
    const segmentOffset = this.findEbmlElement(originalData, EBML_ID_SEGMENT)
    if (segmentOffset === -1) {
      throw new Error('Could not find WebM Segment element')
    }
    
    // Find the Info element within Segment
    const infoOffset = this.findEbmlElement(originalData, EBML_ID_INFO, segmentOffset)
    if (infoOffset === -1) {
      throw new Error('Could not find WebM Info element')
    }
    
    // Check if duration already exists
    const existingDurationOffset = this.findEbmlElement(originalData, EBML_ID_DURATION, infoOffset)
    if (existingDurationOffset !== -1) {
      console.log('Duration already exists in WebM file')
      return originalData
    }
    
    // Create duration element (8-byte double)
    const durationElement = new Uint8Array(12)
    durationElement[0] = 0x44  // Duration ID byte 1
    durationElement[1] = 0x89  // Duration ID byte 2
    durationElement[2] = 0x88  // Size = 8 bytes
    
    // Convert duration to double (IEEE 754)
    const durationBuffer = new ArrayBuffer(8)
    const durationView = new DataView(durationBuffer)
    durationView.setFloat64(0, durationSeconds * 1000, false) // WebM uses milliseconds
    
    durationElement.set(new Uint8Array(durationBuffer), 4)
    
    // Find insertion point (after Info element header)
    const infoSizeOffset = infoOffset + 4
    const infoSize = this.readEbmlSize(originalData, infoSizeOffset)
    const infoContentOffset = infoSizeOffset + this.getEbmlSizeLength(originalData, infoSizeOffset)
    
    // Create new buffer with injected duration
    const newSize = originalData.length + durationElement.length
    const newData = new Uint8Array(newSize)
    
    // Copy data before insertion point
    newData.set(originalData.subarray(0, infoContentOffset), 0)
    
    // Insert duration element
    newData.set(durationElement, infoContentOffset)
    
    // Copy remaining data
    newData.set(originalData.subarray(infoContentOffset), infoContentOffset + durationElement.length)
    
    // Update Info element size
    const newInfoSize = infoSize + durationElement.length
    this.writeEbmlSize(newData, infoSizeOffset, newInfoSize)
    
    return newData
  }
  
  /**
   * Find EBML element by ID
   */
  private findEbmlElement(data: Uint8Array, elementId: number, startOffset: number = 0): number {
    const idBytes = this.numberToBytes(elementId)
    
    for (let i = startOffset; i < data.length - idBytes.length; i++) {
      let match = true
      for (let j = 0; j < idBytes.length; j++) {
        if (data[i + j] !== idBytes[j]) {
          match = false
          break
        }
      }
      if (match) {
        return i
      }
    }
    return -1
  }
  
  /**
   * Convert number to bytes for EBML element ID
   */
  private numberToBytes(num: number): Uint8Array {
    const bytes = []
    while (num > 0) {
      bytes.unshift(num & 0xFF)
      num = num >>> 8
    }
    return new Uint8Array(bytes)
  }
  
  /**
   * Read EBML variable-length size
   */
  private readEbmlSize(data: Uint8Array, offset: number): number {
    const firstByte = data[offset]
    if (firstByte === 0) return 0
    
    // Count leading zeros to determine size length
    let sizeLength = 1
    let mask = 0x80
    while (!(firstByte & mask) && sizeLength < 8) {
      sizeLength++
      mask >>= 1
    }
    
    let size = firstByte & (mask - 1)
    for (let i = 1; i < sizeLength; i++) {
      size = (size << 8) | data[offset + i]
    }
    
    return size
  }
  
  /**
   * Get the length of an EBML size field
   */
  private getEbmlSizeLength(data: Uint8Array, offset: number): number {
    const firstByte = data[offset]
    if (firstByte === 0) return 1
    
    let sizeLength = 1
    let mask = 0x80
    while (!(firstByte & mask) && sizeLength < 8) {
      sizeLength++
      mask >>= 1
    }
    
    return sizeLength
  }
  
  /**
   * Write EBML variable-length size
   */
  private writeEbmlSize(data: Uint8Array, offset: number, size: number): void {
    // This is a simplified implementation - in practice, you'd need to handle
    // cases where the new size requires more bytes than the original
    const originalLength = this.getEbmlSizeLength(data, offset)
    
    // For now, just try to fit in the same space
    if (size < 127 && originalLength >= 1) {
      data[offset] = 0x80 | size
    }
    // Add more cases as needed for different size lengths
  }

  /**
   * Get audio duration from blob using Web Audio API
   */
  private async getAudioDuration(audioBlob: Blob): Promise<number> {
    return new Promise((resolve, reject) => {
      try {
        const audioContext = new window.AudioContext()
        const fileReader = new FileReader()
        
        fileReader.onload = async (event) => {
          try {
            const arrayBuffer = event.target?.result as ArrayBuffer
            const audioBuffer = await audioContext.decodeAudioData(arrayBuffer)
            const durationMs = audioBuffer.duration * 1000 // Convert to milliseconds
            audioContext.close()
            resolve(durationMs)
          } catch (decodeError) {
            audioContext.close()
            reject(new Error(`Failed to decode audio for duration: ${decodeError.message}`))
          }
        }
        
        fileReader.onerror = () => {
          reject(new Error('Failed to read audio file for duration calculation'))
        }
        
        fileReader.readAsArrayBuffer(audioBlob)
      } catch (error) {
        reject(new Error(`Web Audio API error: ${error.message}`))
      }
    })
  }

}
