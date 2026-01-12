/**
 * Abstract base class for realtime voice engines
 * Enables vendor-agnostic implementation in RealtimeChat.vue
 */

import { ToolSelection } from "@/types/llm"

export const TRANSCRIPTION_UNAVAILABLE = '__TRANSCRIPTION_UNAVAILABLE__'

export type RealtimeToolCall = {
  id: string
  name: string
  status: 'running' | 'completed'
  params: string
  result: string
}

export type RealtimeStatus = 'idle' | 'connecting' | 'connected' | 'error'

export type RealtimeContentType = 'content' | 'reasoning'

export type RealtimeEngineCallbacks = {
  onStatusChange: (status: RealtimeStatus) => void
  onNewMessage: (message: RealtimeMessage) => void
  onMessageUpdated: (id: string, content: string, mode: 'append' | 'replace', type?: RealtimeContentType) => void
  onMessageToolCall: (messageId: string, toolCall: RealtimeToolCall) => void
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
  tools: ToolSelection
  llmModel?: string
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

  abstract get supportsTools(): boolean

  abstract connect(config: RealtimeConfig): Promise<void>
  abstract close(): void
  abstract isConnected(): boolean
  abstract getUsage(): RealtimeUsage
  abstract getCostInfo(usage: RealtimeUsage): RealtimeCostInfo

  static getAvailableVoices(): RealtimeVoice[] {
    return []
  }
}
