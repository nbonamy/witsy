
import { Configuration } from 'types/config'
import TTSOpenAI from './tts-openai'
import TTSKokoro from './tts-kokoro'
// import TTSReplicate from './tts-replicate'

export type SynthesisResponse = {
  type: 'audio'
  content: Response
}

export interface TTSEngine {
  //constructor(config: Configuration): STTBase
  synthetize(text: string, opts?: object): Promise<SynthesisResponse>
}

const getTTSEngine = (config: Configuration): TTSEngine => {
  const engine = config.tts.engine || 'openai'
  if (engine === 'openai') {
    return new TTSOpenAI(config)
  // } else if (engine === 'replicate') {
  //   return new TTSReplicate(config)
  } else if (engine === 'kokoro') {
    return new TTSKokoro(config)
  } else {
    throw new Error(`Unknown STT engine ${engine}`)
  }
}

export const textMaxLength = 4096

export default getTTSEngine
