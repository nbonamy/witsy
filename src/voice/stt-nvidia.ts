import { Configuration } from 'types/config'
import { STTEngine, ProgressCallback, TranscribeResponse } from './stt'

export default class STTNvidia implements STTEngine {

  config: Configuration
  invokeUrl = "https://integrate.api.nvidia.com/v1/chat/completions"

  static readonly models: any[] = [
    { id: 'microsoft/phi-4-multimodal-instruct', label: 'Microsoft Phi-4 Multimodal' },
  ]

  constructor(config: Configuration) {
    this.config = config
  }

  get name(): string {
    return 'nvidia'
  }

  isReady(): boolean {
    return true
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  isStreamingModel(model: string): boolean {
    return false
  }

  static requiresDownload(): boolean {
    return false
  }

  requiresDownload(): boolean {
    return STTNvidia.requiresDownload()
  }

  async initialize(callback?: ProgressCallback): Promise<void> {
    callback?.({ status: 'ready', task: 'nvidia', model: this.config.stt.model })
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async transcribe(audioBlob: Blob, opts?: object): Promise<TranscribeResponse> {
    try {
      
      const payloadBase64 = await this.blobToBase64(audioBlob)
      
      const headers = {
        'Authorization': `Bearer ${this.config.engines.nvidia?.apiKey}`,
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      }

      const payload = {
        model: this.config.stt.model,
        messages: [{
          role: 'user',
          content: `${this.config.stt.nvidia.prompt}.\n<audio src="data:${audioBlob.type.split(';')[0] || 'audio/webm'};base64,${payloadBase64}" />`
        }],
        stream: false
      }

      const response = await fetch(this.invokeUrl, { 
        method: 'POST',
        headers: headers,
        body: JSON.stringify(payload)
      })

      if (!response.ok) {
        throw new Error(`nVidia API error: ${response.status} ${response.statusText}`)
      }

      const data = await response.json()
      
      // Extract just the transcription text from the AI response
      const responseText = data.choices[0].message.content.trim()
      
      // Return the response
      return { text: responseText }
    } catch (error) {
      console.error('Nvidia STT error:', error)
      throw error
    }
  }
  
  private blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onloadend = () => {
        const base64String = (reader.result as string).split(',')[1]
        resolve(base64String)
      }
      reader.onerror = reject
      reader.readAsDataURL(blob)
    })
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async isModelDownloaded(model: string): Promise<boolean> {
    return true
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async deleteModel(model: string): Promise<void> {
    return Promise.resolve()
  }

  async deleteAllModels(): Promise<void> {
    return Promise.resolve()
  }
}