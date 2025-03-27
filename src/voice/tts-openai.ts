
import { Configuration } from '../types/config'
import { SynthesisResponse, TTSEngine } from './tts'
import OpenAI from 'openai'

export default class TTSOpenAI implements TTSEngine {

  config: Configuration
  client: OpenAI

  static readonly models = [
    { id: 'tts-1', label: 'TTS 1' },
    { id: 'tts-1-hd', label: 'TTS 1 HD' },
  ]

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  static readonly voices = (model: string) => [
    { id: 'alloy', label: 'Alloy' },
    { id: 'ash', label: 'Ash' },
    { id: 'coral', label: 'Coral' },
    { id: 'echo', label: 'Echo' },
    { id: 'fable', label: 'Fable' },
    { id: 'onyx', label: 'Onyx' },
    { id: 'nova', label: 'Nova' },
    { id: 'sage', label: 'Sage' },
    { id: 'shimmer', label: 'Shimmer' },
  ]

  constructor(config: Configuration) {
    this.config = config
    this.client = new OpenAI({
      apiKey: config.engines.openai.apiKey,
      dangerouslyAllowBrowser: true
    })
  }

  async synthetize(text: string, opts?: { model?: string, voice?: string}): Promise<SynthesisResponse> {
    
    // call
    const response = await this.client.audio.speech.create({
      model: opts?.model || this.config.tts.model || 'tts-1',
      voice: (opts?.voice || this.config.tts.voice || 'alloy') as 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer',
      input: text
    });

    // return an object
    return {
      type: 'audio',
      content: response
    }
  }

}