
import { EngineCreateOpts, Model, LlmModelOpts } from 'multi-llm-ts'
import { Shortcut, strDict } from './index'
import { PluginConfig } from 'plugins/plugin'
import { McpClaudeServer } from './mcp'

export type Configuration = {
  general: GeneralConfig
  llm: LLMConfig
  prompt: PromptConfig
  commands: CommandsConfig
  instructions: InstructionsConfig
  appearance: AppearanceConfig
  shortcuts: ShortcutsConfig
  scratchpad: ScratchpadConfig
  engines: {[key: string]: EngineConfig|CustomEngineConfig}
  plugins: {[key: string]: PluginConfig}
  stt: STTConfig
  tts: TTSConfig
  rag: RagConfig
  mcpServers: { [key: string]: McpClaudeServer }
}

export type EngineConfig = EngineCreateOpts & {
  models: ModelsConfig
  model: ModelConfig
  realtime?: RealtimeConfig
}

export type CustomEngineConfig = EngineConfig & {
  label: string
  api: string
}

export type GeneralConfig = {
  firstRun: boolean
  hideOnStartup: boolean
  keepRunning: boolean
  locale: string
  tips: {[key: string]: boolean}
  confirm: {[key: string]: boolean}
}

export type FavoriteModel = {
  id: string
  engine: string
  model: string
}

export type ModelDefaults = {
  engine: string
  model: string
  disableTools: boolean
  locale: string
  prompt: string
} & LlmModelOpts

export type LLMConfig = {
  engine: string
  locale: string
  forceLocale: boolean
  favorites: FavoriteModel[]
  autoVisionSwitch: boolean
  conversationLength: number
  imageResize: number
  defaults: ModelDefaults[],
}

export type InstructionsConfig = {
  default: string
  titling: string
  titllingUser: string
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
  prompt: Shortcut
  chat: Shortcut
  scratchpad: Shortcut
  command: Shortcut
  readaloud: Shortcut
  transcribe: Shortcut
  realtime: Shortcut
}

export type ScratchpadConfig = {
  engine: string
  model: string
  fontFamily: string
  fontSize: string
}

//export type SilenceAction = 'nothing' | 'stop_transcribe' | 'stop_execute' | 'execute_continue'

export type STTConfig = {
  locale: string
  engine: string
  model: string
  silenceDetection: boolean
  silenceDuration: number
  //silenceAction: SilenceAction
}

export type TTSConfig = {
  engine: string
  model: string
  voice: string
}

export type ModelsConfig = {
  chat: Model[]
  image?: Model[]
  video?: Model[]
  embedding?: Model[]
  tts?: Model[]
}

export type ModelConfig = {
  chat?: string
  image?: string
  video?: string
}

export type RealtimeModel = string
export type RealtimeVoice = 'alloy' | 'ash' | 'ballad' | 'coral' | 'edge' | 'sage' | 'simmer' | 'verse'

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
