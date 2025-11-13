import { Configuration } from 'types/config'
import { STTEngine, ProgressCallback, TranscribeResponse } from './stt'
import * as webmConverter from 'webm-to-wav-converter'

export default class STTMistral implements STTEngine {

  config: Configuration

  static readonly models = [
    { id: 'voxtral-mini-latest', label: 'Voxtral Mini (online)' },
    { id: 'voxtral-small-latest', label: 'Voxtral Small (online)' },
    { id: 'voxtral-mini-latest-transcribe', label: 'Voxtral Mini Transcribe (online)' },
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
    // Convert to WAV format for Mistral compatibility
    try {
      const wavBlob = await webmConverter.getWaveBlob(audioBlob, false)
      const file = new File([wavBlob], 'audio.wav', { type: 'audio/wav' })
      return this.transcribeFile(file, opts)
    } catch (error) {
      console.error(`[STT-Mistral] WAV conversion failed:`, error)
      // Fallback to original file
      return this.transcribeFile(new File([audioBlob], 'audio.webm', { type: audioBlob.type }), opts)
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async transcribeFile(file: File, opts?: object): Promise<TranscribeResponse> {
    
    // Check if we have an API key
    if (!this.config.engines.mistralai?.apiKey) {
      throw new Error('Missing API key. Please check your Mistral configuration.')
    }

    // For transcription-only models, use the transcription endpoint
    if (this.config.stt.model.includes('transcribe')) {
      return this.transcribeWithTranscriptionAPI(file)
    } else {
      // For other models, use the chat completions endpoint
      return this.transcribeWithCompletionAPI(file)
    }
  }

  private async transcribeWithTranscriptionAPI(file: File): Promise<TranscribeResponse> {
    // Ensure the file has a proper audio MIME type
    let audioFile = file
    console.log(`[STT-Mistral] TranscriptionAPI - Input file MIME type: ${file.type}`)
    // Convert any webm type to simple audio/webm to avoid codec-specific issues
    if (file.type.includes('webm')) {
      audioFile = new File([file], file.name, { type: 'audio/webm' })
      console.log(`[STT-Mistral] TranscriptionAPI - Converted file MIME type to: ${audioFile.type}`)
    }
    
    const formData = new FormData()
    formData.append('file', audioFile)
    //formData.append('model', this.config.stt.model) // Can't use this because it is voxtral-mini-latest-transcribe which is not actually a model name
    formData.append('model', 'voxtral-mini-latest')
    
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



  private async transcribeWithCompletionAPI(file: File): Promise<TranscribeResponse> {
    // Ensure the file has a proper audio MIME type
    let audioFile = file
    console.log(`[STT-Mistral] CompletionAPI - Input file MIME type: ${file.type}`)
    // Convert any webm type to simple audio/webm to avoid codec-specific issues
    if (file.type.includes('webm')) {
      audioFile = new File([file], file.name.replace('.webm', '.webm'), { type: 'audio/webm' })
      console.log(`[STT-Mistral] CompletionAPI - Converted file MIME type to: ${audioFile.type}`)
    }
    
    // Upload the file first
    const formData = new FormData()
    formData.append('file', audioFile)
    formData.append('purpose', 'audio')

    // Debug: Log what we're actually sending
    console.log(`[STT-Mistral] FormData file name: ${audioFile.name}`)
    console.log(`[STT-Mistral] FormData file type: ${audioFile.type}`)
    console.log(`[STT-Mistral] FormData file size: ${audioFile.size}`)
    
    // Try to inspect the FormData
    for (const [key, value] of formData.entries()) {
      console.log(`[STT-Mistral] FormData entry: ${key} =`, value)
      if (value instanceof File) {
        console.log(`[STT-Mistral] FormData file details: name=${value.name}, type=${value.type}, size=${value.size}`)
      }
    }

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
