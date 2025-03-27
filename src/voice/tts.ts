
import { Configuration } from 'types/config'
import { TTSEngine } from './tts-engine'
import TTSOpenAI from './tts-openai'
import TTSGroq from './tts-groq'
import TTSElevenLabs from './tts-elevenlabs'
import TTSFalAi from './tts-falai'

const getTTSEngine = (config: Configuration): TTSEngine => {
  const engine = config.tts.engine || 'openai'
  if (engine === 'openai') {
    return new TTSOpenAI(config)
  } else if (engine === 'groq') {
    return new TTSGroq(config)
  } else if (engine === 'falai') {
    return new TTSFalAi(config)
  // } else if (engine === 'replicate') {
  //   return new TTSReplicate(config)
  } else if (engine === 'elevenlabs') {
    return new TTSElevenLabs(config)
  // } else if (engine === 'kokoro') {
  //   return new TTSKokoro(config)
  } else {
    throw new Error(`Unknown STT engine ${engine}`)
  }
}

export const textMaxLength = 4096

export default getTTSEngine
