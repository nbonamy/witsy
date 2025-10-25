
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

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async synthetize(text: string, opts?: { model?: string, voice?: string }): Promise<SynthesisResponse> {
    // TODO: Implementation in next step
    throw new Error('Not implemented')
  }
}
