
import { EngineCreateOpts, Model } from 'multi-llm-ts'
import { Shortcut, anyDict } from './index.d'

export interface Configuration {
  general: GeneralConfig
  llm: LLMConfig
  prompt: PromptConfig
  commands: CommandsConfig
  instructions: InstructionsConfig
  appearance: AppearanceConfig
  shortcuts: ShortcutsConfig
  scratchpad: ScratchpadConfig
  engines: {[key: string]: EngineConfig}
  plugins: {[key: string]: PluginConfig}
  stt: STTConfig
  rag: RagConfig
  dropbox: DropboxConfig
  gdrive: GDriveConfig
}

export interface EngineConfig extends EngineCreateOpts{
  models: ModelsConfig
  model: ModelConfig
  tts: TTSConfig
}

export interface GeneralConfig {
  firstRun: boolean
  hideOnStartup: boolean
  keepRunning: boolean
  language: string
  tips: {[key: string]: boolean}
  confirm: {[key: string]: boolean}
}

export interface LLMConfig {
  engine: string
  autoVisionSwitch: boolean
  conversationLength: number
  imageResize: number
}

export interface InstructionsConfig {
  default: string
  titling: string
  titling_user: string
  docquery: string
  scratchpad: { [key: string]: string }
}

export interface AppearanceConfig {
  theme: 'light' | 'dark' | 'system'
  tint: 'black' | 'blue'
  chat: ChatAppearance
}

export interface PromptConfig {
  engine: string
  model: string
  autosave: boolean
}

export interface CommandsConfig {
  engine: string
  model: string
}

export interface ChatAppearance {
  theme: string
  fontFamily: string
  fontSize: number
}

export interface ShortcutsConfig {
  chat: Shortcut
  command: Shortcut
  prompt: Shortcut
  readaloud: Shortcut
  transcribe: Shortcut
  scratchpad: Shortcut
}

export interface ScratchpadConfig {
  engine: string
  model: string
  fontFamily: string
  fontSize: string
}

//export type SilenceAction = 'nothing' | 'stop_transcribe' | 'stop_execute' | 'execute_continue'

export interface STTConfig {
  engine: string
  model: string
  silenceDetection: boolean
  silenceDuration: number
  //silenceAction: SilenceAction
}

export interface ModelsConfig {
  chat: Model[]
  image?: Model[]
  video?: Model[]
  embedding?: Model[]
}

export interface ModelConfig {
  chat: string
  image: string
  video?: string
}

export type TTSModel = 'tts-1' | 'tts-1-hd'
export type TTSVoice = 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer'

export interface TTSConfig {
  model: TTSModel
  voice: TTSVoice
}

export interface RagConfig {
  maxDocumentSizeMB?: number
  chunkSize?: number
  chunkOverlap?: number
  searchResultCount?: number
  relevanceCutOff?: number
}

export interface DropboxConfig {
  accessToken: string
}

export interface GDriveConfig {
  tokens: anyDict
  fileIds: strDict
}
