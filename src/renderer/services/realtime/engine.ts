/**
 * Abstract base class for realtime voice engines
 * Enables vendor-agnostic implementation in RealtimeChat.vue
 */

export type RealtimeEngineCallbacks = {
  onStatusChange: (status: string) => void
  onMessagesUpdated: (messages: RealtimeMessage[]) => void
  onToolStart: (toolCallId: string, toolName: string, input: any) => void
  onToolEnd: (toolCallId: string, toolName: string, result: any) => void
  onUsageUpdated: (usage: RealtimeUsage) => void
  onError: (error: Error) => void
}

export type RealtimeMessage = {
  id: string
  role: 'user' | 'assistant'
  content: string
}

export type RealtimeUsage = {
  audioInputTokens: number
  textInputTokens: number
  cachedAudioTokens: number
  cachedTextTokens: number
  audioOutputTokens: number
  textOutputTokens: number
}

export type RealtimeCost = {
  input: number
  output: number
  total: number
}

export type RealtimeCostInfo = {
  cost: RealtimeCost
  pricingModel: string
  pricingUrl: string
  pricingDate: string
}

export type RealtimeConfig = {
  model: string
  voice: string
  instructions: string
}

export type RealtimeVoice = {
  id: string
  name: string
}

export abstract class RealtimeEngine {
  protected callbacks: RealtimeEngineCallbacks

  constructor(callbacks: RealtimeEngineCallbacks) {
    this.callbacks = callbacks
  }

  abstract connect(config: RealtimeConfig): Promise<void>
  abstract close(): void
  abstract isConnected(): boolean
  abstract getUsage(): RealtimeUsage
  abstract getCostInfo(usage: RealtimeUsage): RealtimeCostInfo

  static getAvailableVoices(): RealtimeVoice[] {
    return []
  }
}
