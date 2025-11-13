
import { TTSVoice } from 'types/index'
import { Configuration } from 'types/config'
import { SynthesisResponse, TTSEngine } from './tts-engine'
import { ElevenLabsClient } from 'elevenlabs'

export default class TTSElevenLabs extends TTSEngine {

  client: ElevenLabsClient

  static readonly models = [
    {id: 'eleven_monolingual_v1', label: 'Eleven English v1'},
    {id: 'eleven_multilingual_v1', label: 'Eleven Multilingual v1'},
    {id: 'eleven_multilingual_v2', label: 'Eleven Multilingual v2'},
    {id: 'eleven_turbo_v2', label: 'Eleven Turbo v2'},
    {id: 'eleven_turbo_v2_5', label: 'Eleven Turbo v2.5'},
    {id: 'eleven_flash_v2', label: 'Eleven Flash v2'},
    {id: 'eleven_flash_v2_5', label: 'Eleven Flash v2.5'},
  ]

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  static readonly voices = (model: string): TTSVoice[] => [
    { id: 'Xb7hH8MSUJpSbSDYk0k2', label: 'Alice' },
    // { id: 'aEO01A4wXwd1O8GPgGlF', label: 'Arabella' },
    { id: '9BWtsMINqrJLrRacOk9x', label: 'Aria' },
    { id: 'pqHfZKP75CvOlQylNhV4', label: 'Bill' },
    { id: 'nPczCjzI2devNBz1zQrb', label: 'Brian' },
    { id: 'N2lVS1w4EtoT3dr4eOWO', label: 'Callum' },
    { id: 'IKne3meq5aSn9XLyUdCD', label: 'Charlie' },
    { id: 'XB0fDUnXU5powFXDhCwa', label: 'Charlotte' },
    { id: 'iP95p4xoKVk53GoZ742B', label: 'Chris' },
    { id: 'onwK4e9ZLuTAKqWW03F9', label: 'Daniel' },
    { id: 'cjVigY5qzO86Huf0OWal', label: 'Eric' },
    { id: 'JBFqnCBsd6RMkjVDRZzb', label: 'George' },
    { id: 'cgSgspJ2msm6clMCkdW9', label: 'Jessica' },
    { id: 'FGY2WhTYpPnrIDTdsKH5', label: 'Laura' },
    { id: 'TX3LPaxmHKxFdv7VOQHJ', label: 'Liam' },
    { id: 'pFZP5JQG7iQjIQuC4Bku', label: 'Lily' },
    { id: 'XrExE9yKIg1WjnnlVkGX', label: 'Matilda' },
    { id: 'SAz9YHcvj6GT2YYXdXww', label: 'River' },
    { id: 'CwhRBWXzGAHq8TQ4Fs17', label: 'Roger' },
    { id: 'EXAVITQu4vr4xnSDxMaL', label: 'Sarah' },
    { id: 'bIHbv24MWmeRgasZH58o', label: 'Will' },
  ]

  constructor(config: Configuration) {
    super(config)
    this.client = new ElevenLabsClient({
      apiKey: this.config.engines.elevenlabs.apiKey
    })
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async getVoices(model: string): Promise<TTSVoice[]> {
    const voices = await this.client.voices.getAll()
    return voices.voices.sort((a, b) => {
      if (a.is_owner && !b.is_owner) return 1
      if (!a.is_owner && b.is_owner) return -1
      return a.name.localeCompare(b.name)
    }).map(voice => ({
      id: voice.voice_id,
      label: voice.name || voice.voice_id,
    }))
  }

  async synthetize(text: string, opts?: { model?: string, voice?: string}): Promise<SynthesisResponse> {
    
    // // models
    // const models = (await this.client.models.getAll()).filter(model => model.can_do_text_to_speech).map(model => ({ id: model.model_id, label: model.name }))
    // console.log(models)

    // // voices
    // const voices = (await this.client.voices.getAll()).voices.map(voice => ({ id: voice.voice_id, label: voice.name })).sort((a, b) => a.label.localeCompare(b.label))
    // console.log(voices)

    // call
    const voice = opts?.voice || this.config.tts.voice || TTSElevenLabs.voices('')[0].id
    const response = await this.client.textToSpeech.convertAsStream(voice, {
      model_id: opts?.model || this.config.tts.model || TTSElevenLabs.models[0].id,
      output_format: 'mp3_44100_96',
      text: text,
    })

    // return an object
    return {
      type: 'audio',
      content: response as unknown as ReadableStream
    }
  }

}