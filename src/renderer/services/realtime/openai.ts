/**
 * OpenAI Realtime implementation using OpenAI Agents SDK
 */

import { Agent, FunctionTool, protocol, tool, UnknownContext } from '@openai/agents'
import { RealtimeAgent, RealtimeContextData, RealtimeItem, RealtimeSession } from '@openai/agents/realtime'
import { LlmTool, MultiToolPlugin, Plugin, PluginExecutionContext } from 'multi-llm-ts'
import { z, ZodTypeAny } from 'zod'
import { Configuration } from 'types/config'
import { availablePlugins, enabledPlugins, PluginInstance } from '../plugins/plugins'
import {
  RealtimeConfig,
  RealtimeCostInfo,
  RealtimeEngine,
  RealtimeEngineCallbacks,
  RealtimeUsage,
  RealtimeVoice,
  TRANSCRIPTION_UNAVAILABLE,
} from './engine'

/**
 * Convert JSON Schema to Zod schema
 * This handles the conversion from OpenAI API tool format to OpenAI Agents SDK format
 * Note: OpenAI structured outputs require all fields to be required, so we use .nullable() for optional fields
 */
export function jsonSchemaToZod(schema: any): ZodTypeAny {

  // Handle object type
  if (schema.type === 'object') {
    const shape: Record<string, ZodTypeAny> = {}
    const properties = schema.properties || {}
    const required = schema.required || []

    for (const [key, prop] of Object.entries<any>(properties)) {
      let zodType = jsonSchemaToZod(prop)

      // For optional fields, use nullable (OpenAI requires all fields, but nullable is allowed)
      if (!required.includes(key)) {
        zodType = zodType.nullable()
      }

      shape[key] = zodType
    }

    return z.object(shape)
  }

  // Handle string type
  if (schema.type === 'string') {
    let zodString = z.string()
    if (schema.enum && schema.enum.length > 0) {
      return z.enum(schema.enum as [string, ...string[]])
    }
    if (schema.description) {
      zodString = zodString.describe(schema.description)
    }
    return zodString
  }

  // Handle number type
  if (schema.type === 'number' || schema.type === 'integer') {
    let zodNumber = z.number()
    if (schema.description) {
      zodNumber = zodNumber.describe(schema.description)
    }
    return zodNumber
  }

  // Handle boolean type
  if (schema.type === 'boolean') {
    let zodBoolean = z.boolean()
    if (schema.description) {
      zodBoolean = zodBoolean.describe(schema.description)
    }
    return zodBoolean
  }

  // Handle array type
  if (schema.type === 'array') {
    const itemSchema = schema.items ? jsonSchemaToZod(schema.items) : z.any()
    let zodArray = z.array(itemSchema)
    if (schema.description) {
      zodArray = zodArray.describe(schema.description)
    }
    return zodArray
  }

  // Fallback to any
  return z.any()
}

/**
 * Convert a single OpenAI API format tool to OpenAI Agents SDK format
 */
export function convertToolToAgentsFormat(
  llmTool: LlmTool,
  plugin: PluginInstance,
  modelId: string,
  abortSignal?: AbortSignal
) {
  const func = llmTool.function
  const zodSchema = jsonSchemaToZod(func.parameters)

  // Ensure zodSchema is a ZodObject as required by tool()
  const parametersSchema = zodSchema._def.typeName === 'ZodObject'
    ? zodSchema
    : z.object({ data: zodSchema })

  return tool({
    name: func.name,
    description: func.description || '',
    parameters: parametersSchema as any,
    execute: async (input: any) => {
      // Create execution context
      const context: PluginExecutionContext = {
        model: modelId,
        abortSignal
      }

      try {
        // For multi-tool plugins, pass the tool name in parameters
        if (plugin instanceof MultiToolPlugin) {
          const result = await plugin.execute(context, {
            tool: func.name,
            parameters: input
          })
          return result
        } else {
          // For single-tool plugins, pass parameters directly
          const result = await plugin.execute(context, input)
          return result
        }
      } catch (error: any) {
        console.error(`Error executing tool ${func.name}:`, error)
        return { error: error.message || 'Tool execution failed' }
      }
    }
  })
}

/**
 * Build LlmTool from a regular Plugin using its parameters
 */
function pluginToLlmTool(plugin: Plugin): LlmTool {
  return {
    type: 'function',
    function: {
      name: plugin.getName(),
      description: plugin.getDescription(),
      parameters: {
        type: 'object',
        properties: plugin.getParameters().reduce((obj: any, param) => {
          obj[param.name] = {
            type: param.type || 'string',
            description: param.description,
            ...(param.enum ? { enum: param.enum } : {})
          }
          return obj
        }, {}),
        required: plugin.getParameters().filter(p => p.required).map(p => p.name)
      }
    }
  }
}

/**
 * Check if a plugin has getTools method (CustomToolPlugin or MultiToolPlugin)
 */
function hasGetTools(plugin: PluginInstance): plugin is PluginInstance & { getTools(): Promise<LlmTool | LlmTool[]> } {
  return 'getTools' in plugin && typeof (plugin as any).getTools === 'function'
}

/**
 * Build tools from available plugins based on configuration
 * Returns array of tools ready for RealtimeAgent
 */
async function buildRealtimeTools(
  config: Configuration,
  modelId: string,
  toolSelection: string[] | null,
  abortSignal?: AbortSignal
): Promise<ReturnType<typeof tool>[]> {
  const tools: ReturnType<typeof tool>[] = []

  // Empty array means no tools
  if (toolSelection !== null && toolSelection.length === 0) {
    return tools
  }

  // Get list of enabled plugin names
  const enabled = enabledPlugins(config, true) // include MCP

  // Iterate through enabled plugins and convert each to Agent SDK format
  for (const pluginName of enabled) {
    const pluginClass = availablePlugins[pluginName]
    if (!pluginClass) continue

    const plugin: PluginInstance = new pluginClass(config.plugins[pluginName], config.workspaceId)

    // Skip plugins that don't serialize in tools
    if (!plugin.serializeInTools()) {
      continue
    }

    // For custom/multi-tool plugins, get their tool definitions
    if (hasGetTools(plugin)) {
      const pluginTools = await plugin.getTools()
      const toolsArray = Array.isArray(pluginTools) ? pluginTools : [pluginTools]

      for (const llmTool of toolsArray) {
        // Filter by tool selection (null = all tools allowed)
        if (toolSelection !== null && !toolSelection.includes(llmTool.function.name)) {
          continue
        }
        const agentTool = convertToolToAgentsFormat(llmTool, plugin, modelId, abortSignal)
        tools.push(agentTool)
      }
    } else {
      // For regular plugins, build the tool from parameters
      const llmTool = pluginToLlmTool(plugin as Plugin)
      // Filter by tool selection (null = all tools allowed)
      if (toolSelection !== null && !toolSelection.includes(llmTool.function.name)) {
        continue
      }
      const agentTool = convertToolToAgentsFormat(llmTool, plugin, modelId, abortSignal)
      tools.push(agentTool)
    }
  }

  return tools
}

// OpenAI Realtime pricing (per token)
// from https://platform.openai.com/docs/pricing
const PRICING = {
  mini: {
    textInput: 0.0000006,      // $0.60 / 1M
    textCached: 0.00000006,    // $0.06 / 1M
    textOutput: 0.0000024,     // $2.40 / 1M
    audioInput: 0.00001,       // $10.00 / 1M
    audioCached: 0.0000003,    // $0.30 / 1M
    audioOutput: 0.00002,      // $20.00 / 1M
  },
  full: {
    textInput: 0.000004,       // $4.00 / 1M
    textCached: 0.0000004,     // $0.40 / 1M
    textOutput: 0.000016,      // $16.00 / 1M
    audioInput: 0.000032,      // $32.00 / 1M
    audioCached: 0.0000004,    // $0.40 / 1M
    audioOutput: 0.000064,     // $64.00 / 1M
  }
}

export class RealtimeOpenAI extends RealtimeEngine {

  private config: Configuration
  private session: RealtimeSession | null = null
  private currentModel: string = ''

  // Message tracking - merge consecutive messages of same role
  private messages: { id: string, role: 'user' | 'assistant', parts: { id: string, content: string }[] }[] = []

  constructor(config: Configuration, callbacks: RealtimeEngineCallbacks) {
    super(callbacks)
    this.config = config
  }

  get supportsTools(): boolean {
    return true
  }

  async connect(realtimeConfig: RealtimeConfig): Promise<void> {

    this.currentModel = realtimeConfig.model

    // Build tools from enabled plugins (filtered by selection)
    const tools = await buildRealtimeTools(this.config, realtimeConfig.model, realtimeConfig.tools)

    // Create agent with instructions and tools
    const agent = new RealtimeAgent({
      name: 'Assistant',
      voice: realtimeConfig.voice,
      instructions: realtimeConfig.instructions,
      ...(tools.length > 0 ? { tools } : {}),
      ...(realtimeConfig.llmModel ? { llmModel: realtimeConfig.llmModel } : {})
    })

    // Create session with voice config
    this.session = new RealtimeSession(agent, {
      config: {
        voice: realtimeConfig.voice,
        audio: {
          input: {
            transcription: {
              model: 'gpt-4o-mini-transcribe',
            }
          }
        }
      }
    })

    // Register event listeners
    this.session.on('history_updated', this.onHistoryUpdated.bind(this))
    this.session.on('history_added', this.onHistoryAdded.bind(this))
    this.session.on('agent_tool_start', this.onToolStart.bind(this))
    this.session.on('agent_tool_end', this.onToolEnd.bind(this))

    // Get ephemeral key
    this.callbacks.onStatusChange('connecting')
    const ephemeralKey = await this.getEphemeralKey(realtimeConfig.model)

    // Connect session
    await this.session.connect({
      apiKey: ephemeralKey,
      model: realtimeConfig.model,
    })

    this.callbacks.onStatusChange('connected')
  }

  close(): void {
    this.session?.close()
    this.session = null
    this.messages = []
    this.toolCallToMessage.clear()
  }

  isConnected(): boolean {
    return this.session !== null
  }

  getUsage(): RealtimeUsage {
    if (!this.session) {
      return {
        audioInputTokens: 0,
        textInputTokens: 0,
        cachedAudioTokens: 0,
        cachedTextTokens: 0,
        audioOutputTokens: 0,
        textOutputTokens: 0,
      }
    }

    const usage = this.session.usage

    // Sum up token details from arrays
    // Note: audio_tokens/text_tokens INCLUDE cached tokens, so we subtract to get non-cached
    let totalAudioInput = 0
    let totalTextInput = 0
    let cachedAudioTokens = 0
    let cachedTextTokens = 0
    let audioOutputTokens = 0
    let textOutputTokens = 0

    type InputTokenDetails = {
      audio_tokens?: number
      text_tokens?: number
      cached_tokens_details?: {
        audio_tokens?: number
        text_tokens?: number
      }
    }

    type OutputTokenDetails = {
      audio_tokens?: number
      text_tokens?: number
    }

    for (const details of (usage.inputTokensDetails || []) as InputTokenDetails[]) {
      totalAudioInput += details.audio_tokens || 0
      totalTextInput += details.text_tokens || 0
      // Cached tokens are nested in cached_tokens_details
      if (details.cached_tokens_details) {
        cachedAudioTokens += details.cached_tokens_details.audio_tokens || 0
        cachedTextTokens += details.cached_tokens_details.text_tokens || 0
      }
    }

    // Non-cached = total - cached
    const audioInputTokens = totalAudioInput - cachedAudioTokens
    const textInputTokens = totalTextInput - cachedTextTokens

    for (const details of (usage.outputTokensDetails || []) as OutputTokenDetails[]) {
      audioOutputTokens += details.audio_tokens || 0
      textOutputTokens += details.text_tokens || 0
    }

    return {
      audioInputTokens,
      textInputTokens,
      cachedAudioTokens,
      cachedTextTokens,
      audioOutputTokens,
      textOutputTokens,
    }
  }

  getCostInfo(usage: RealtimeUsage): RealtimeCostInfo {
    const isMini = this.currentModel.toLowerCase().includes('mini')
    const pricing = isMini ? PRICING.mini : PRICING.full

    const inputCost = (usage.audioInputTokens * pricing.audioInput) +
                      (usage.cachedAudioTokens * pricing.audioCached) +
                      (usage.cachedTextTokens * pricing.textCached) +
                      (usage.textInputTokens * pricing.textInput)
    const outputCost = (usage.audioOutputTokens * pricing.audioOutput) +
                       (usage.textOutputTokens * pricing.textOutput)
    const total = inputCost + outputCost

    return {
      cost: { input: inputCost, output: outputCost, total },
      pricingModel: isMini ? 'gpt-realtime-mini' : 'gpt-realtime',
      pricingUrl: 'https://platform.openai.com/docs/pricing',
      pricingDate: '11/01/2026',
    }
  }

  static getAvailableVoices(): RealtimeVoice[] {
    return [
      { id: 'alloy', name: 'Alloy' },
      { id: 'ash', name: 'Ash' },
      { id: 'ballad', name: 'Ballad' },
      { id: 'coral', name: 'Coral' },
      { id: 'echo', name: 'Echo' },
      { id: 'sage', name: 'Sage' },
      { id: 'simmer', name: 'Simmer' },
      { id: 'verse', name: 'Verse' }
    ]
  }

  private async getEphemeralKey(model: string): Promise<string> {
    const response = await fetch('https://api.openai.com/v1/realtime/client_secrets', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.config.engines.openai.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        session: {
          type: 'realtime',
          model: model,
        }
      })
    })

    const data = await response.json()
    return data.value
  }

  private getTranscript(item: RealtimeItem): string | null {
    if (item.type !== 'message' || !item.content?.length) return null
    const content = item.content[0]
    return (content.type === 'input_audio' || content.type === 'output_audio')
      ? (content.transcript ?? TRANSCRIPTION_UNAVAILABLE)
      : (content.type === 'input_text' || content.type === 'output_text')
      ? content.text
      : ''
  }

  private getCombinedContent(msg: { parts: { content: string }[] }): string {
    return msg.parts.map(p => p.content).filter(c => c).join('\n\n')
  }

  private onHistoryAdded(item: RealtimeItem): void {
    if (item.type !== 'message') {
      this.callbacks.onUsageUpdated(this.getUsage())
      return
    }

    // console.log(`[realtime] added: role=${item.role}, id=${item.itemId}`)

    const transcript = this.getTranscript(item) || ''
    const role = item.role as 'user' | 'assistant'
    const lastMessage = this.messages[this.messages.length - 1]

    if (lastMessage && lastMessage.role === role) {
      // Same role - append to existing message
      lastMessage.parts.push({ id: item.itemId, content: transcript })
      // Send only the new content (delta)
      if (transcript) {
        this.callbacks.onMessageUpdated(lastMessage.id, transcript, 'append')
      }
    } else {
      // Different role - create new message
      const msg = { id: item.itemId, role, parts: [{ id: item.itemId, content: transcript }] }
      this.messages.push(msg)
      this.callbacks.onNewMessage({ id: msg.id, role, content: transcript })
    }

    this.callbacks.onUsageUpdated(this.getUsage())
  }

  private onHistoryUpdated(history: RealtimeItem[]): void {
    for (const item of history) {
      if (item.type !== 'message') continue

      // console.log(`[realtime] updated: role=${item.role}, id=${item.itemId}`)

      // Find message and part containing this SDK id
      const msg = this.messages.find(m => m.parts.some(p => p.id === item.itemId))
      if (!msg) {
        console.warn('[realtime] unknown message id:', item.itemId)
        continue
      }

      const part = msg.parts.find(p => p.id === item.itemId)!
      const transcript = this.getTranscript(item) || ''

      // Check if current content is placeholder
      if (part.content === TRANSCRIPTION_UNAVAILABLE && transcript !== part.content) {
        part.content = transcript
        this.callbacks.onMessageUpdated(msg.id, transcript, 'replace')
      }
      // Only emit if content grew (send delta only)
      else if (transcript.length > part.content.length) {
        const delta = transcript.slice(part.content.length)
        part.content = transcript
        this.callbacks.onMessageUpdated(msg.id, delta, 'append')
      }
    }

    this.callbacks.onUsageUpdated(this.getUsage())
  }

  // Track which message each tool call belongs to
  private toolCallToMessage: Map<string, string> = new Map()

  private getLastAssistantMessageId(): string {
    // Find last assistant message
    for (let i = this.messages.length - 1; i >= 0; i--) {
      if (this.messages[i].role === 'assistant') {
        return this.messages[i].id
      }
    }
    return `assistant-${Date.now()}`
  }

  private onToolStart(
    context: any,
    agent: Agent<UnknownContext>,
    tool: FunctionTool<RealtimeContextData<UnknownContext>>,
    details: { toolCall: protocol.ToolCallItem }
  ): void {
    if (details.toolCall.type !== 'function_call') {
      return
    }

    const callId = details.toolCall.callId || crypto.randomUUID()
    const messageId = this.getLastAssistantMessageId()

    // console.log(`[realtime] tool start: ${tool.name}, callId=${callId}, messageId=${messageId}`)

    // Remember which message this tool call belongs to
    this.toolCallToMessage.set(callId, messageId)

    this.callbacks.onMessageToolCall(messageId, {
      id: callId,
      name: tool.name,
      status: 'running',
      params: details.toolCall.arguments,
      result: null,
    })
  }

  private onToolEnd(
    context: any,
    agent: Agent<UnknownContext>,
    tool: FunctionTool<RealtimeContextData<UnknownContext>>,
    result: string, details: { toolCall: protocol.ToolCallItem }
  ): void {
    if (details.toolCall.type !== 'function_call') {
      return
    }

    const callId = details.toolCall.callId || ''
    // Use the message we recorded at start, or find last assistant
    const messageId = this.toolCallToMessage.get(callId) || this.getLastAssistantMessageId()

    // console.log(`[realtime] tool end: ${tool.name}, callId=${callId}, messageId=${messageId}`)

    this.callbacks.onMessageToolCall(messageId, {
      id: callId,
      name: tool.name,
      status: 'completed',
      params: details.toolCall.arguments,
      result: result,
    })

    // Cleanup
    this.toolCallToMessage.delete(callId)
  }
}
