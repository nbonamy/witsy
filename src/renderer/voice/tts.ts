
import { Configuration } from 'types/config'
import { engineNames } from '../services/llms/base'
import { TTSEngine } from './tts-engine'
import TTSOpenAI from './tts-openai'
import TTSGroq from './tts-groq'
import TTSElevenLabs from './tts-elevenlabs'
import TTSFalAi from './tts-falai'
import TTSMiniMax from './tts-minimax'

export const getTTSEngines = () => {
  return [
    { id: 'openai', label: engineNames.openai },
    { id: 'elevenlabs', label: engineNames.elevenlabs },
    { id: 'falai', label: engineNames.falai },
    { id: 'groq', label: engineNames.groq },
    { id: 'minimax', label: engineNames.minimax },
    { id: 'custom', label: 'Custom OpenAI' },
  ]
}

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
  } else if (engine === 'minimax') {
    return new TTSMiniMax(config)
  } else if (engine === 'custom') {
    return new TTSOpenAI(config, config.tts.customOpenAI.baseURL)
  } else {
    throw new Error(`Unknown TTS engine ${engine}`)
  }
}

export const getTTSModels = (engine: string) => {
  // get models
  if (engine === 'openai') {
    return TTSOpenAI.models
  } else if (engine === 'groq') {
    return TTSGroq.models
  } else if (engine === 'elevenlabs') {
    return TTSElevenLabs.models
  } else if (engine === 'falai') {
    return TTSFalAi.models
  // } else if (engine === 'replicate') {
  //   return TTSReplicate.models
  // } else if (engine === 'kokoro') {
  //   return TTSKokoro.models
  } else if (engine === 'minimax') {
    return TTSMiniMax.models
  } else if (engine === 'custom') {
    return []
  }
}

export const textMaxLength = 4096

export default getTTSEngine
