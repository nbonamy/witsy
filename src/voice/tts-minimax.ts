
import { Configuration } from '../types/config'
import { SynthesisResponse, TTSEngine } from './tts-engine'
import { TTSVoice } from '../types/index'

export default class TTSMiniMax extends TTSEngine {

  static readonly models = [
    { id: 'speech-2.6-hd', label: 'Speech 2.6 HD' },
    { id: 'speech-2.6-turbo', label: 'Speech 2.6 Turbo' },
    { id: 'speech-02-hd', label: 'Speech 02 HD' },
    { id: 'speech-02-turbo', label: 'Speech 02 Turbo' },
    { id: 'speech-01-hd', label: 'Speech 01 HD' },
    { id: 'speech-01-turbo', label: 'Speech 01 Turbo' },
  ]

  // Static fallback voices (subset of popular voices)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  static readonly voices = (model: string): TTSVoice[] => [
    { id: 'Calm_Man', label: 'Calm Man' },
    { id: 'Cheerful_Person', label: 'Cheerful Person' },
    { id: 'Elderly_Man', label: 'Elderly Man' },
    { id: 'Elderly_Woman', label: 'Elderly Woman' },
    { id: 'Energetic_Boy', label: 'Energetic Boy' },
    { id: 'Friendly_Person', label: 'Friendly Person' },
    { id: 'Gentle_Woman', label: 'Gentle Woman' },
    { id: 'Humorous_Man', label: 'Humorous Man' },
    { id: 'Mature_Man', label: 'Mature Man' },
    { id: 'Mature_Woman', label: 'Mature Woman' },
    { id: 'Narration_Man', label: 'Narration Man' },
    { id: 'Narration_Woman', label: 'Narration Woman' },
    { id: 'Professional_Man', label: 'Professional Man' },
    { id: 'Professional_Woman', label: 'Professional Woman' },
    { id: 'Serious_Person', label: 'Serious Person' },
    { id: 'Sweet_Girl', label: 'Sweet Girl' },
    { id: 'Warm_Woman', label: 'Warm Woman' },
    { id: 'Wise_Woman', label: 'Wise Woman' },
    { id: 'Young_Man', label: 'Young Man' },
    { id: 'Young_Woman', label: 'Young Woman' },
  ]

  constructor(config: Configuration) {
    super(config)
  }

  async getVoices(model: string): Promise<TTSVoice[]> {
    const apiKey = this.getApiKey()
    if (!apiKey) {
      console.warn('MiniMax API key not configured, returning static voices')
      return TTSMiniMax.voices(model)
    }

    try {
      const url = `https://api.minimax.io/v1/get_voice`
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: '{ "voice_type": "all" }'
      })

      if (!response.ok) {
        console.error(`Failed to fetch voices: ${response.status}`)
        return TTSMiniMax.voices(model)
      }

      const data = await response.json()

      if (!data.system_voice) {
        console.error('No voices data in response')
        return TTSMiniMax.voices(model)
      }

      // Sort voices alphabetically by label
      const voices = data.system_voice.map((voice: any) => ({
        id: voice.voice_id || voice.id,
        label: voice.name || voice.voice_id || voice.id
      })).sort((a: TTSVoice, b: TTSVoice) => a.label.localeCompare(b.label))

      return voices
    } catch (error) {
      console.error('Error fetching MiniMax voices:', error)
      return TTSMiniMax.voices(model)
    }
  }

  private getApiKey(): string {
    return this.config.engines.minimax?.apiKey
  }

  private buildRequestPayload(text: string, opts?: { model?: string, voice?: string, stream?: boolean }) {
    
    const model = opts?.model || this.config.tts.model || TTSMiniMax.models[0].id
    const voice = opts?.voice || this.config.tts.voice || TTSMiniMax.voices('')[0].id

    return {
      text,
      model,
      voice_setting: {
        voice_id: voice,
      },
      language_boost: 'auto',
      stream: opts?.stream || false,
      stream_options: {
        exclude_aggregated_audio: true,
      }
    }
  }

  private hexToBuffer(hex: string): ArrayBuffer {
    const bytes = new Uint8Array(hex.length / 2)
    for (let i = 0; i < hex.length; i += 2) {
      bytes[i / 2] = parseInt(hex.substr(i, 2), 16)
    }
    return bytes.buffer as ArrayBuffer
  }

  async synthetize(text: string, opts?: { model?: string, voice?: string, stream?: boolean }): Promise<SynthesisResponse> {

    const apiKey = this.getApiKey()
    if (!apiKey) {
      throw new Error('MiniMax API key not configured')
    }

    // Use streaming by default (like ElevenLabs)
    const useStreaming = opts?.stream !== false
    const payload = this.buildRequestPayload(text, { ...opts, stream: useStreaming })
    const url = 'https://api.minimax.io/v1/t2a_v2'

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

    // Handle streaming response
    if (useStreaming) {
      return this.handleStreamingResponse(response)
    }

    // Handle non-streaming response
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

  private async handleStreamingResponse(response: Response): Promise<SynthesisResponse> {
    const reader = response.body?.getReader()
    if (!reader) {
      throw new Error('No response body available for streaming')
    }

    const decoder = new TextDecoder()
    let buffer = ''

    const stream = new ReadableStream({
      start: async (controller) => {
        try {
          while (true) {
            const { done, value } = await reader.read()

            if (done) {
              controller.close()
              break
            }

            buffer += decoder.decode(value, { stream: true })
            const events = buffer.split('\n\n')
            buffer = events.pop() || ''

            for (const event of events) {
              if (!event.trim() || !event.startsWith('data:')) continue

              try {
                const jsonStr = event.replace(/^data:\s*/, '')
                const data = JSON.parse(jsonStr)

                if (data.data.status === 2) {
                  break
                }

                if (data.data?.audio) {
                  const audioChunk = this.hexToBuffer(data.data.audio)
                  controller.enqueue(new Uint8Array(audioChunk))
                }

              } catch (e) {
                console.error('Error parsing SSE event:', e)
              }
            }
          }
        } catch (error) {
          controller.error(error)
        }
      }
    })

    return {
      type: 'audio',
      mimeType: 'audio/mp3',
      content: stream
    }
  }
}
