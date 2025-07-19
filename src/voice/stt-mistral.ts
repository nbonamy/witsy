import { Configuration } from '../types/config'
import { STTEngine, ProgressCallback, TranscribeResponse } from './stt'

export default class STTMistral implements STTEngine {

  config: Configuration

  static readonly models = [
    { id: 'voxtral-mini-2507', label: 'Voxtral Mini (online)' },
    { id: 'voxtral-small-2507', label: 'Voxtral Small (online)' },
    { id: 'voxtral-mini-latest', label: 'Voxtral Mini Transcribe (online)' },
  ]

  constructor(config: Configuration) {
    this.config = config
  }

  get name(): string {
    return 'mistralai'
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
    return STTMistral.requiresDownload()
  }
   
  async initialize(callback?: ProgressCallback): Promise<void> {
    callback?.({ status: 'ready', task: 'mistralai', model: this.config.stt.model })
  }

  async transcribe(audioBlob: Blob, opts?: object): Promise<TranscribeResponse> {
    return this.transcribeFile(new File([audioBlob], 'audio.webm', { type: audioBlob.type }), opts)
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async transcribeFile(file: File, opts?: object): Promise<TranscribeResponse> {
    
    // Check if we have an API key
    if (!this.config.engines.mistralai?.apiKey) {
      throw new Error('Missing API key. Please check your Mistral configuration.')
    }

    // For transcription-only models, use the transcription endpoint
    if (this.config.stt.model === 'voxtral-mini-latest') {
      return this.transcribeWithTranscriptionAPI(file)
    } else {
      // For other models, use the chat completions endpoint
      return this.transcribeWithChatAPI(file)
    }
  }

  private async transcribeWithTranscriptionAPI(file: File): Promise<TranscribeResponse> {
    const formData = new FormData()
    formData.append('file', file)
    formData.append('model', this.config.stt.model)
    
    if (this.config.stt.locale) {
      formData.append('language', this.config.stt.locale.substring(0, 2))
    }

    const response = await fetch('https://api.mistral.ai/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.config.engines.mistralai.apiKey}`,
      },
      body: formData
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Mistral API error: ${response.status} ${response.statusText} - ${errorText}`)
    }

    const result = await response.json()
    return { text: result.text || '' }
  }

  private async transcribeWithChatAPI(file: File): Promise<TranscribeResponse> {
    // Upload the file first
    const formData = new FormData()
    formData.append('file', file)
    formData.append('purpose', 'audio')

    const uploadResponse = await fetch('https://api.mistral.ai/v1/files', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.config.engines.mistralai.apiKey}`,
      },
      body: formData
    })

    if (!uploadResponse.ok) {
      const errorText = await uploadResponse.text()
      throw new Error(`Mistral file upload error: ${uploadResponse.status} ${uploadResponse.statusText} - ${errorText}`)
    }

    const uploadResult = await uploadResponse.json()
    const fileId = uploadResult.id

    // Get the signed URL for the uploaded file
    const urlResponse = await fetch(`https://api.mistral.ai/v1/files/${fileId}/url?expiry=24`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${this.config.engines.mistralai.apiKey}`,
      }
    })

    if (!urlResponse.ok) {
      const errorText = await urlResponse.text()
      throw new Error(`Mistral URL error: ${urlResponse.status} ${urlResponse.statusText} - ${errorText}`)
    }

    const urlResult = await urlResponse.json()
    const audioUrl = urlResult.url

    // Use the chat completions API with the audio URL
    const chatResponse = await fetch('https://api.mistral.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.config.engines.mistralai.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: this.config.stt.model,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'input_audio',
                input_audio: {
                  data: audioUrl,
                  format: file.type.split('/')[1] || 'mp3'
                }
              },
              {
                type: 'text',
                text: this.config.stt.mistralai?.prompt || 'Please transcribe this audio file.'
              }
            ]
          }
        ],
        temperature: 0.0
      })
    })

    if (!chatResponse.ok) {
      const errorText = await chatResponse.text()
      throw new Error(`Mistral chat API error: ${chatResponse.status} ${chatResponse.statusText} - ${errorText}`)
    }

    const chatResult = await chatResponse.json()
    const transcription = chatResult.choices?.[0]?.message?.content || ''
    
    return { text: transcription }
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async isModelDownloaded(model: string): Promise<boolean> {
    return false
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  deleteModel(model: string): Promise<void> {
    return Promise.resolve()
  }

  deleteAllModels(): Promise<void> {
    return Promise.resolve()
  }
}
