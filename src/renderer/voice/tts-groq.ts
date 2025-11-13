
import { Configuration } from 'types/config'
import { SynthesisResponse, TTSEngine } from './tts-engine'
import Groq from 'groq-sdk'

export default class TTSGroq extends TTSEngine {

  client: Groq

  static readonly models = [
    { id: 'playai-tts', label: 'PlayAI English' },
    { id: 'playai-tts-arabic', label: 'PlayAI Arabic' },
  ]

   
  static readonly voices = (model: string) => {

    // english
    if (model === 'playai-tts') {
      return [
        { id: 'Arista-PlayAI', label: 'Arista' },
        { id: 'Atlas-PlayAI', label: 'Atlas' },
        { id: 'Basil-PlayAI', label: 'Basil' },
        { id: 'Briggs-PlayAI', label: 'Briggs' },
        { id: 'Calum-PlayAI', label: 'Calum' },
        { id: 'Celeste-PlayAI', label: 'Celeste' },
        { id: 'Cheyenne-PlayAI', label: 'Cheyenne' },
        { id: 'Chip-PlayAI', label: 'Chip' },
        { id: 'Cillian-PlayAI', label: 'Cillian' },
        { id: 'Deedee-PlayAI', label: 'Deedee' },
        { id: 'Fritz-PlayAI', label: 'Fritz' },
        { id: 'Gail-PlayAI', label: 'Gail' },
        { id: 'Indigo-PlayAI', label: 'Indigo' },
        { id: 'Mamaw-PlayAI', label: 'Mamaw' },
        { id: 'Mason-PlayAI', label: 'Mason' },
        { id: 'Mikail-PlayAI', label: 'Mikail' },
        { id: 'Mitch-PlayAI', label: 'Mitch' },
        { id: 'Quinn-PlayAI', label: 'Quinn' },
        { id: 'Thunder-PlayAI', label: 'Thunder' }
      ]
    }

    // arabic
    if (model === 'playai-tts-arabic') {
      return [
        { id: 'Ahmad-PlayAI', label: 'Ahmad' },
        { id: 'Amira-PlayAI', label: 'Amira' },
        { id: 'Khalid-PlayAI', label: 'Khalid' },
        { id: 'Nasser-PlayAI', label: 'Nasser' }
      ]
    }

    // default
    return [
      { id: '', label: 'Default' }
    ];
  }

  constructor(config: Configuration) {
    super(config)
    this.client = new Groq({
      apiKey: config.engines.groq?.apiKey || '',
      dangerouslyAllowBrowser: true,
    })
  }

  async synthetize(text: string, opts?: { model?: string, voice?: string}): Promise<SynthesisResponse> {
    
    // call
    const response = await this.client.audio.speech.create({
      response_format: 'wav',
      model: opts?.model || this.config.tts.model || 'tts-1',
      voice: (opts?.voice || this.config.tts.voice || 'alloy') as 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer',
      input: text,
    });

    // convert
    return this.readWavResponse(response);
  }

}