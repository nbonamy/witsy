
import { LlmModelOpts, LlmStructuredOutput, PluginParameter } from 'multi-llm-ts'
import { anyDict, Message, ToolCall } from './index'

export type A2APromptOpts = {
  currentTaskId?: string
  currentContextId?: string
}


export type AgentSource = 'witsy' | 'a2a'
export type AgentType = 'runnable' | 'support'

export const kAgentStepVarOutputPrefix = 'output.'
export const kAgentStepVarFacts = 'facts'

export type AgentStepStructuredOutput = LlmStructuredOutput

export type AgentStep = {
  // engine: string|null
  // model: string|null
  // modelOpts: LlmModelOpts|null
  // disableStreaming: boolean
  description?: string
  prompt?: string
  tools?: string[]|null
  agents?: string[]
  docrepo?: string
  expert?: string
  jsonSchema?: string
  structuredOutput?: AgentStepStructuredOutput
}

export interface Agent {
  uuid: string
  source: AgentSource
  createdAt: number
  updatedAt: number
  lastRunId?: string
  name: string
  description: string
  type: AgentType
  engine: string|null
  model: string|null
  modelOpts: LlmModelOpts|null
  disableStreaming: boolean
  locale: string|null
  instructions: string
  parameters: PluginParameter[]
  steps: AgentStep[]
  schedule: string|null
  webhookToken: string|null
  invocationValues: Record<string, string>
  buildPrompt: (step: number, parameters: anyDict) => string|null
  duplicate: (nameSuffix?: string) => Agent
  getPreparationDescription?: () => string
  getRunningDescription?: (args: any) => string
  getCompletedDescription?: (args: any, results: any) => string
  getErrorDescription?: (args: any, results: any) => string
}

export type AgentRunTrigger = 'manual' | 'schedule' | 'webhook' | 'workflow'
export type AgentRunStatus = 'running' | 'success' | 'canceled' | 'error'

export type AgentRun = {
  uuid: string
  agentId: string
  createdAt: number
  updatedAt: number
  trigger: AgentRunTrigger
  status: AgentRunStatus
  prompt: string
  error?: string
  messages: Message[]
  toolCalls: ToolCall[]
}

