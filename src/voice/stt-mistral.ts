import { Configuration } from '../types/config'
import { STTEngine, ProgressCallback, TranscribeResponse } from './stt'

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
    // Convert to audio/wav, which is widely supported. Unknown why the audio/webm doesn't work.
    //console.log('[stt-mistral] '+audioBlob.type+' detected, converting to audio/wav');
    const wavBlob = await this.convertWebmToWav(audioBlob);
    return this.transcribeFile(new File([wavBlob], 'audio.wav', { type: 'audio/wav' }), opts);
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async transcribeFile(file: File, opts?: object): Promise<TranscribeResponse> {
    
    // Check if we have an API key
    if (!this.config.engines.mistralai?.apiKey) {
      throw new Error('Missing API key. Please check your Mistral configuration.')
    }

    // For transcription-only models, use the transcription endpoint
    if (this.config.stt.model === 'voxtral-mini-latest-transcribe') {
      return this.transcribeWithTranscriptionAPI(file)
    } else {
      // For other models, use the chat completions endpoint
      return this.transcribeWithChatAPI(file)
    }
  }

  private async transcribeWithTranscriptionAPI(file: File): Promise<TranscribeResponse> {
    const formData = new FormData()
    formData.append('file', file)
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

  /**
   * Converts a WebM Blob to a WAV Blob using the Web Audio API.
   * This is a workaround for the Mistral API not accepting audio/webm. (always thinks it's video/webm)
   * @param blob The input Blob, likely of type video/webm.
   * @returns A Promise that resolves to a Blob of type audio/wav.
   */
  private async convertWebmToWav(blob: Blob): Promise<Blob> {
    const arrayBuffer = await blob.arrayBuffer();
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

    // Minimal WAV encoder
    const wavBuffer = (() => {
      const numChannels = 1; // Mono
      const sampleRate = audioBuffer.sampleRate;
      const bitDepth = 16;
      const samples = audioBuffer.getChannelData(0);
      const dataLength = samples.length * (bitDepth / 8);
      const buffer = new ArrayBuffer(44 + dataLength);
      const view = new DataView(buffer);

      const writeString = (offset: number, str: string) => {
        for (let i = 0; i < str.length; i++) {
          view.setUint8(offset + i, str.charCodeAt(i));
        }
      };

      // RIFF header
      writeString(0, 'RIFF');
      view.setUint32(4, 36 + dataLength, true);
      writeString(8, 'WAVE');

      // fmt sub-chunk
      writeString(12, 'fmt ');
      view.setUint32(16, 16, true); // Sub-chunk size
      view.setUint16(20, 1, true); // PCM format
      view.setUint16(22, numChannels, true);
      view.setUint32(24, sampleRate, true);
      view.setUint32(28, sampleRate * numChannels * (bitDepth / 8), true); // Byte rate
      view.setUint16(32, numChannels * (bitDepth / 8), true); // Block align
      view.setUint16(34, bitDepth, true);

      // data sub-chunk
      writeString(36, 'data');
      view.setUint32(40, dataLength, true);

      // Write PCM samples
      let offset = 44;
      for (let i = 0; i < samples.length; i++, offset += 2) {
        const s = Math.max(-1, Math.min(1, samples[i]));
        view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
      }

      return buffer;
    })();
    
    return new Blob([wavBuffer], { type: 'audio/wav' });
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
