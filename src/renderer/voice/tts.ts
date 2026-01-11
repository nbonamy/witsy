
import { Configuration } from 'types/config'
import { engineNames } from '@services/llms/consts'
import { TTSEngine } from './tts-engine'
import TTSOpenAI from './tts-openai'
import TTSGroq from './tts-groq'
import TTSElevenLabs from './tts-elevenlabs'
import TTSFalAi from './tts-falai'
import TTSMiniMax from './tts-minimax'

export const getTTSEngines = (): { id: string, label: string, type: 'api' | 'custom' }[] => {
  return [
    { id: 'openai', label: engineNames.openai, type: 'api' },
    { id: 'elevenlabs', label: engineNames.elevenlabs, type: 'api' },
    { id: 'falai', label: engineNames.falai, type: 'api' },
    { id: 'groq', label: engineNames.groq, type: 'api' },
    { id: 'minimax', label: engineNames.minimax, type: 'api' },
    { id: 'custom', label: 'Custom OpenAI', type: 'custom' },
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
