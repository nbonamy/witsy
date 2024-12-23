
import { EngineCreateOpts, Model } from 'multi-llm-ts'
import { Shortcut, strDict } from './index.d'

export type Configuration = {
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
}

export type EngineConfig = EngineCreateOpts & {
  models: ModelsConfig
  model: ModelConfig
  tts: TTSConfig
  realtime: RealtimeConfig
}

export type GeneralConfig = {
  firstRun: boolean
  hideOnStartup: boolean
  keepRunning: boolean
  language: string
  tips: {[key: string]: boolean}
  confirm: {[key: string]: boolean}
}

export type LLMConfig = {
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
  scratchpad: strDict
}

export type AppearanceConfig = {
  theme: 'light' | 'dark' | 'system'
  tint: 'black' | 'blue'
  chatList: ChatListAppearance
  chat: ChatAppearance
}

export type PromptConfig = {
  engine: string
  model: string
  autosave: boolean
}

export type CommandsConfig = {
  engine: string
  model: string
}

export type ChatAppearance = {
  theme: string
  fontFamily: string
  fontSize: number
}

export type ChatListMode = 'timeline' | 'folder'

export type ChatListLayout = 'normal' | 'compact'

export type ChatListAppearance = {
  mode: ChatListMode
  layout: ChatListLayout
}

export type ShortcutsConfig = {
  chat: Shortcut
  command: Shortcut
  prompt: Shortcut
  readaloud: Shortcut
  realtime: Shortcut
  transcribe: Shortcut
  scratchpad: Shortcut
}

export type ScratchpadConfig = {
  engine: string
  model: string
  fontFamily: string
  fontSize: string
}

//export type SilenceAction = 'nothing' | 'stop_transcribe' | 'stop_execute' | 'execute_continue'

export type STTConfig = {
  engine: string
  model: string
  silenceDetection: boolean
  silenceDuration: number
  //silenceAction: SilenceAction
}

export type ModelsConfig = {
  chat: Model[]
  image?: Model[]
  video?: Model[]
  embedding?: Model[]
}

export type ModelConfig = {
  chat: string
  image: string
  video?: string
}

export type TTSModel = 'tts-1' | 'tts-1-hd'
export type TTSVoice = 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer'

export type TTSConfig = {
  model: TTSModel
  voice: TTSVoice
}

export type RealtimeModel = string
export type RealtimeVoice = 'ash' | 'ballad' | 'coral' | 'sage' | 'verse'

export type RealtimeConfig = {
  model: RealtimeModel
  voice: RealtimeVoice
}

export type RagConfig = {
  maxDocumentSizeMB?: number
  chunkSize?: number
  chunkOverlap?: number
  searchResultCount?: number
  relevanceCutOff?: number
}
