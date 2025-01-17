
import { Configuration } from '../types/config'
import { SynthesisResponse, TTSEngine } from './tts'
import OpenAI from 'openai'

export default class TTSKokoro implements TTSEngine {

  config: Configuration
  client: OpenAI

  static readonly models = [
    { id: 'kokoro', label: 'Kokoro' },
  ]

  static readonly voices = [
    { id: 'af', label: 'Default' },
    { id: 'af_bella', label: 'Bella' },
    { id: 'af_sarah', label: 'Sarah' },
    { id: 'af_nicole', label: 'Nicolas' },
    { id: 'af_sky', label: 'Sky' },
    { id: 'am_adam', label: 'Adam' },
    { id: 'am_michael', label: 'Michael' },
    { id: 'bf_emma', label: 'Emma' },
    { id: 'bf_isabella', label: 'Isabella' },
    { id: 'bm_george', label: 'George' },
    { id: 'bm_lewis', label: 'Lewis' },
  ]

  constructor(config: Configuration) {
    this.config = config
    this.client = new OpenAI({
      apiKey: 'not-needed',
      baseURL: 'https://api.kokorotts.com/v1',
      dangerouslyAllowBrowser: true
    })
  }

  async synthetize(text: string, opts?: { model?: string, voice?: string}): Promise<SynthesisResponse> {
    
    // call
    const response = await this.client.audio.speech.create({
      model: 'kokoro',
      voice: (opts?.voice || this.config.tts.voice || 'af_bella') as 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer',
      input: text
    });

    // return an object
    return {
      type: 'audio',
      content: response
    }
  }

}