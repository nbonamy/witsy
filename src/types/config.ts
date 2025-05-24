
import { ChatModel, EngineCreateOpts, Model, LlmModelOpts } from 'multi-llm-ts'
import { DesignStudioMediaType, Shortcut, strDict } from './index'
import { PluginConfig } from 'plugins/plugin'
import { McpClaudeServer, McpServer } from './mcp'
import { ToolSelection } from './llm'

export type Configuration = {
  general: GeneralConfig
  llm: LLMConfig
  prompt: PromptConfig
  commands: CommandsConfig
  automation: AutomationConfig
  instructions: InstructionsConfig
  appearance: AppearanceConfig
  studio: DesignStudioConfig
  shortcuts: ShortcutsConfig
  scratchpad: ScratchpadConfig
  engines: {[key: string]: EngineConfig|CustomEngineConfig}
  plugins: {[key: string]: PluginConfig}
  stt: STTConfig
  tts: TTSConfig
  rag: RagConfig
  realtime: RealtimeConfig
  mcp: McpConfig
  mcpServers: { [key: string]: McpClaudeServer }
}

export type WitsyEngineCreateOpts = EngineCreateOpts & {
  keepAlive?: string
}

export type EngineConfig = WitsyEngineCreateOpts & {
  models: ModelsConfig
  model: ModelConfig
  realtime?: EngineRealtimeConfig
  disableTools?: boolean
}

export type CustomEngineConfig = EngineConfig & {
  label: string
  api: string
}

export type ProxyMode = 'default' | 'bypass' | 'custom'

export type GeneralConfig = {
  firstRun: boolean
  hideOnStartup: boolean
  keepRunning: boolean
  proxyMode: ProxyMode
  customProxy: string
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
  disableStreaming: boolean
  disableTools?: boolean // backwards compatibility
  tools: ToolSelection
  locale: string
  prompt: string
} & LlmModelOpts

export type LLMConfig = {
  engine: string
  locale: string
  forceLocale: boolean
  favorites: FavoriteModel[]
  conversationLength: number
  imageResize: number
  defaults: ModelDefaults[],
}

export type InstructionsConfig = {
  default: string
  titling: string
  titlingUser: string
  docquery: string
  scratchpad: strDict
}

export type AppearanceConfig = {
  theme: 'light' | 'dark' | 'system'
  lightTint: 'white' | 'gray'
  darkTint: 'black' | 'blue'
  chatList: ChatListAppearance
  chat: ChatAppearance
}

export type DesignStudioModel = {
  engine: string
  model: string
}

export type DesignStudioModelDefaults = DesignStudioModel & {
  params: Record<string, string>
}

export type DesignStudioMediaTypeDefaults = {
  engine: string
} & Record<string, string>

export type DesignStudioConfig = {
  type: DesignStudioMediaType
  favorites: DesignStudioModel[]
  defaults: DesignStudioModelDefaults[]
} & Record<DesignStudioMediaType, DesignStudioMediaTypeDefaults>

export type PromptConfig = {
  engine: string
  model: string
  disableStreaming: boolean
  disableTools: boolean
  autosave: boolean
}

export type CommandsConfig = {
  engine: string
  model: string
}

export type AutomationConfig = {
  altWinCopyPaste: boolean
}

export type ChatAppearance = {
  showReasoning: boolean
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
  studio: Shortcut
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
  autoStart: boolean
  pushToTalk: boolean
  silenceDetection: boolean
  silenceDuration: number
  nvidia: {
    prompt: string
  }
  whisper: {
    gpu: boolean
  }
  //silenceAction: SilenceAction
}

export type TTSConfig = {
  engine: string
  model: string
  voice: string
}

export type RealtimeConfig = {
  engine: string

}

export type ModelsConfig = {
  chat: ChatModel[]
  image?: Model[]
  video?: Model[]
  embedding?: Model[]
  realtime?: Model[]
  computer?: Model[]
  tts?: Model[]
  stt?: Model[]
}

export type ModelConfig = {
  chat?: string
  image?: string
  video?: string
  vision?: string
}

export type EngineRealtimeConfig = {
  model: string
  voice: string
}

export type RagConfig = {
  maxDocumentSizeMB?: number
  chunkSize?: number
  chunkOverlap?: number
  searchResultCount?: number
  relevanceCutOff?: number
}

export type McpConfig = {
  servers: McpServer[]
  disabledMcpServers: string[]
  smitheryApiKey: string
}
