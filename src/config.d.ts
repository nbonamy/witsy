
import { Shortcut } from './index.d'

interface Configuration {
  general: GeneralConfig
  llm: LLMConfig
  instructions: InstructionsConfig
  appearance: AppearanceConfig
  shortcuts: ShortcutsConfig
  engines: {[key: string]: EngineConfig}
  getActiveModel: () => string
}

interface GeneralConfig {
  keepRunning: boolean
  language: string
}

interface LLMConfig {
  engine: string
  autoVisionSwitch: boolean
  conversationLength: number
}

interface InstructionsConfig {
  default: string
  routing: string
  titling: string
}

interface AppearanceConfig {
  chat: ChatAppearance
}

interface ChatAppearance {
  theme: string
  fontSize: number
}

interface ShortcutsConfig {
  chat: Shortcut
  command: Shortcut
}

interface EngineConfig {
  apiKey?: string
  models: ModelsConfig
  model: ModelConfig
  tts?: TTSConfig
}

interface Model {
  id: string
  name: string
  meta: any
}

interface ModelsConfig {
  chat: Model[]
  image?: Model[]
}

interface ModelConfig {
  chat: string
  image: string
}

interface TTSConfig {
  model: string
  voice: string
}
