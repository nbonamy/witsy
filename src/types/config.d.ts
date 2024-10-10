
import { Shortcut, anyDict } from './index.d'

export interface Configuration {
  general: GeneralConfig
  llm: LLMConfig
  commands: CommandsConfig
  instructions: InstructionsConfig
  appearance: AppearanceConfig
  shortcuts: ShortcutsConfig
  engines: {[key: string]: EngineConfig}
  plugins: {[key: string]: PluginConfig}
  stt: STTConfig
  rag: RagConfig
  dropbox: DropboxConfig
  gdrive: GDriveConfig
  getActiveModel: () => string
}

interface GeneralConfig {
  hideOnStartup: boolean
  keepRunning: boolean
  language: string
  tips: {[key: string]: boolean}
}

interface LLMConfig {
  engine: string
  autoVisionSwitch: boolean
  conversationLength: number
}

interface InstructionsConfig {
  default: string
  titling: string
  titling_user: string
  docquery: string
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
  anywhere: Shortcut
  readaloud: Shortcut
  transcribe: Shortcut
  scratchpad: Shortcut
}

export type SilenceAction = 'nothing' | 'stop_transcribe' | 'stop_execute' | 'execute_continue'

interface STTConfig {
  engine: string
  model: string
  silenceDetection: boolean
  silenceDuration: number
  silenceAction: SilenceAction
}

interface EngineConfig {
  apiKey?: string
  baseURL?: string
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
  embedding?: Model[]
}

interface ModelConfig {
  chat: string
  image: string
}

export type TTSModel = 'tts-1' | 'tts-1-hd'
export type TTSVoice = 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer'

interface TTSConfig {
  model: TTSModel
  voice: TTSVoice
}

interface RagConfig {
  maxDocumentSizeMB?: number
  chunkSize?: number
  chunkOverlap?: number
  searchResultCount?: number
  relevanceCutOff?: number
}

interface DropboxConfig {
  accessToken: string
}

interface GDriveConfig {
  tokens: anyDict
  fileIds: strDict
}
