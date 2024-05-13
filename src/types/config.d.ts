
import { Shortcut } from './index.d'

export interface Configuration {
  general: GeneralConfig
  llm: LLMConfig
  commands: CommandsConfig
  instructions: InstructionsConfig
  appearance: AppearanceConfig
  shortcuts: ShortcutsConfig
  engines: {[key: string]: EngineConfig}
  plugins: {[key: string]: PluginConfig}
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
  titling_user: string
}

interface AppearanceConfig {
  chat: ChatAppearance
}

interface CommandsConfig {
  engine: string
  model: string
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
