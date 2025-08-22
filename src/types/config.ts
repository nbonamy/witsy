
import { ChatModel, EngineCreateOpts, Model, LlmModelOpts } from 'multi-llm-ts'
import { DesignStudioMediaType, Shortcut, strDict, TTSVoice } from './index'
import { PluginConfig } from '../plugins/plugin'
import { McpClaudeServer, McpServer, McpServerState } from './mcp'
import { ToolSelection } from './llm'

export type Configuration = {
  general: GeneralConfig
  llm: LLMConfig
  prompt: PromptConfig
  commands: CommandsConfig
  automation: AutomationConfig
  instructions: InstructionsConfig
  deepresearch: DeepResearchConfig
  appearance: AppearanceConfig
  studio: DesignStudioConfig
  shortcuts: ShortcutsConfig
  scratchpad: ScratchpadConfig
  engines: Record<string, EngineConfig|CustomEngineConfig>
  plugins: Record<string, PluginConfig>
  stt: STTConfig
  tts: TTSConfig
  rag: RagConfig
  realtime: RealtimeConfig
  mcp: McpConfig
  mcpServers: Record<string, McpClaudeServer>
  features?: Record<string, any>
}

export type WitsyEngineCreateOpts = EngineCreateOpts & {
  keepAlive?: string
  providerOrder?: string
}

export type EngineConfig = WitsyEngineCreateOpts & {
  models: ModelsConfig
  model: ModelConfig
  realtime?: EngineRealtimeConfig
  disableTools?: boolean
  voices?: TTSVoice[]
}

export type CustomEngineConfig = EngineConfig & {
  label: string
  api: string
}

export type ProxyMode = 'default' | 'bypass' | 'custom'

export type GeneralConfig = {
  firstRun: boolean
  onboardingDone: boolean
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
  instructions: string
} & LlmModelOpts

export type InstructionsType = 'standard' | 'structured' | 'playful' | 'empathic' | 'uplifting' | 'reflective' | 'visionary' | string

export type CustomInstruction = {
  id: string
  label: string
  instructions: string
}

export type LLMConfig = {
  instructions: InstructionsType  
  engine: string
  locale: string
  forceLocale: boolean
  favorites: FavoriteModel[]
  conversationLength: number
  imageResize: number
  defaults: ModelDefaults[]
  customInstructions: CustomInstruction[]
  additionalInstructions: {
    datetime: boolean
    mermaid: boolean
    artifacts: boolean
  }
}

export type InstructionsConfig = {
  chat: strDict
  scratchpad: strDict
  utils: {
    titling: string
    titlingUser: string
  }
}

export type DeepResearchRuntime = 'ma' | 'ms'

export type DeepResearchConfig = {
  runtime: DeepResearchRuntime
  breadth: number
  depth: number
  searchResults: number
}

export type AppearanceConfig = {
  theme: 'light' | 'dark' | 'system'
  lightTint: 'white' | 'gray'
  darkTint: 'black' | 'blue'
  chatList: ChatListAppearance
  chat: ChatAppearance
}

export type PromptConfig = {
  engine: string
  model: string
  disableStreaming: boolean
  disableTools: boolean
  autosave: boolean
}

export type DesignStudioModel = {
  engine: string
  model: string
}

export type DesignStudioModelDefaults = DesignStudioModel & {
  params: Record<string, string>
}

export type DesignStudioConfig = {
  type: DesignStudioMediaType
  engines: Record<DesignStudioMediaType, string>
  favorites: DesignStudioModel[]
  defaults: DesignStudioModelDefaults[]
}

export type CommandsConfig = {
  engine: string
  model: string
}

export type AutomationConfig = {
  altWinCopyPaste: boolean
}

export type ChatToolMode = 'never' | 'calling' | 'always'

export type ChatAppearance = {
  showReasoning: boolean
  theme: string
  fontFamily: string
  fontSize: number
  showToolCalls: ChatToolMode
}

export type ChatListMode = 'timeline' | 'folder'

export type ChatListLayout = 'normal' | 'compact'

export type ChatListAppearance = {
  mode: ChatListMode
  layout: ChatListLayout
}

export type ShortcutsConfig = {
  main: Shortcut
  prompt: Shortcut
  scratchpad: Shortcut
  command: Shortcut
  readaloud: Shortcut
  transcribe: Shortcut
  realtime: Shortcut
  studio: Shortcut
  forge: Shortcut
  // optional Flag: globale Shortcuts (Default-Logik erfolgt zur Laufzeit in main/shortcuts.ts)
  enableGlobalShortcuts?: boolean
}

export type ScratchpadConfig = {
  engine: string
  model: string
  fontFamily: string
  fontSize: string
}

export type STTVocabulary = {
  text: string
}

//export type SilenceAction = 'nothing' | 'stop_transcribe' | 'stop_execute' | 'execute_continue'

export type STTConfig = {
  locale: string
  vocabulary: STTVocabulary[]
  engine: string
  model: string
  autoStart: boolean
  pushToTalk: boolean
  silenceDetection: boolean
  silenceDuration: number
  customOpenAI: {
    baseURL: string
  }
  nvidia: {
    prompt: string
  }
  mistralai: {
    prompt: string
  }
  whisper: {
    gpu: boolean
  }
  soniox?: {
    languageHints?: string[]
    endpointDetection?: boolean
    cleanup?: boolean
    audioFormat?: string
    proxy?: 'temporary_key' | 'proxy_stream'
    tempKeyExpiry?: number
    speakerDiarization?: boolean
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

export type ModelType = 'chat' | 'image' | 'video' | 'embedding' | 'realtime' | 'computer' | 'tts' | 'stt' | 'imageEdit' | 'videoEdit'

export type ModelsConfig = {
  chat: ChatModel[]
  image?: Model[]
  imageEdit?: Model[]
  video?: Model[]
  videoEdit?: Model[]
  embedding?: Model[]
  realtime?: Model[]
  computer?: Model[]
  tts?: Model[]
  stt?: Model[]
}

export type ModelConfig = {
  chat?: string
  image?: string
  imageEdit?: string
  video?: string
  videoEdit?: string
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

export type McpServerExtra = {
  label?: string
  state?: McpServerState
}

export type McpConfig = {
  servers: McpServer[]
  //disabledMcpServers: string[]
  mcpServersExtra: Record<string, McpServerExtra>
  smitheryApiKey: string
}
