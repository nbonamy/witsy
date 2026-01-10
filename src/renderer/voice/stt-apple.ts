import { Configuration } from 'types/config'
import { STTEngine, ProgressCallback, TranscribeResponse } from './stt'
import * as webmConverter from 'webm-to-wav-converter'

export default class STTApple implements STTEngine {

  config: Configuration

  // Supported locales for Apple SpeechAnalyzer (macOS 26+)
  static readonly locales = [
    { id: 'ar-SA', label: 'Arabic (Saudi Arabia)' },
    { id: 'da-DK', label: 'Danish (Denmark)' },
    { id: 'de-AT', label: 'German (Austria)' },
    { id: 'de-CH', label: 'German (Switzerland)' },
    { id: 'de-DE', label: 'German (Germany)' },
    { id: 'en-AU', label: 'English (Australia)' },
    { id: 'en-CA', label: 'English (Canada)' },
    { id: 'en-GB', label: 'English (United Kingdom)' },
    { id: 'en-IE', label: 'English (Ireland)' },
    { id: 'en-IN', label: 'English (India)' },
    { id: 'en-NZ', label: 'English (New Zealand)' },
    { id: 'en-SG', label: 'English (Singapore)' },
    { id: 'en-US', label: 'English (United States)' },
    { id: 'en-ZA', label: 'English (South Africa)' },
    { id: 'es-CL', label: 'Spanish (Chile)' },
    { id: 'es-ES', label: 'Spanish (Spain)' },
    { id: 'es-MX', label: 'Spanish (Mexico)' },
    { id: 'es-US', label: 'Spanish (United States)' },
    { id: 'fi-FI', label: 'Finnish (Finland)' },
    { id: 'fr-BE', label: 'French (Belgium)' },
    { id: 'fr-CA', label: 'French (Canada)' },
    { id: 'fr-CH', label: 'French (Switzerland)' },
    { id: 'fr-FR', label: 'French (France)' },
    { id: 'he-IL', label: 'Hebrew (Israel)' },
    { id: 'it-CH', label: 'Italian (Switzerland)' },
    { id: 'it-IT', label: 'Italian (Italy)' },
    { id: 'ja-JP', label: 'Japanese (Japan)' },
    { id: 'ko-KR', label: 'Korean (South Korea)' },
    { id: 'ms-MY', label: 'Malay (Malaysia)' },
    { id: 'nb-NO', label: 'Norwegian Bokmål (Norway)' },
    { id: 'nl-BE', label: 'Dutch (Belgium)' },
    { id: 'nl-NL', label: 'Dutch (Netherlands)' },
    { id: 'pt-BR', label: 'Portuguese (Brazil)' },
    { id: 'ru-RU', label: 'Russian (Russia)' },
    { id: 'sv-SE', label: 'Swedish (Sweden)' },
    { id: 'th-TH', label: 'Thai (Thailand)' },
    { id: 'tr-TR', label: 'Turkish (Turkey)' },
    { id: 'vi-VN', label: 'Vietnamese (Vietnam)' },
    { id: 'yue-CN', label: 'Cantonese (China)' },
    { id: 'zh-CN', label: 'Chinese (Simplified, China)' },
    { id: 'zh-HK', label: 'Chinese (Traditional, Hong Kong)' },
    { id: 'zh-TW', label: 'Chinese (Traditional, Taiwan)' },
  ]

  constructor(config: Configuration) {
    this.config = config
  }

  get name(): string {
    return 'apple'
  }

  isReady(): boolean {
    // Check if we're on macOS 26+
    if (process.platform !== 'darwin') {
      return false
    }
    // TODO: Add version check for macOS 26+
    return true
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  isStreamingModel(model: string): boolean {
    return false
  }

  static requiresDownload(): boolean {
    // Models auto-download on first use
    return false
  }

  requiresDownload(): boolean {
    return STTApple.requiresDownload()
  }

  async initialize(callback?: ProgressCallback): Promise<void> {
    callback?.({ status: 'ready', task: 'apple', model: 'SpeechAnalyzer' })
  }

  async transcribe(audioBlob: Blob, opts?: object): Promise<TranscribeResponse> {
    try {
      // Convert to WAV format for Apple CLI compatibility
      const wavBlob = await webmConverter.getWaveBlob(audioBlob, false)

      // Convert to ArrayBuffer (can be sent via IPC)
      const arrayBuffer = await wavBlob.arrayBuffer()

      // Call main process IPC to run CLI
      const result = await window.api.transcribe.appleCli(arrayBuffer, {
        locale: this.config.stt.locale || '',
        live: false,
      })

      if (result.error) {
        throw new Error(result.error)
      }

      return { text: result.text }

    } catch (error) {
      console.error('[STT-Apple] Transcription failed:', error)
      throw error
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async isModelDownloaded(model: string): Promise<boolean> {
    // Models are managed by the system
    return true
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  deleteModel(model: string): Promise<void> {
    // Cannot delete system-managed models
    return Promise.resolve()
  }

  deleteAllModels(): Promise<void> {
    // Cannot delete system-managed models
    return Promise.resolve()
  }
}
