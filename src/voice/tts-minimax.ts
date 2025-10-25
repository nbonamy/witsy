
import { Configuration } from '../types/config'
import { SynthesisResponse, TTSEngine } from './tts-engine'
import { TTSVoice } from '../types/index'

export default class TTSMiniMax extends TTSEngine {

  static readonly models = [
    { id: 'speech-02-hd', label: 'Speech 02 HD' },
    { id: 'speech-02-turbo', label: 'Speech 02 Turbo' },
    { id: 'speech-01-hd', label: 'Speech 01 HD' },
    { id: 'speech-01-turbo', label: 'Speech 01 Turbo' },
  ]

  // Static fallback voices (subset of popular voices)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  static readonly voices = (model: string): TTSVoice[] => [
    { id: 'Wise_Woman', label: 'Wise Woman' },
    { id: 'Friendly_Person', label: 'Friendly Person' },
    { id: 'Narration_Woman', label: 'Narration Woman' },
    { id: 'Narration_Man', label: 'Narration Man' },
    { id: 'Professional_Man', label: 'Professional Man' },
    { id: 'Professional_Woman', label: 'Professional Woman' },
    { id: 'Young_Man', label: 'Young Man' },
    { id: 'Young_Woman', label: 'Young Woman' },
    { id: 'Elderly_Man', label: 'Elderly Man' },
    { id: 'Elderly_Woman', label: 'Elderly Woman' },
    { id: 'Energetic_Boy', label: 'Energetic Boy' },
    { id: 'Sweet_Girl', label: 'Sweet Girl' },
    { id: 'Mature_Man', label: 'Mature Man' },
    { id: 'Mature_Woman', label: 'Mature Woman' },
    { id: 'Calm_Man', label: 'Calm Man' },
    { id: 'Warm_Woman', label: 'Warm Woman' },
    { id: 'Cheerful_Person', label: 'Cheerful Person' },
    { id: 'Serious_Person', label: 'Serious Person' },
    { id: 'Humorous_Man', label: 'Humorous Man' },
    { id: 'Gentle_Woman', label: 'Gentle Woman' },
  ]

  constructor(config: Configuration) {
    super(config)
  }

  private getApiKey(): string {
    return this.config.engines.minimax?.apiKey
  }

  private getGroupId(): string {
    return this.config.engines.minimax?.groupId
  }

  private buildRequestPayload(text: string, opts?: { model?: string, voice?: string }) {
    const model = opts?.model || this.config.tts.model || TTSMiniMax.models[0].id
    const voice = opts?.voice || this.config.tts.voice || TTSMiniMax.voices('')[0].id

    return {
      text,
      model,
      voice_setting: {
        voice_id: voice,
        speed: 0.95,
        pitch: -1,
        emotion: 'neutral'
      },
      language_boost: 'English',
      stream: false
    }
  }

  private hexToBuffer(hex: string): ArrayBuffer {
    const bytes = new Uint8Array(hex.length / 2)
    for (let i = 0; i < hex.length; i += 2) {
      bytes[i / 2] = parseInt(hex.substr(i, 2), 16)
    }
    return bytes.buffer as ArrayBuffer
  }

  async synthetize(text: string, opts?: { model?: string, voice?: string }): Promise<SynthesisResponse> {

    const apiKey = this.getApiKey()
    if (!apiKey) {
      throw new Error('MiniMax API key not configured')
    }

    const groupId = this.getGroupId()
    if (!groupId) {
      throw new Error('MiniMax Group ID not configured')
    }

    const payload = this.buildRequestPayload(text, opts)
    const url = `https://api.minimaxi.chat/v1/t2a_v2?GroupId=${groupId}`

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`MiniMax API error: ${response.status} ${errorText}`)
    }

    const data = await response.json()

    if (!data.data?.audio) {
      throw new Error('No audio data in response')
    }

    const audioBuffer = this.hexToBuffer(data.data.audio)
    const blob = new Blob([audioBuffer], { type: 'audio/mp3' })

    return new Promise<SynthesisResponse>((resolve, reject) => {
      const reader = new FileReader()
      reader.onloadend = () => resolve({
        type: 'audio',
        mimeType: 'audio/mp3',
        content: reader.result as string
      })
      reader.onerror = reject
      reader.readAsDataURL(blob)
    })
  }
}
